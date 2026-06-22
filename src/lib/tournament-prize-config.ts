export const PRIZE_CODES_PER_TEAM = 4;

/** Minimum roster size required to register a team in a team tournament. */
export const MIN_TEAM_ROSTER_SIZE = PRIZE_CODES_PER_TEAM;

/** Minimum entries (teams or solo players) required to start a tournament. */
export const MIN_TOURNAMENT_PARTICIPANTS = 8;

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
