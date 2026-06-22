import { getBracketSize } from "@/lib/bracket";
import { syncDraftPhase } from "@/lib/draft-actions";
import { getDraftCompleteMap } from "@/lib/draft-match-status";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import {
  resolveTournamentPlacements,
  type BracketMatchRow,
} from "@/lib/tournament-placements";

export async function getUserRegisteredTournaments(userId: string) {
  return withPrismaRetry(async () => {
    const memberships = await prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    });
    const teamIds = memberships.map((m) => m.teamId);

    return prisma.tournamentEntry.findMany({
      where: {
        OR: [{ userId }, ...(teamIds.length > 0 ? [{ teamId: { in: teamIds } }] : [])],
      },
      include: {
        tournament: {
          select: { id: true, title: true, status: true, type: true },
        },
        team: { select: { id: true, name: true, tag: true } },
      },
      orderBy: { registeredAt: "desc" },
    });
  });
}

export type CaptainDashboardItem = {
  tournamentId: string;
  tournamentTitle: string;
  tournamentStatus: string;
  myTeam: { id: string; name: string; tag: string | null };
  focus: "active_match" | "upcoming_match" | "champion" | "eliminated";
  matchId?: string;
  matchRound?: number;
  matchNumber?: number;
  opponent?: { id: string; name: string; tag: string | null };
  captainToken?: string;
  isActive?: boolean;
  draftComplete?: boolean;
  currentPhase?: string;
  placement?: number;
};

/** @deprecated Use CaptainDashboardItem */
export type CaptainDraftItem = CaptainDashboardItem;

type MatchWithTeams = {
  id: string;
  tournamentId: string;
  round: number;
  matchNumber: number;
  status: string;
  team1Id: string | null;
  team2Id: string | null;
  winnerId: string | null;
  team1: { id: string; name: string; tag: string | null } | null;
  team2: { id: string; name: string; tag: string | null } | null;
};

type DraftConfigRow = {
  matchId: string | null;
  isActive: boolean;
  draftCompletedAt: Date | null;
  currentPhase: string;
  team1Id: string | null;
  team2Id: string | null;
  team1Token: string | null;
  team2Token: string | null;
  team1: { id: string; name: string; tag: string | null } | null;
  team2: { id: string; name: string; tag: string | null } | null;
};

function isDraftStillActive(
  matchId: string,
  config: DraftConfigRow | undefined,
  draftCompleteByMatchId: Map<string, boolean>
) {
  if (!config) return false;
  if (config.draftCompletedAt) return false;
  if (draftCompleteByMatchId.get(matchId)) return false;
  return config.isActive;
}

function resolveCaptainFocus(
  teamId: string,
  myTeam: { id: string; name: string; tag: string | null },
  tournament: {
    id: string;
    title: string;
    status: string;
    format: string;
  },
  bracketSize: number,
  matches: MatchWithTeams[],
  configs: DraftConfigRow[],
  draftCompleteByMatchId: Map<string, boolean>
): CaptainDashboardItem | null {
  const configByMatchId = new Map(
    configs
      .filter((c): c is DraftConfigRow & { matchId: string } => !!c.matchId)
      .map((c) => [c.matchId, c])
  );

  const teamMatches = matches.filter(
    (m) => m.team1Id === teamId || m.team2Id === teamId
  );

  const playablePending = teamMatches
    .filter((m) => m.status === "pending" && m.team1Id && m.team2Id)
    .sort((a, b) => {
      const aActive = isDraftStillActive(
        a.id,
        configByMatchId.get(a.id),
        draftCompleteByMatchId
      )
        ? 0
        : 1;
      const bActive = isDraftStillActive(
        b.id,
        configByMatchId.get(b.id),
        draftCompleteByMatchId
      )
        ? 0
        : 1;
      if (aActive !== bActive) return aActive - bActive;
      if (a.round !== b.round) return a.round - b.round;
      return a.matchNumber - b.matchNumber;
    });

  if (playablePending.length > 0) {
    const match = playablePending[0];
    const config = configByMatchId.get(match.id);
    const draftStillActive = isDraftStillActive(
      match.id,
      config,
      draftCompleteByMatchId
    );
    const draftComplete = !!draftCompleteByMatchId.get(match.id) || !!config?.draftCompletedAt;
    const onTeam1 = match.team1Id === teamId;
    const opponent = onTeam1 ? match.team2! : match.team1!;
    const captainToken = config
      ? onTeam1
        ? config.team1Token ?? undefined
        : config.team2Token ?? undefined
      : undefined;

    return {
      tournamentId: tournament.id,
      tournamentTitle: tournament.title,
      tournamentStatus: tournament.status,
      myTeam,
      focus: draftStillActive ? "active_match" : "upcoming_match",
      matchId: match.id,
      matchRound: match.round,
      matchNumber: match.matchNumber,
      opponent,
      captainToken: draftStillActive ? captainToken : undefined,
      isActive: draftStillActive,
      draftComplete,
      currentPhase: config?.currentPhase,
    };
  }

  const bracketRows: BracketMatchRow[] = matches.map((m) => ({
    round: m.round,
    matchNumber: m.matchNumber,
    status: m.status,
    team1Id: m.team1Id,
    team2Id: m.team2Id,
    winnerId: m.winnerId,
  }));

  const placements = resolveTournamentPlacements(
    tournament.format,
    bracketSize,
    bracketRows
  );

  if (placements) {
    if (placements.first === teamId) {
      return {
        tournamentId: tournament.id,
        tournamentTitle: tournament.title,
        tournamentStatus: tournament.status,
        myTeam,
        focus: "champion",
        placement: 1,
      };
    }
    if (placements.second === teamId) {
      return {
        tournamentId: tournament.id,
        tournamentTitle: tournament.title,
        tournamentStatus: tournament.status,
        myTeam,
        focus: "eliminated",
        placement: 2,
      };
    }
    if (placements.third === teamId) {
      return {
        tournamentId: tournament.id,
        tournamentTitle: tournament.title,
        tournamentStatus: tournament.status,
        myTeam,
        focus: "eliminated",
        placement: 3,
      };
    }
    if (teamMatches.some((m) => m.status === "completed")) {
      return {
        tournamentId: tournament.id,
        tournamentTitle: tournament.title,
        tournamentStatus: tournament.status,
        myTeam,
        focus: "eliminated",
      };
    }
  }

  const hasPendingSlot = teamMatches.some((m) => m.status === "pending");
  if (!hasPendingSlot && teamMatches.some((m) => m.status === "completed")) {
    const lastCompleted = [...teamMatches]
      .filter((m) => m.status === "completed")
      .sort((a, b) => b.round - a.round || b.matchNumber - a.matchNumber)[0];
    if (lastCompleted?.winnerId && lastCompleted.winnerId !== teamId) {
      return {
        tournamentId: tournament.id,
        tournamentTitle: tournament.title,
        tournamentStatus: tournament.status,
        myTeam,
        focus: "eliminated",
      };
    }
  }

  return null;
}

