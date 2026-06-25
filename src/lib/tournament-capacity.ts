import { SOLO_TEAM_SIZE } from "@/lib/tournament-prize-config";

/** Bracket-friendly capacities: minimum 8 teams, then powers of 2 only. */
export const MIN_TOURNAMENT_CAPACITY = 8;

export const TOURNAMENT_CAPACITY_OPTIONS = [8, 16, 32, 64, 128] as const;

export type TournamentCapacity =
  (typeof TOURNAMENT_CAPACITY_OPTIONS)[number];

export function isValidTournamentCapacity(
  value: number
): value is TournamentCapacity {
  return (TOURNAMENT_CAPACITY_OPTIONS as readonly number[]).includes(value);
}

/** Solo signup capacities (= team slots × roster size). */
export const MIN_SOLO_PLAYER_CAPACITY =
  MIN_TOURNAMENT_CAPACITY * SOLO_TEAM_SIZE;

export const SOLO_PLAYER_CAPACITY_OPTIONS = TOURNAMENT_CAPACITY_OPTIONS.map(
  (teams) => teams * SOLO_TEAM_SIZE
) as readonly [32, 64, 128, 256, 512];

export type SoloPlayerCapacity =
  (typeof SOLO_PLAYER_CAPACITY_OPTIONS)[number];

export function isValidSoloPlayerCapacity(
  value: number
): value is SoloPlayerCapacity {
  return (SOLO_PLAYER_CAPACITY_OPTIONS as readonly number[]).includes(value);
}
