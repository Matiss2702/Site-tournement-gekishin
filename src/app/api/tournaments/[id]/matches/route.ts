import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageScores } from "@/lib/tournament-auth";
import { scoreUpdateSchema } from "@/lib/validations";
import { getBracketSize } from "@/lib/bracket";
import {
  propagateAdvancement,
  resolveWinnerId,
  updateEntryStats,
} from "@/lib/bracket-progression";
import { syncTournamentMatchDrafts } from "@/lib/draft-matches";
import { assertMatchReadyForScoring } from "@/lib/draft-match-status";
import { getMatchSeriesLength, validateSeriesScore } from "@/lib/match-series";
import { tryCompleteTournamentAndDistributePrizes } from "@/lib/tournament-prizes";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: tournamentId } = await params;

  if (!(await canManageScores(tournamentId, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = scoreUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { matchId, score1, score2, winnerId: explicitWinnerId } = parsed.data;

  const existing = await prisma.match.findFirst({
    where: { id: matchId, tournamentId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  if (existing.status === "completed") {
    return NextResponse.json(
      { error: "Match already completed" },
      { status: 400 }
    );
  }

  if (existing.status === "bye") {
    return NextResponse.json({ error: "Cannot score a bye match" }, { status: 400 });
  }

  if (!existing.team1Id || !existing.team2Id) {
    return NextResponse.json(
      { error: "Both teams must be assigned" },
      { status: 400 }
    );
  }

  const draftCheck = await assertMatchReadyForScoring(matchId);
  if (!draftCheck.ok) {
    return NextResponse.json(
      { error: "draft_incomplete", message: draftCheck.error },
      { status: draftCheck.status }
    );
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      format: true,
      roundSeriesLength: true,
      semiSeriesLength: true,
      finalSeriesLength: true,
    },
  });
  const format = tournament?.format ?? "SINGLE_ELIMINATION";

  const entryCount = await prisma.tournamentEntry.count({
    where: { tournamentId },
  });
  const bracketSize = getBracketSize(entryCount);

  const seriesLength = getMatchSeriesLength({
    round: existing.round,
    format,
    bracketSize,
    roundSeriesLength: tournament?.roundSeriesLength ?? 1,
    semiSeriesLength: tournament?.semiSeriesLength ?? 1,
    finalSeriesLength: tournament?.finalSeriesLength ?? 1,
  });

  const seriesCheck = validateSeriesScore(score1, score2, seriesLength);
  if (!seriesCheck.ok) {
    return NextResponse.json(
      {
        error: seriesCheck.reason,
        seriesLength,
        winsNeeded: Math.ceil(seriesLength / 2),
      },
      { status: 400 }
    );
  }

  const winnerId = resolveWinnerId(
    existing.team1Id,
    existing.team2Id,
    score1,
    score2,
    explicitWinnerId
  );

  if (!winnerId) {
    return NextResponse.json(
      { error: "Scores must differ to determine a winner" },
      { status: 400 }
    );
  }

  if (
    explicitWinnerId &&
    explicitWinnerId !== existing.team1Id &&
    explicitWinnerId !== existing.team2Id
  ) {
    return NextResponse.json({ error: "Invalid winner" }, { status: 400 });
  }

  const loserId =
    existing.team1Id === winnerId ? existing.team2Id : existing.team1Id;

  const match = await prisma.$transaction(async (tx) => {
    const updated = await tx.match.update({
      where: { id: matchId },
      data: {
        score1,
        score2,
        winnerId,
        status: "completed",
        playedAt: new Date(),
      },
    });

    await updateEntryStats(tx, tournamentId, winnerId, loserId);
    await propagateAdvancement(
      tx,
      tournamentId,
      updated,
      bracketSize,
      format
    );

    return updated;
  });

  await syncTournamentMatchDrafts(tournamentId);
  await tryCompleteTournamentAndDistributePrizes(tournamentId);

  return NextResponse.json(match);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: tournamentId } = await params;

  if (!(await canManageScores(tournamentId, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  const match = await prisma.match.create({
    data: {
      tournamentId,
      round: body.round,
      matchNumber: body.matchNumber,
      team1Id: body.team1Id,
      team2Id: body.team2Id,
    },
  });

  return NextResponse.json(match, { status: 201 });
}
