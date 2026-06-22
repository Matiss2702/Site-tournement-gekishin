import type { GameRole } from "@/components/HeroCard";

export const PICKS_PER_TEAM = 4;
export const BANS_PER_TEAM = 4;

const BANS_PER_ROLE: Record<GameRole, number> = {
  TANK: 1,
  SUPPORT: 1,
  DPS: 2,
};

const PICKS_PER_ROLE: Record<GameRole, number> = {
  TANK: 1,
  SUPPORT: 1,
  DPS: 2,
};

type DraftActionLike = {
  action: string;
  phase?: string;
  teamId?: string | null;
};

export function getBansPerRole(role: GameRole) {
  return BANS_PER_ROLE[role];
}

export function getPicksPerRole(role: GameRole) {
  return PICKS_PER_ROLE[role];
}

/** Team1 (top slot) alternates first in ban phase. */
export function getBanTurnSequence(team1Id: string, team2Id: string) {
  const sequence: string[] = [];
  for (let i = 0; i < BANS_PER_TEAM * 2; i++) {
    sequence.push(i % 2 === 0 ? team1Id : team2Id);
  }
  return sequence;
}

/**
 * Pick order: T1×1 → T2×2 → T1×2 → T2×2 → T1×1 (4 picks each).
 * Team1 is the top team in the bracket.
 */
export function getPickTurnSequence(team1Id: string, team2Id: string) {
  const blocks = [
    { teamId: team1Id, count: 1 },
    { teamId: team2Id, count: 2 },
    { teamId: team1Id, count: 2 },
    { teamId: team2Id, count: 2 },
    { teamId: team1Id, count: 1 },
  ];

  const sequence: string[] = [];
  for (const block of blocks) {
    for (let i = 0; i < block.count; i++) {
      sequence.push(block.teamId);
    }
  }
  return sequence;
}

function phaseActions(
  actions: DraftActionLike[],
  phase: "HERO_BAN" | "HERO_PICK"
) {
  const kind = phase === "HERO_BAN" ? "BAN" : "PICK";
  return actions.filter((a) => a.action === kind);
}

export function getPhaseActionCount(
  actions: DraftActionLike[],
  phase: "HERO_BAN" | "HERO_PICK"
) {
  return phaseActions(actions, phase).length;
}

export function getTurnSequence(
  phase: "HERO_BAN" | "HERO_PICK",
  team1Id: string,
  team2Id: string
) {
  return phase === "HERO_BAN"
    ? getBanTurnSequence(team1Id, team2Id)
    : getPickTurnSequence(team1Id, team2Id);
}

export function getActiveTeamId(
  phase: "HERO_BAN" | "HERO_PICK",
  actions: DraftActionLike[],
  team1Id: string,
  team2Id: string
): string | null {
  const sequence = getTurnSequence(phase, team1Id, team2Id);
  const index = getPhaseActionCount(actions, phase);
  if (index >= sequence.length) return null;
  return sequence[index] ?? null;
}

export function getPicksRemainingForActiveTeam(
  phase: "HERO_BAN" | "HERO_PICK",
  actions: DraftActionLike[],
  team1Id: string,
  team2Id: string
) {
  if (phase !== "HERO_PICK") return 1;

  const sequence = getPickTurnSequence(team1Id, team2Id);
  const index = getPhaseActionCount(actions, phase);
  if (index >= sequence.length) return 0;

  const activeTeamId = sequence[index];
  let remaining = 0;
  for (let i = index; i < sequence.length && sequence[i] === activeTeamId; i++) {
    remaining++;
  }
  return remaining;
}
