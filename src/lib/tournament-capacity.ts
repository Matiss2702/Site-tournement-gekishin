/** Bracket-friendly capacities: minimum 8, then powers of 2 only. */
export const MIN_TOURNAMENT_CAPACITY = 8;

export const TOURNAMENT_CAPACITY_OPTIONS = [8, 16, 32, 64, 128] as const;

export type TournamentCapacity =
  (typeof TOURNAMENT_CAPACITY_OPTIONS)[number];

export function isValidTournamentCapacity(
  value: number
): value is TournamentCapacity {
  return (TOURNAMENT_CAPACITY_OPTIONS as readonly number[]).includes(value);
}