function sortDashboardItems(items: CaptainDashboardItem[]) {
  const priority = (item: CaptainDashboardItem) => {
    if (item.focus === "active_match") return 0;
    if (item.focus === "upcoming_match") return 1;
    if (item.focus === "champion") return 2;
    return 3;
  };

  return items.sort((a, b) => {
    const p = priority(a) - priority(b);
    if (p !== 0) return p;
    return a.tournamentTitle.localeCompare(b.tournamentTitle);
  });
}

async function getCaptainDashboardItems(
  userId: string,
  tournamentId?: string
): Promise<CaptainDashboardItem[]> {
  return withPrismaRetry(async () => {
    const entries = await prisma.tournamentEntry.findMany({
      where: {
        team: { captainId: userId },
        tournament: {
          status: { in: ["IN_PROGRESS", "COMPLETED"] },
          ...(tournamentId ? { id: tournamentId } : {}),
        },
      },
      include: {
        team: { select: { id: true, name: true, tag: true } },
        tournament: {
          select: {
            id: true,
            title: true,
            status: true,
            format: true,
            _count: { select: { entries: true } },
          },
        },
      },
    });

    const tournamentIds = [...new Set(entries.map((e) => e.tournamentId))];

    if (tournamentIds.length === 0) return [];

    const [allMatches, allConfigs] = await Promise.all([
      prisma.match.findMany({
        where: { tournamentId: { in: tournamentIds } },
        select: {
          id: true,
          tournamentId: true,
          round: true,
          matchNumber: true,
          status: true,
          team1Id: true,
          team2Id: true,
          winnerId: true,
          team1: { select: { id: true, name: true, tag: true } },
          team2: { select: { id: true, name: true, tag: true } },
        },
      }),
      prisma.draftConfig.findMany({
        where: {
          tournamentId: { in: tournamentIds },
          matchId: { not: null },
        },
        include: {
          team1: { select: { id: true, name: true, tag: true } },
          team2: { select: { id: true, name: true, tag: true } },
        },
      }),
    ]);

    const matchesByTournament = new Map<string, MatchWithTeams[]>();
    for (const match of allMatches) {
      const list = matchesByTournament.get(match.tournamentId) ?? [];
      list.push(match);
      matchesByTournament.set(match.tournamentId, list);
    }

    const configsByTournament = new Map<string, DraftConfigRow[]>();
    for (const config of allConfigs) {
      const list = configsByTournament.get(config.tournamentId) ?? [];
      list.push(config);
      configsByTournament.set(config.tournamentId, list);
    }

    const draftCompleteByMatchId = new Map<string, boolean>();
    await Promise.all(
      tournamentIds.map(async (tid) => {
        const completeMap = await getDraftCompleteMap(tid);
        for (const [matchId, complete] of completeMap) {
          draftCompleteByMatchId.set(matchId, complete);
        }
      })
    );

    await Promise.all(
      allConfigs
        .filter(
          (config) =>
            config.matchId &&
            config.isActive &&
            draftCompleteByMatchId.get(config.matchId!)
        )
        .map((config) => syncDraftPhase(config.matchId!))
    );

    const items: CaptainDashboardItem[] = [];

    for (const entry of entries) {
      if (!entry.team) continue;
      const { tournament, team } = entry;
      const bracketSize = getBracketSize(tournament._count.entries);
      const focus = resolveCaptainFocus(
        team.id,
        team,
        tournament,
        bracketSize,
        matchesByTournament.get(tournament.id) ?? [],
        configsByTournament.get(tournament.id) ?? [],
        draftCompleteByMatchId
      );
      if (focus) items.push(focus);
    }

    return sortDashboardItems(items);
  });
}

export async function getCaptainDrafts(
  userId: string
): Promise<CaptainDashboardItem[]> {
  return getCaptainDashboardItems(userId);
}

export async function getCaptainDraftForTournament(
  userId: string,
  tournamentId: string
): Promise<CaptainDashboardItem | null> {
  const items = await getCaptainDashboardItems(userId, tournamentId);
  return (
    items.find(
      (i) => i.focus === "active_match" || i.focus === "upcoming_match"
    ) ?? null
  );
}

export async function getCaptainDraftsForTournament(
  userId: string,
  tournamentId: string
): Promise<CaptainDashboardItem[]> {
  const items = await getCaptainDashboardItems(userId, tournamentId);
  return items.length > 0 ? [items[0]] : [];
}
