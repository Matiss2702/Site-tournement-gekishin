import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canManageDraft } from "@/lib/tournament-auth";
import {
  getCaptainTeamIdInTournament,
  getEnrichedTournamentDrafts,
  launchDraftsForRound,
  syncTournamentMatchDrafts,
} from "@/lib/draft-matches";
import { withPrismaRetry } from "@/lib/prisma";

async function resolveDraftsPayload(
  tournamentId: string,
  options: { sync?: boolean; userId?: string | null }
) {
  const canManage = options.userId
    ? await canManageDraft(tournamentId, options.userId)
    : false;

  let participantTeamId: string | null | undefined;
  if (!canManage) {
    participantTeamId = options.userId
      ? await getCaptainTeamIdInTournament(options.userId, tournamentId)
      : null;
  }

  return getEnrichedTournamentDrafts(tournamentId, {
    sync: options.sync,
    ...(participantTeamId !== undefined ? { participantTeamId } : {}),
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params;
  const sync = request.nextUrl.searchParams.get("sync") === "1";
  const session = await auth();

  const { drafts, currentRound } = await withPrismaRetry(() =>
    resolveDraftsPayload(tournamentId, {
      sync,
      userId: session?.user?.id ?? null,
    })
  );

  return NextResponse.json({ drafts, currentRound });
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

  if (!(await canManageDraft(tournamentId, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const action = body.action as string;

  if (action === "sync") {
    await syncTournamentMatchDrafts(tournamentId);
    const { drafts } = await resolveDraftsPayload(tournamentId, {
      userId: session.user.id,
    });
    return NextResponse.json({ drafts });
  }

  if (action === "launch") {
    const round =
      typeof body.round === "number" ? (body.round as number) : undefined;
    const result = await launchDraftsForRound(tournamentId, round);
    const { drafts } = await resolveDraftsPayload(tournamentId, {
      userId: session.user.id,
    });
    return NextResponse.json({ ...result, drafts });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
