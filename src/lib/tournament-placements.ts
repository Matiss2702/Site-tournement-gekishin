import {
  GRAND_FINAL_ROUND,
  getLosersRoundCount,
  getWinnersRoundCount,
} from "@/lib/bracket-progression";

export type BracketMatchRow = {
  round: number;
  matchNumber: number;
  status: string;
  team1Id: string | null;
  team2Id: string | null;
  winnerId: string | null;
};

export type TournamentPlacements = {
  first: string | null;
  second: string | null;
  third: string | null;
};

function findCompletedMatch(
  matches: BracketMatchRow[],
  round: number,
  matchNumber: number
) {
  return matches.find(
    (m) =>
      m.round === round &&
      m.matchNumber === matchNumber &&
      m.status === "completed" &&
      m.winnerId
  );
}

function loserId(match: BracketMatchRow) {
  if (!match.winnerId) return null;
  if (match.team1Id === match.winnerId) return match.team2Id;
  if (match.team2Id === match.winnerId) return match.team1Id;
  return null;
}

export function isTournamentDecisivelyComplete(
  format: string,
  bracketSize: number,
  matches: BracketMatchRow[]
) {
  if (format === "DOUBLE_ELIMINATION") {
    return !!findCompletedMatch(matches, GRAND_FINAL_ROUND, 1);
  }

  const wbFinalRound = getWinnersRoundCount(bracketSize);
  return !!findCompletedMatch(matches, wbFinalRound, 1);
}

export function resolveTournamentPlacements(
  format: string,
  bracketSize: number,
  matches: BracketMatchRow[]
): TournamentPlacements | null {
  if (!isTournamentDecisivelyComplete(format, bracketSize, matches)) {
    return null;
  }

  if (format === "DOUBLE_ELIMINATION") {
    const grandFinal = findCompletedMatch(matches, GRAND_FINAL_ROUND, 1);
    if (!grandFinal?.winnerId) return null;

    const lbFinalRound = -getLosersRoundCount(bracketSize);
    const lbFinal = findCompletedMatch(matches, lbFinalRound, 1);

    return {
      first: grandFinal.winnerId,
      second: loserId(grandFinal),
      third: lbFinal ? loserId(lbFinal) : null,
    };
  }

  const wbFinalRound = getWinnersRoundCount(bracketSize);
  const final = findCompletedMatch(matches, wbFinalRound, 1);
  if (!final?.winnerId) return null;

  return {
    first: final.winnerId,
    second: loserId(final),
    third: null,
  };
}

export function placementLabel(placement: number, locale: string) {
  if (locale === "fr") {
    if (placement === 1) return "1ère place";
    if (placement === 2) return "2ème place";
    if (placement === 3) return "3ème place";
  }
  if (placement === 1) return "1st place";
  if (placement === 2) return "2nd place";
  if (placement === 3) return "3rd place";
  return `${placement}th place`;
}
