import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { canManageScores } from "@/lib/tournament-auth";
import {
  buildRandomRound1Pairings,
  getBracketSize,
  getUnassignedParticipantIds,
  type BracketParticipant,
} from "@/lib/bracket";
import {
  advanceByeWinner,
  ensureBracketStructure,
  getWinnersRoundCount,
} from "@/lib/bracket-progression";
import { syncTournamentMatchDrafts } from "@/lib/draft-matches";
import { getDraftCompleteMap } from "@/lib/draft-match-status";
import {
  getMatchSeriesLength,
  winsNeededForSeries,
} from "@/lib/match-series";

type EntryWithRelations = {
  teamId: string | null;
  userId: string | null;
  team: { id: string; name: string; tag: string | null } | null;
  user: { id: string; username: string } | null;
};

const matchInclude = {
  team1: { select: { id: true, name: true, tag: true } },
  team2: { select: { id: true, name: true, tag: true } },
} as const;

function entryToParticipant(entry: EntryWithRelations): BracketParticipant | null {
  if (entry.team) {
    return { id: entry.team.id, name: entry.team.name, tag: entry.team.tag };
  }
  if (entry.user) {
    return { id: entry.user.id, name: entry.user.username, tag: null };
  }
  return null;
}

function participantIdFromEntry(entry: EntryWithRelations) {
  return entry.teamId ?? entry.userId;
}

async function loadBracketData(tournamentId: string) {
  return withPrismaRetry(async () => {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        format: true,
        roundSeriesLength: true,
        semiSeriesLength: true,
        finalSeriesLength: true,
      },
    });

    const entries = await prisma.tournamentEntry.findMany({
      where: { tournamentId },
      include: {
        team: { select: { id: true, name: true, tag: true } },
        user: { select: { id: true, username: true } },
      },
    });

    const participants = entries
      .map(entryToParticipant)
      .filter((p): p is BracketParticipant => !!p);

    const participantIds = entries
      .map(participantIdFromEntry)
      .filter((id): id is string => !!id);

    const allMatches = await prisma.match.findMany({
      where: { tournamentId },
      orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
      include: matchInclude,
    });

    const round1Matches = allMatches.filter((m) => m.round === 1);

    const unassignedIds = getUnassignedParticipantIds(
      participantIds,
      round1Matches.map((m) => ({ team1Id: m.team1Id, team2Id: m.team2Id }))
    );

    return {
      format: tournament?.format ?? "SINGLE_ELIMINATION",
      roundSeriesLength: tournament?.roundSeriesLength ?? 1,
      semiSeriesLength: tournament?.semiSeriesLength ?? 1,
      finalSeriesLength: tournament?.finalSeriesLength ?? 1,
      participants,
      participantIds,
      matches: allMatches,
      round1Matches,
      unassignedIds,
    };
  });
}

function serializeMatches(
  data: Awaited<ReturnType<typeof loadBracketData>>,
  draftCompleteMap: Map<string, boolean>
) {
  const bracketSize = getBracketSize(data.participantIds.length);
  const seriesCtx = {
    format: data.format,
    bracketSize,
    roundSeriesLength: data.roundSeriesLength,
    semiSeriesLength: data.semiSeriesLength,
    finalSeriesLength: data.finalSeriesLength,
  };

  return data.matches.map((m) => {
    const seriesLength = getMatchSeriesLength({
      round: m.round,
      ...seriesCtx,
    });
    return {
      id: m.id,
      round: m.round,
      matchNumber: m.matchNumber,
      status: m.status,
      score1: m.score1,
      score2: m.score2,
      winnerId: m.winnerId,
      team1: m.team1,
      team2: m.team2,
      seriesLength,
      winsNeeded: winsNeededForSeries(seriesLength),
      draftComplete: draftCompleteMap.get(m.id) ?? false,
    };
  });
}

