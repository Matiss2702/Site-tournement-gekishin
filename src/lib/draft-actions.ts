import { prisma } from "@/lib/prisma";
import { getHeroByName, HEROES } from "@/lib/heroes";
import {
  isBanPhaseCompleteForTeams,
  isPickPhaseCompleteForTeams,
  getBansPerRole,
  getPicksPerRole,
  PICKS_PER_TEAM,
} from "@/lib/draft";
import { getDraftTeamIds } from "@/lib/draft-access";
import {
  getActiveTeamId,
  getPhaseActionCount,
} from "@/lib/draft-turn-order";
import type { GameRole } from "@/components/HeroCard";

function buildHeroRoleMap(
  actions: { heroName: string | null; gameRole: string | null }[]
) {
  const heroRoleByName = new Map(
    HEROES.map((h) => [h.nameEn, h.gameRole as GameRole])
  );
  for (const action of actions) {
    if (action.heroName && action.gameRole) {
      heroRoleByName.set(action.heroName, action.gameRole as GameRole);
    }
  }
  return heroRoleByName;
}

export async function syncDraftPhase(matchId: string) {
  const draftConfig = await prisma.draftConfig.findUnique({
    where: { matchId },
  });

  if (!draftConfig?.isActive) return draftConfig;

  const actions = await prisma.draftAction_.findMany({
    where: { matchId },
  });
  const teamIds = getDraftTeamIds(draftConfig);
  const heroRoleByName = buildHeroRoleMap(actions);

  if (draftConfig.currentPhase === "HERO_BAN") {
    if (isBanPhaseCompleteForTeams(actions, heroRoleByName, teamIds)) {
      return prisma.draftConfig.update({
        where: { matchId },
        data: { currentPhase: "HERO_PICK", currentTurn: 0 },
      });
    }
  }

  if (draftConfig.currentPhase === "HERO_PICK") {
    if (isPickPhaseCompleteForTeams(actions, heroRoleByName, teamIds)) {
      return prisma.draftConfig.update({
        where: { matchId },
        data: { isActive: false, draftCompletedAt: new Date() },
      });
    }
  }

  return draftConfig;
}

export interface DraftActionInput {
  action: "BAN" | "PICK";
  phase: "HERO_BAN" | "HERO_PICK";
  heroName: string;
  teamId?: string;
  actorId?: string;
}

async function countTeamBansForRole(
  matchId: string,
  teamId: string,
  role: GameRole
) {
  return prisma.draftAction_.count({
    where: { matchId, action: "BAN", teamId, gameRole: role },
  });
}

async function countTeamPicks(
  matchId: string,
  teamId: string,
  role?: GameRole
) {
  return prisma.draftAction_.count({
    where: {
      matchId,
      action: "PICK",
      teamId,
      ...(role ? { gameRole: role } : {}),
    },
  });
}

