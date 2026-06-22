import type { GameRole } from "@/components/HeroCard";
import {
  getBansPerRole,
  getPicksPerRole,
  PICKS_PER_TEAM,
} from "@/lib/draft-turn-order";

type DraftActionLike = {
  action: string;
  phase?: string;
  gameRole: string | null;
  heroName: string | null;
  teamId?: string | null;
};

const ROLES: GameRole[] = ["TANK", "SUPPORT", "DPS"];

export function countHeroBansByRole(
  actions: DraftActionLike[],
  heroRoleByName: Map<string, GameRole>,
  teamId?: string
): Record<GameRole, number> {
  const counts: Record<GameRole, number> = { TANK: 0, SUPPORT: 0, DPS: 0 };

  for (const action of actions) {
    if (action.action !== "BAN" || !action.heroName) continue;
    if (teamId && action.teamId !== teamId) continue;

    const role =
      (action.gameRole as GameRole | null) ??
      heroRoleByName.get(action.heroName);
    if (role) counts[role]++;
  }

  return counts;
}

export function countHeroPicksByRole(
  actions: DraftActionLike[],
  heroRoleByName: Map<string, GameRole>,
  teamId?: string
): Record<GameRole, number> {
  const counts: Record<GameRole, number> = { TANK: 0, SUPPORT: 0, DPS: 0 };

  for (const action of actions) {
    if (action.action !== "PICK" || !action.heroName) continue;
    if (teamId && action.teamId !== teamId) continue;

    const role =
      (action.gameRole as GameRole | null) ??
      heroRoleByName.get(action.heroName);
    if (role) counts[role]++;
  }

  return counts;
}

export function isBanPhaseCompleteForTeam(
  actions: DraftActionLike[],
  heroRoleByName: Map<string, GameRole>,
  teamId: string
) {
  const counts = countHeroBansByRole(actions, heroRoleByName, teamId);
  return ROLES.every((role) => counts[role] >= getBansPerRole(role));
}

export function isBanPhaseCompleteForTeams(
  actions: DraftActionLike[],
  heroRoleByName: Map<string, GameRole>,
  teamIds: string[]
): boolean {
  if (teamIds.length === 0) {
    const counts = countHeroBansByRole(actions, heroRoleByName);
    return ROLES.every((role) => counts[role] >= getBansPerRole(role));
  }

  return teamIds.every((teamId) =>
    isBanPhaseCompleteForTeam(actions, heroRoleByName, teamId)
  );
}

export function isPickPhaseCompleteForTeam(
  actions: DraftActionLike[],
  heroRoleByName: Map<string, GameRole>,
  teamId: string
) {
  const counts = countHeroPicksByRole(actions, heroRoleByName, teamId);
  return ROLES.every((role) => counts[role] >= getPicksPerRole(role));
}

export function isPickPhaseCompleteForTeams(
  actions: DraftActionLike[],
  heroRoleByName: Map<string, GameRole>,
  teamIds: string[]
): boolean {
  if (teamIds.length === 0) {
    const totalPicks = actions.filter((a) => a.action === "PICK").length;
    return totalPicks >= PICKS_PER_TEAM;
  }

  return teamIds.every((teamId) =>
    isPickPhaseCompleteForTeam(actions, heroRoleByName, teamId)
  );
}

export function canPickHeroForTeam(
  role: GameRole,
  pickCounts: Record<GameRole, number>,
  teamPickTotal: number
): boolean {
  if (teamPickTotal >= PICKS_PER_TEAM) return false;
  return pickCounts[role] < getPicksPerRole(role);
}

export { getBansPerRole, getPicksPerRole, PICKS_PER_TEAM } from "@/lib/draft-turn-order";
