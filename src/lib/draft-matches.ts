import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { newTokens } from "@/lib/draft-tokens";
import { getDraftCompleteMap } from "@/lib/draft-match-status";

type Tx = Prisma.TransactionClient;

const draftInclude = {
  team1: { select: { id: true, name: true, tag: true, captainId: true } },
  team2: { select: { id: true, name: true, tag: true, captainId: true } },
  match: {
    select: {
      id: true,
      round: true,
      matchNumber: true,
      status: true,
      winnerId: true,
      winner: { select: { id: true, name: true, tag: true } },
    },
  },
} as const;

export type DraftableMatch = {
  id: string;
  round: number;
  matchNumber: number;
  status: string;
  team1Id: string | null;
  team2Id: string | null;
};

export function isMatchDraftable(match: DraftableMatch) {
  return (
    !!match.team1Id &&
    !!match.team2Id &&
    match.status !== "completed" &&
    match.status !== "bye"
  );
}

export function getCurrentDraftRound(matches: DraftableMatch[]): number | null {
  const draftable = matches.filter(isMatchDraftable);
  if (draftable.length === 0) return null;

  const wb = draftable.filter((m) => m.round > 0);
  if (wb.length > 0) return Math.min(...wb.map((m) => m.round));

  const lb = draftable.filter((m) => m.round < 0);
  if (lb.length > 0) return Math.max(...lb.map((m) => m.round));

  const gf = draftable.filter((m) => m.round === 0);
  if (gf.length > 0) return 0;

  return null;
}

export function formatDraftRoundLabel(round: number) {
  if (round === 0) return "grandFinal";
  if (round < 0) return `losersRound:${Math.abs(round)}`;
  if (round === 1) return "tour1";
  return `round:${round}`;
}

export async function ensureMatchDraft(
  client: Tx | typeof prisma,
  params: {
    tournamentId: string;
    matchId: string;
    team1Id: string | null;
    team2Id: string | null;
  }
) {
  const { tournamentId, matchId, team1Id, team2Id } = params;

  if (!team1Id || !team2Id) return null;

  const existing = await client.draftConfig.findUnique({
    where: { matchId },
    include: draftInclude,
  });

  if (existing) {
    if (existing.isActive) return existing;
    return client.draftConfig.update({
      where: { id: existing.id },
      data: { team1Id, team2Id },
      include: draftInclude,
    });
  }

  try {
    return await client.draftConfig.create({
      data: {
        tournamentId,
        matchId,
        team1Id,
        team2Id,
        ...newTokens(),
      },
      include: draftInclude,
    });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    if (code !== "P2002") throw error;

    const raced = await client.draftConfig.findUnique({
      where: { matchId },
      include: draftInclude,
    });
    if (!raced) throw error;
    if (raced.isActive) return raced;
    return client.draftConfig.update({
      where: { id: raced.id },
      data: { team1Id, team2Id },
      include: draftInclude,
    });
  }
}

export async function syncTournamentMatchDrafts(tournamentId: string) {
  const matches = await prisma.match.findMany({
    where: { tournamentId },
    select: {
      id: true,
      round: true,
      matchNumber: true,
      status: true,
      team1Id: true,
      team2Id: true,
    },
  });

  for (const match of matches) {
    if (!isMatchDraftable(match)) continue;
    await ensureMatchDraft(prisma, {
      tournamentId,
      matchId: match.id,
      team1Id: match.team1Id,
      team2Id: match.team2Id,
    });
  }
}

export async function launchDraftsForRound(
  tournamentId: string,
  round?: number
) {
  const matches = await prisma.match.findMany({
    where: { tournamentId },
    select: {
      id: true,
      round: true,
      matchNumber: true,
      status: true,
      team1Id: true,
      team2Id: true,
    },
  });

  const targetRound = round ?? getCurrentDraftRound(matches);
  if (targetRound == null) {
    return { launched: 0, round: null };
  }

  const roundMatches = matches.filter(
    (m) => m.round === targetRound && isMatchDraftable(m)
  );

  let launched = 0;

  await prisma.$transaction(async (tx) => {
    for (const match of roundMatches) {
      const config = await ensureMatchDraft(tx, {
        tournamentId,
        matchId: match.id,
        team1Id: match.team1Id,
        team2Id: match.team2Id,
      });
      if (!config || config.isActive) continue;

      await tx.draftConfig.update({
        where: { id: config.id },
        data: {
          isActive: true,
          currentPhase: "HERO_BAN",
          currentTurn: 0,
        },
      });
      launched++;
    }
  });

  return { launched, round: targetRound };
}

