export const PRIZE_CODES_PER_TEAM = 4;

/** Minimum roster size required to register a team in a team tournament. */
export const MIN_TEAM_ROSTER_SIZE = PRIZE_CODES_PER_TEAM;

/** Minimum teams required to start a tournament. */
export const MIN_TOURNAMENT_PARTICIPANTS = 8;

/** Players per auto-generated team in solo (random draw) tournaments. */
export const SOLO_TEAM_SIZE = PRIZE_CODES_PER_TEAM;

/** Minimum solo signups (= minimum teams × players per team). */
export const MIN_SOLO_PLAYERS =
  MIN_TOURNAMENT_PARTICIPANTS * SOLO_TEAM_SIZE;

export function isValidSoloPlayerCount(count: number) {
  return count >= MIN_SOLO_PLAYERS && count % SOLO_TEAM_SIZE === 0;
}

export function soloPlayerCountToTeamCount(playerCount: number) {
  return playerCount / SOLO_TEAM_SIZE;
}

/** Entries required to move CHECK_IN → IN_PROGRESS (teams on bracket). */
export function getMinEntriesToStartTournament(
  type: "SOLO" | "TEAM",
  entries: { teamId: string | null; userId: string | null }[]
) {
  if (type === "TEAM") return MIN_TOURNAMENT_PARTICIPANTS;
  const usesTeams = entries.some((entry) => entry.teamId != null);
  return usesTeams ? MIN_TOURNAMENT_PARTICIPANTS : MIN_SOLO_PLAYERS;
}

export const PRIZE_PLACEMENTS = [1, 2, 3] as const;

export type PrizePlacement = (typeof PRIZE_PLACEMENTS)[number];

export function groupPrizeCodesByPlacement(
  codes: { placement: number; code: string }[]
) {
  const grouped = new Map<number, string[]>();
  for (const row of codes) {
    const list = grouped.get(row.placement) ?? [];
    list.push(row.code);
    grouped.set(row.placement, list);
  }
  return grouped;
}
