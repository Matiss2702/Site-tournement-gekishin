import type { Prisma } from "@/generated/prisma/client";
import { getBracketSize, getRoundCount } from "@/lib/bracket";

export const GRAND_FINAL_ROUND = 0;

export type BracketSide = "winners" | "losers" | "grand_final";

export type SlotDest = {
  round: number;
  matchNumber: number;
  slot: "team1" | "team2";
};

type Tx = Prisma.TransactionClient;

export function getWinnersRoundCount(bracketSize: number) {
  return getRoundCount(bracketSize);
}

export function getLosersRoundCount(bracketSize: number) {
  const k = getRoundCount(bracketSize);
  if (k <= 1) return 0;
  return 2 * (k - 1);
}

export function getLosersMatchCount(bracketSize: number, lbRound: number) {
  const pairIndex = Math.floor((lbRound - 1) / 2);
  return bracketSize / Math.pow(2, pairIndex + 2);
}

export function bracketSideFromRound(round: number): BracketSide {
  if (round === GRAND_FINAL_ROUND) return "grand_final";
  if (round < 0) return "losers";
  return "winners";
}

export function computeWinnerDestination(
  round: number,
  matchNumber: number,
  bracketSize: number,
  format: string
): SlotDest | null {
  const wbRounds = getWinnersRoundCount(bracketSize);

  if (round > 0 && round < wbRounds) {
    return {
      round: round + 1,
      matchNumber: Math.ceil(matchNumber / 2),
      slot: matchNumber % 2 === 1 ? "team1" : "team2",
    };
  }

  if (round > 0 && round === wbRounds) {
    if (format === "DOUBLE_ELIMINATION") {
      return { round: GRAND_FINAL_ROUND, matchNumber: 1, slot: "team1" };
    }
    return null;
  }

  if (round < 0) {
    const lbRound = Math.abs(round);
    const totalLbRounds = getLosersRoundCount(bracketSize);
    if (lbRound >= totalLbRounds) {
      return { round: GRAND_FINAL_ROUND, matchNumber: 1, slot: "team2" };
    }

    const nextLbRound = lbRound + 1;
    const currentMatchCount = getLosersMatchCount(bracketSize, lbRound);
    const nextMatchCount = getLosersMatchCount(bracketSize, nextLbRound);

    if (currentMatchCount === nextMatchCount) {
      return {
        round: -nextLbRound,
        matchNumber,
        slot: "team1",
      };
    }

    return {
      round: -nextLbRound,
      matchNumber: Math.ceil(matchNumber / 2),
      slot: matchNumber % 2 === 1 ? "team1" : "team2",
    };
  }

  return null;
}

export function computeLoserDestination(
  round: number,
  matchNumber: number,
  bracketSize: number,
  format: string
): SlotDest | null {
  if (format !== "DOUBLE_ELIMINATION" || round <= 0) return null;

  const wbRounds = getWinnersRoundCount(bracketSize);

  if (round === 1) {
    return {
      round: -1,
      matchNumber: Math.ceil(matchNumber / 2),
      slot: matchNumber % 2 === 1 ? "team1" : "team2",
    };
  }

  if (round === wbRounds) {
    const lbFinalRound = -getLosersRoundCount(bracketSize);
    return { round: lbFinalRound, matchNumber: 1, slot: "team2" };
  }

  const lbRound = -(2 * (round - 1));
  const lbMatchNumber = round === 2 ? (matchNumber === 1 ? 2 : 1) : matchNumber;
  return { round: lbRound, matchNumber: lbMatchNumber, slot: "team2" };
}

export async function ensureBracketStructure(
  tx: Tx,
  tournamentId: string,
  participantCount: number,
  format: string
) {
  const bracketSize = getBracketSize(participantCount);
  const wbRounds = getWinnersRoundCount(bracketSize);

  for (let r = 1; r <= wbRounds; r++) {
    const count = bracketSize / Math.pow(2, r);
    for (let m = 1; m <= count; m++) {
      await upsertEmptyMatch(tx, tournamentId, r, m);
    }
  }

  if (format === "DOUBLE_ELIMINATION") {
    const lbRounds = getLosersRoundCount(bracketSize);
    for (let r = 1; r <= lbRounds; r++) {
      const count = getLosersMatchCount(bracketSize, r);
      for (let m = 1; m <= count; m++) {
        await upsertEmptyMatch(tx, tournamentId, -r, m);
      }
    }
    await upsertEmptyMatch(tx, tournamentId, GRAND_FINAL_ROUND, 1);
  }
}

async function upsertEmptyMatch(
  tx: Tx,
  tournamentId: string,
  round: number,
  matchNumber: number
) {
  const existing = await tx.match.findFirst({
    where: { tournamentId, round, matchNumber },
  });
  if (!existing) {
    await tx.match.create({
      data: { tournamentId, round, matchNumber, status: "pending" },
    });
  }
}