export async function findDraftConfigByToken(
  tournamentId: string,
  token: string
) {
  return prisma.draftConfig.findFirst({
    where: {
      tournamentId,
      OR: [
        { spectatorToken: token },
        { team1Token: token },
        { team2Token: token },
      ],
    },
    include: {
      ...draftInclude,
      tournament: { select: { id: true, title: true } },
    },
  });
}

export async function listTournamentDrafts(
  tournamentId: string,
  options?: { sync?: boolean }
) {
  const existing = await prisma.draftConfig.count({
    where: { tournamentId, matchId: { not: null } },
  });

  if (options?.sync || existing === 0) {
    await syncTournamentMatchDrafts(tournamentId);
  }

  return prisma.draftConfig.findMany({
    where: { tournamentId, matchId: { not: null } },
    include: draftInclude,
    orderBy: [{ match: { round: "asc" } }, { match: { matchNumber: "asc" } }],
  });
}

export type EnrichedTournamentDraft = Awaited<
  ReturnType<typeof listTournamentDrafts>
>[number] & {
  draftComplete: boolean;
};

export async function getCaptainTeamIdInTournament(
  userId: string,
  tournamentId: string
) {
  const entry = await prisma.tournamentEntry.findFirst({
    where: {
      tournamentId,
      team: { captainId: userId },
    },
    select: { teamId: true },
  });
  return entry?.teamId ?? null;
}

export function filterDraftsForParticipant(
  drafts: EnrichedTournamentDraft[],
  matches: DraftableMatch[],
  teamId: string | null
): EnrichedTournamentDraft[] {
  if (!teamId) {
    return drafts.filter((d) => d.isActive);
  }

  const myDrafts = drafts.filter(
    (d) => d.team1?.id === teamId || d.team2?.id === teamId
  );

  if (myDrafts.length === 0) {
    return drafts.filter((d) => d.isActive);
  }

  const active = myDrafts.find((d) => d.isActive);
  if (active) return [active];

  const currentRound = getCurrentDraftRound(matches);

  const upcoming = myDrafts
    .filter((d) => {
      if (!d.match || d.draftComplete) return false;
      if (d.match.status === "completed" || d.match.status === "bye") {
        return false;
      }
      if (currentRound != null && d.match.round !== currentRound) return false;
      return d.match.status === "pending";
    })
    .sort((a, b) => {
      const ar = a.match!.round;
      const br = b.match!.round;
      if (ar !== br) return ar - br;
      return a.match!.matchNumber - b.match!.matchNumber;
    });

  if (upcoming.length > 0) return [upcoming[0]];

  const finished = [...myDrafts]
    .filter((d) => d.draftComplete || d.match?.status === "completed")
    .sort((a, b) => {
      const ar = a.match?.round ?? 0;
      const br = b.match?.round ?? 0;
      if (ar !== br) return br - ar;
      return (b.match?.matchNumber ?? 0) - (a.match?.matchNumber ?? 0);
    });

  if (finished.length > 0) return [finished[0]];

  return [];
}

export async function getEnrichedTournamentDrafts(
  tournamentId: string,
  options?: {
    sync?: boolean;
    participantTeamId?: string | null;
  }
) {
  const matches = await prisma.match.findMany({
    where: { tournamentId },
    select: {
      id: true,
      round: true,
      matchNumber: true,
      status: true,
      team1Id: true,
      team2Id: true,
    },
  });

  const drafts = await listTournamentDrafts(tournamentId, options);
  const draftCompleteMap = await getDraftCompleteMap(tournamentId);

  const enriched: EnrichedTournamentDraft[] = drafts.map((d) => ({
    ...d,
    draftComplete: d.matchId
      ? (draftCompleteMap.get(d.matchId) ?? false)
      : false,
  }));

  const filtered =
    options && "participantTeamId" in options
      ? filterDraftsForParticipant(
          enriched,
          matches,
          options.participantTeamId ?? null
        )
      : enriched;

  return {
    drafts: filtered,
    matches,
    currentRound: getCurrentDraftRound(matches),
  };
}
