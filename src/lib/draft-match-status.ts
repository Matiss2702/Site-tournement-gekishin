import { prisma } from "@/lib/prisma";
import { HEROES } from "@/lib/heroes";
import { isPickPhaseCompleteForTeams } from "@/lib/draft";
import { getDraftTeamIds } from "@/lib/draft-access";
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

export async function isMatchDraftComplete(matchId: string) {
  const config = await prisma.draftConfig.findUnique({
    where: { matchId },
    select: {
      isActive: true,
      draftCompletedAt: true,
      picksPerTeam: true,
      team1Id: true,
      team2Id: true,
    },
  });

  if (!config) return false;
  if (config.draftCompletedAt) return true;

  const actions = await prisma.draftAction_.findMany({
    where: { matchId },
    select: { heroName: true, gameRole: true, action: true },
  });
  if (actions.length === 0) return false;

  const teamIds = getDraftTeamIds(config);
  const heroRoleByName = buildHeroRoleMap(actions);
  return isPickPhaseCompleteForTeams(actions, heroRoleByName, teamIds);
}

export async function getDraftCompleteMap(tournamentId: string) {
  const configs = await prisma.draftConfig.findMany({
    where: { tournamentId, matchId: { not: null } },
    select: {
      matchId: true,
      isActive: true,
      draftCompletedAt: true,
      picksPerTeam: true,
      team1Id: true,
      team2Id: true,
    },
  });

  const matchIds = configs
    .map((c) => c.matchId)
    .filter((id): id is string => !!id);

  const actionsByMatch = new Map<
    string,
    { heroName: string | null; gameRole: string | null; action: string }[]
  >();

  if (matchIds.length > 0) {
    const actions = await prisma.draftAction_.findMany({
      where: { matchId: { in: matchIds } },
      select: {
        matchId: true,
        heroName: true,
        gameRole: true,
        action: true,
      },
    });
    for (const action of actions) {
      if (!action.matchId) continue;
      const list = actionsByMatch.get(action.matchId) ?? [];
      list.push(action);
      actionsByMatch.set(action.matchId, list);
    }
  }

  const result = new Map<string, boolean>();

  for (const config of configs) {
    if (!config.matchId) continue;
    if (config.draftCompletedAt) {
      result.set(config.matchId, true);
      continue;
    }

    const actions = actionsByMatch.get(config.matchId) ?? [];
    if (actions.length === 0) {
      result.set(config.matchId, false);
      continue;
    }

    const teamIds = getDraftTeamIds(config);
    const heroRoleByName = buildHeroRoleMap(actions);
    result.set(
      config.matchId,
      isPickPhaseCompleteForTeams(actions, heroRoleByName, teamIds)
    );
  }

  return result;
}

export async function assertMatchReadyForScoring(matchId: string) {
  const complete = await isMatchDraftComplete(matchId);
  if (!complete) {
    return {
      ok: false as const,
      error: "Draft must be completed before entering scores",
      status: 400,
    };
  }
  return { ok: true as const };
}