export async function executeDraftAction(
  matchId: string,
  input: DraftActionInput
) {
  const draftConfig = await prisma.draftConfig.findUnique({
    where: { matchId },
    include: {
      team1: { select: { id: true, name: true, captainId: true } },
      team2: { select: { id: true, name: true, captainId: true } },
    },
  });

  if (!draftConfig?.isActive) {
    return { error: "Draft is not active", status: 400 };
  }

  if (!draftConfig.team1Id || !draftConfig.team2Id) {
    return { error: "Teams not configured", status: 400 };
  }

  const dbHero = await prisma.hero.findFirst({
    where: { nameEn: input.heroName },
  });
  const hero = dbHero ?? getHeroByName(input.heroName);

  if (!hero) {
    return { error: "Hero not found", status: 404 };
  }

  const existingUse = await prisma.draftAction_.findFirst({
    where: {
      matchId,
      heroName: input.heroName,
      action: { in: ["BAN", "PICK"] },
    },
  });

  if (existingUse) {
    return { error: "This hero is already banned or picked", status: 400 };
  }

  const teamIds = getDraftTeamIds(draftConfig);
  const teamId = input.teamId;

  if (teamIds.length > 0 && !teamId) {
    return { error: "Team is required", status: 400 };
  }

  if (teamId && !teamIds.includes(teamId)) {
    return { error: "Invalid team for this draft", status: 400 };
  }

  const existingActions = await prisma.draftAction_.findMany({
    where: { matchId },
    orderBy: { order: "asc" },
  });

  const phase = input.phase;
  const activeTeamId = getActiveTeamId(
    phase,
    existingActions,
    draftConfig.team1Id,
    draftConfig.team2Id
  );

  if (!activeTeamId) {
    return { error: "Phase is already complete", status: 400 };
  }

  if (teamId && teamId !== activeTeamId) {
    return { error: "Not your turn", status: 400 };
  }

  if (input.action === "BAN") {
    if (draftConfig.currentPhase !== "HERO_BAN") {
      return { error: "Not in ban phase", status: 400 };
    }

    if (teamId) {
      const role = hero.gameRole as GameRole;
      const roleBanCount = await countTeamBansForRole(matchId, teamId, role);
      if (roleBanCount >= getBansPerRole(role)) {
        return {
          error: `Ban quota reached for ${hero.gameRole}`,
          status: 400,
        };
      }
    }
  }

  if (input.action === "PICK") {
    if (draftConfig.currentPhase !== "HERO_PICK") {
      return { error: "Not in pick phase", status: 400 };
    }

    if (teamId) {
      const teamPickTotal = await countTeamPicks(matchId, teamId);
      if (teamPickTotal >= PICKS_PER_TEAM) {
        return { error: "Pick quota reached for your team", status: 400 };
      }

      const role = hero.gameRole as GameRole;
      const rolePickCount = await countTeamPicks(matchId, teamId, role);
      if (rolePickCount >= getPicksPerRole(role)) {
        return {
          error: `Pick quota reached for ${hero.gameRole}`,
          status: 400,
        };
      }
    }
  }

  const actionCount = await prisma.draftAction_.count({
    where: { matchId },
  });

  const action = await prisma.draftAction_.create({
    data: {
      tournamentId: draftConfig.tournamentId,
      matchId,
      phase: input.phase,
      action: input.action,
      order: actionCount + 1,
      teamId: teamId ?? null,
      actorId: input.actorId ?? null,
      gameRole: hero.gameRole,
      heroName: input.heroName,
    },
    include: {
      team: { select: { id: true, name: true } },
      actor: { select: { id: true, username: true } },
    },
  });

  await prisma.draftConfig.update({
    where: { matchId },
    data: {
      currentTurn: getPhaseActionCount(
        [...existingActions, action],
        phase
      ),
    },
  });

  const allActions = await prisma.draftAction_.findMany({
    where: { matchId },
  });
  const heroRoleByName = buildHeroRoleMap(allActions);

  if (input.action === "BAN") {
    if (isBanPhaseCompleteForTeams(allActions, heroRoleByName, teamIds)) {
      await prisma.draftConfig.update({
        where: { matchId },
        data: { currentPhase: "HERO_PICK", currentTurn: 0 },
      });
    }
  }

  if (input.action === "PICK") {
    if (isPickPhaseCompleteForTeams(allActions, heroRoleByName, teamIds)) {
      await prisma.draftConfig.update({
        where: { matchId },
        data: { isActive: false, draftCompletedAt: new Date() },
      });
    }
  }

  return { action, status: 201 };
}

export async function getDraftPayload(matchId: string) {
  await syncDraftPhase(matchId);

  const draft = await prisma.draftConfig.findUnique({
    where: { matchId },
    include: {
      team1: { select: { id: true, name: true, tag: true, captainId: true } },
      team2: { select: { id: true, name: true, tag: true, captainId: true } },
      match: { select: { id: true, round: true, matchNumber: true, status: true } },
    },
  });

  const actions = await prisma.draftAction_.findMany({
    where: { matchId },
    orderBy: { order: "asc" },
    include: {
      team: { select: { id: true, name: true } },
      actor: { select: { id: true, username: true } },
    },
  });

  const entries = draft
    ? await prisma.tournamentEntry.findMany({
        where: {
          tournamentId: draft.tournamentId,
          teamId: { not: null },
        },
        include: { team: { select: { id: true, name: true, tag: true } } },
      })
    : [];

  const phase =
    draft?.currentPhase === "HERO_PICK" ? "HERO_PICK" : "HERO_BAN";

  const activeTeamId =
    draft?.isActive && draft.team1Id && draft.team2Id
      ? getActiveTeamId(phase, actions, draft.team1Id, draft.team2Id)
      : null;

  const activeTeam =
    activeTeamId === draft?.team1Id
      ? draft?.team1
      : activeTeamId === draft?.team2Id
        ? draft?.team2
        : null;

  return {
    config: draft,
    actions,
    entries,
    turn: {
      activeTeamId,
      activeTeamName: activeTeam?.name ?? null,
      phaseActionIndex: getPhaseActionCount(actions, phase),
      phaseActionTotal:
        phase === "HERO_BAN" ? 8 : 8,
    },
  };
}