export async function placeTeamInSlot(
  tx: Tx,
  tournamentId: string,
  dest: SlotDest,
  teamId: string
) {
  const match = await tx.match.findFirst({
    where: {
      tournamentId,
      round: dest.round,
      matchNumber: dest.matchNumber,
    },
  });

  if (!match || match.status === "completed") return;

  const slotField = dest.slot === "team1" ? "team1Id" : "team2Id";
  if (match[slotField] === teamId) return;

  const data: Prisma.MatchUpdateInput = {
    [slotField]: teamId,
  };

  const otherTeamId =
    dest.slot === "team1" ? match.team2Id : match.team1Id;
  const willHaveBoth = !!otherTeamId;

  if (willHaveBoth) {
    data.status = "pending";
  }

  await tx.match.update({
    where: { id: match.id },
    data,
  });
}

export async function advanceByeWinner(
  tx: Tx,
  tournamentId: string,
  match: {
    id: string;
    round: number;
    matchNumber: number;
    team1Id: string | null;
    team2Id: string | null;
    status: string;
  },
  bracketSize: number,
  format: string
) {
  if (match.status !== "bye" || !match.team1Id) return;

  await tx.match.update({
    where: { id: match.id },
    data: {
      winnerId: match.team1Id,
      score1: 1,
      score2: 0,
      status: "completed",
      playedAt: new Date(),
    },
  });

  await propagateAdvancement(
    tx,
    tournamentId,
    {
      ...match,
      winnerId: match.team1Id,
      team1Id: match.team1Id,
      team2Id: null,
      status: "completed",
    },
    bracketSize,
    format
  );
}

export async function propagateAdvancement(
  tx: Tx,
  tournamentId: string,
  match: {
    round: number;
    matchNumber: number;
    team1Id: string | null;
    team2Id: string | null;
    winnerId: string | null;
    status: string;
  },
  bracketSize: number,
  format: string
) {
  if (match.status !== "completed" || !match.winnerId) return;

  const winnerDest = computeWinnerDestination(
    match.round,
    match.matchNumber,
    bracketSize,
    format
  );
  if (winnerDest) {
    await placeTeamInSlot(tx, tournamentId, winnerDest, match.winnerId);
  }

  const loserId =
    match.team1Id === match.winnerId ? match.team2Id : match.team1Id;
  if (!loserId) return;

  const loserDest = computeLoserDestination(
    match.round,
    match.matchNumber,
    bracketSize,
    format
  );
  if (loserDest) {
    await placeTeamInSlot(tx, tournamentId, loserDest, loserId);
  }
}

export async function updateEntryStats(
  tx: Tx,
  tournamentId: string,
  winnerId: string,
  loserId: string | null
) {
  const winnerEntry = await tx.tournamentEntry.findFirst({
    where: { tournamentId, teamId: winnerId },
  });
  if (winnerEntry) {
    await tx.tournamentEntry.update({
      where: { id: winnerEntry.id },
      data: { wins: { increment: 1 }, score: { increment: 1 } },
    });
  }

  if (loserId) {
    const loserEntry = await tx.tournamentEntry.findFirst({
      where: { tournamentId, teamId: loserId },
    });
    if (loserEntry) {
      await tx.tournamentEntry.update({
        where: { id: loserEntry.id },
        data: { losses: { increment: 1 } },
      });
    }
  }
}

export function resolveWinnerId(
  team1Id: string | null,
  team2Id: string | null,
  score1: number,
  score2: number,
  explicitWinnerId?: string
): string | null {
  if (explicitWinnerId) return explicitWinnerId;
  if (!team1Id || !team2Id) return null;
  if (score1 === score2) return null;
  return score1 > score2 ? team1Id : team2Id;
}

export function getPropagationSortKey(match: { round: number; matchNumber: number }) {
  if (match.round > 0) {
    return [0, match.round, match.matchNumber] as const;
  }
  if (match.round < 0) {
    return [1, Math.abs(match.round), match.matchNumber] as const;
  }
  return [2, 0, match.matchNumber] as const;
}

export async function repairBracketProgression(
  tx: Tx,
  tournamentId: string,
  bracketSize: number,
  format: string
) {
  const lbRounds = getLosersRoundCount(bracketSize);
  for (let r = 1; r <= lbRounds; r++) {
    const count = getLosersMatchCount(bracketSize, r);
    for (let m = 1; m <= count; m++) {
      const match = await tx.match.findFirst({
        where: { tournamentId, round: -r, matchNumber: m },
      });
      if (!match || match.status === "completed") continue;
      await tx.match.update({
        where: { id: match.id },
        data: { team1Id: null, team2Id: null },
      });
    }
  }

  const gf = await tx.match.findFirst({
    where: { tournamentId, round: GRAND_FINAL_ROUND, matchNumber: 1 },
  });
  if (gf && gf.status !== "completed") {
    await tx.match.update({
      where: { id: gf.id },
      data: { team1Id: null, team2Id: null },
    });
  }

  const completed = await tx.match.findMany({
    where: { tournamentId, status: "completed" },
  });

  completed.sort((a, b) => {
    const ka = getPropagationSortKey(a);
    const kb = getPropagationSortKey(b);
    for (let i = 0; i < 3; i++) {
      if (ka[i] !== kb[i]) return ka[i] - kb[i];
    }
    return 0;
  });

  for (const match of completed) {
    await propagateAdvancement(tx, tournamentId, match, bracketSize, format);
  }
}