async function buildBracketResponse(
  tournamentId: string,
  data: Awaited<ReturnType<typeof loadBracketData>>
) {
  const draftCompleteMap = await getDraftCompleteMap(tournamentId);
  return {
    format: data.format,
    roundSeriesLength: data.roundSeriesLength,
    semiSeriesLength: data.semiSeriesLength,
    finalSeriesLength: data.finalSeriesLength,
    participants: data.participants,
    matches: serializeMatches(data, draftCompleteMap),
    unassignedIds: data.unassignedIds,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params;
  let data = await loadBracketData(tournamentId);

  if (data.participantIds.length >= 2 && data.matches.length > 0) {
    const bracketSize = getBracketSize(data.participantIds.length);
    const wbRounds = getWinnersRoundCount(bracketSize);
    const hasLaterRound = data.matches.some((m) => m.round > 1 || m.round < 0);

    if (!hasLaterRound && wbRounds > 1) {
      await prisma.$transaction(async (tx) => {
        await ensureBracketStructure(
          tx,
          tournamentId,
          data.participantIds.length,
          data.format
        );
      });
      data = await loadBracketData(tournamentId);
    }
  }

  return NextResponse.json(await buildBracketResponse(tournamentId, data));
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
  const action = body.action as string;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { format: true },
  });
  const format = tournament?.format ?? "SINGLE_ELIMINATION";

  if (action === "randomize") {
    const { participantIds } = await loadBracketData(tournamentId);

    if (participantIds.length < 2) {
      return NextResponse.json(
        { error: "At least 2 participants required" },
        { status: 400 }
      );
    }

    const completedCount = await prisma.match.count({
      where: { tournamentId, status: "completed" },
    });

    if (completedCount > 0) {
      return NextResponse.json(
        { error: "Cannot reshuffle after matches are completed" },
        { status: 400 }
      );
    }

    const pairings = buildRandomRound1Pairings(participantIds);
    const bracketSize = getBracketSize(participantIds.length);

    await prisma.$transaction(async (tx) => {
      await tx.match.deleteMany({ where: { tournamentId } });

      await ensureBracketStructure(
        tx,
        tournamentId,
        participantIds.length,
        format
      );

      for (let i = 0; i < pairings.length; i++) {
        const pairing = pairings[i];
        const isBye = !pairing.team2Id;

        const match = await tx.match.update({
          where: {
            id: (
              await tx.match.findFirstOrThrow({
                where: {
                  tournamentId,
                  round: 1,
                  matchNumber: i + 1,
                },
              })
            ).id,
          },
          data: {
            team1Id: pairing.team1Id,
            team2Id: pairing.team2Id,
            status: isBye ? "bye" : "pending",
          },
        });

        if (isBye) {
          await advanceByeWinner(
            tx,
            tournamentId,
            match,
            bracketSize,
            format
          );
        }
      }
    });
  } else if (action === "init") {
    const { participantIds } = await loadBracketData(tournamentId);

    if (participantIds.length < 2) {
      return NextResponse.json(
        { error: "At least 2 participants required" },
        { status: 400 }
      );
    }

    const existing = await prisma.match.count({ where: { tournamentId } });

    if (existing > 0) {
      return NextResponse.json(
        { error: "Bracket already exists" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await ensureBracketStructure(
        tx,
        tournamentId,
        participantIds.length,
        format
      );
    });
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const data = await loadBracketData(tournamentId);
  await syncTournamentMatchDrafts(tournamentId);
  return NextResponse.json(await buildBracketResponse(tournamentId, data));
}

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

  if (body.score1 !== undefined) {
    return NextResponse.json(
      { error: "Use /api/tournaments/[id]/matches for scores" },
      { status: 400 }
    );
  }

  const matchId = body.matchId as string | undefined;
  const slot = body.slot as "team1" | "team2" | undefined;
  const teamId = (body.teamId as string | null) ?? null;

  if (!matchId || !slot || (slot !== "team1" && slot !== "team2")) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const match = await prisma.match.findFirst({
    where: { id: matchId, tournamentId, round: 1 },
  });

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  if (match.status === "completed") {
    return NextResponse.json(
      { error: "Cannot edit completed match" },
      { status: 400 }
    );
  }

  const { participantIds } = await loadBracketData(tournamentId);

  if (teamId && !participantIds.includes(teamId)) {
    return NextResponse.json({ error: "Invalid participant" }, { status: 400 });
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { format: true },
  });
  const format = tournament?.format ?? "SINGLE_ELIMINATION";
  const bracketSize = getBracketSize(participantIds.length);

  await prisma.$transaction(async (tx) => {
    const round1 = await tx.match.findMany({
      where: { tournamentId, round: 1, status: { not: "completed" } },
    });

    for (const m of round1) {
      if (m.id === matchId) continue;
      const clearsTeam1 = teamId && m.team1Id === teamId;
      const clearsTeam2 = teamId && m.team2Id === teamId;
      if (!clearsTeam1 && !clearsTeam2) continue;

      await tx.match.update({
        where: { id: m.id },
        data: {
          team1Id: clearsTeam1 ? null : m.team1Id,
          team2Id: clearsTeam2 ? null : m.team2Id,
        },
      });
    }

    const current = await tx.match.findUnique({ where: { id: matchId } });
    if (!current) return;

    let nextTeam1 = slot === "team1" ? teamId : current.team1Id;
    let nextTeam2 = slot === "team2" ? teamId : current.team2Id;

    if (teamId) {
      if (current.team1Id === teamId && slot === "team2") nextTeam1 = null;
      if (current.team2Id === teamId && slot === "team1") nextTeam2 = null;
    }

    let status = "pending";
    if (nextTeam1 && !nextTeam2) status = "bye";
    if (!nextTeam1 && !nextTeam2) status = "pending";

    const updated = await tx.match.update({
      where: { id: matchId },
      data: {
        team1Id: nextTeam1,
        team2Id: nextTeam2,
        status,
        winnerId: null,
        score1: 0,
        score2: 0,
      },
    });

    if (status === "bye" && nextTeam1) {
      await advanceByeWinner(
        tx,
        tournamentId,
        updated,
        bracketSize,
        format
      );
    }
  });

  const data = await loadBracketData(tournamentId);
  await syncTournamentMatchDrafts(tournamentId);
  return NextResponse.json(await buildBracketResponse(tournamentId, data));
}
