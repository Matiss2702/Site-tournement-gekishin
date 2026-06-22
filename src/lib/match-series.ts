import { GRAND_FINAL_ROUND, getWinnersRoundCount } from "@/lib/bracket-progression";

export const SERIES_LENGTH_OPTIONS = [1, 3, 5] as const;

export type SeriesLength = (typeof SERIES_LENGTH_OPTIONS)[number];

export type MatchSeriesContext = {
  round: number;
  format: string;
  bracketSize: number;
  roundSeriesLength: number;
  semiSeriesLength: number;
  finalSeriesLength: number;
};

export function winsNeededForSeries(seriesLength: number) {
  return Math.ceil(seriesLength / 2);
}

export function getMatchSeriesLength(ctx: MatchSeriesContext) {
  const { round, format, bracketSize } = ctx;
  const wbRounds = getWinnersRoundCount(bracketSize);

  if (round === GRAND_FINAL_ROUND) {
    return ctx.finalSeriesLength;
  }

  if (round > 0) {
    if (round === wbRounds) {
      return ctx.finalSeriesLength;
    }
    if (round === wbRounds - 1 && wbRounds >= 2) {
      return ctx.semiSeriesLength;
    }
    return ctx.roundSeriesLength;
  }

  return ctx.roundSeriesLength;
}

export function validateSeriesScore(
  score1: number,
  score2: number,
  seriesLength: number
): { ok: true } | { ok: false; reason: string } {
  const winsNeeded = winsNeededForSeries(seriesLength);

  if (!Number.isInteger(score1) || !Number.isInteger(score2)) {
    return { ok: false, reason: "invalid_score" };
  }
  if (score1 < 0 || score2 < 0 || score1 > winsNeeded || score2 > winsNeeded) {
    return { ok: false, reason: "score_out_of_range" };
  }
  if (score1 === score2) {
    return { ok: false, reason: "tie" };
  }

  const winnerScore = Math.max(score1, score2);
  if (winnerScore !== winsNeeded) {
    return { ok: false, reason: "series_not_complete" };
  }

  return { ok: true };
}

export function formatSeriesLabel(seriesLength: number) {
  return `BO${seriesLength}`;
}
