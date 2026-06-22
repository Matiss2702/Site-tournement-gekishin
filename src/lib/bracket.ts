import {
  GRAND_FINAL_ROUND,
  getLosersMatchCount,
  getLosersRoundCount,
} from "@/lib/bracket-progression";

export type BracketParticipant = {
  id: string;
  name: string;
  tag: string | null;
};

export type Round1Pairing = {
  team1Id: string;
  team2Id: string | null;
};

export function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function buildRandomRound1Pairings(participantIds: string[]): Round1Pairing[] {
  const shuffled = shuffleArray(participantIds);
  const pairings: Round1Pairing[] = [];

  for (let i = 0; i < shuffled.length; i += 2) {
    pairings.push({
      team1Id: shuffled[i],
      team2Id: shuffled[i + 1] ?? null,
    });
  }

  return pairings;
}

export function countRound1Slots(pairingCount: number) {
  return Math.max(pairingCount, 1);
}

export function getAssignedIds(
  matches: { team1Id: string | null; team2Id: string | null }[]
): Set<string> {
  const ids = new Set<string>();
  for (const match of matches) {
    if (match.team1Id) ids.add(match.team1Id);
    if (match.team2Id) ids.add(match.team2Id);
  }
  return ids;
}

export function getUnassignedParticipantIds(
  allIds: string[],
  matches: { team1Id: string | null; team2Id: string | null }[]
): string[] {
  const assigned = getAssignedIds(matches);
  return allIds.filter((id) => !assigned.has(id));
}

export function getBracketSize(participantCount: number): number {
  const n = Math.max(participantCount, 2);
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

export function getRoundCount(bracketSize: number): number {
  return Math.log2(bracketSize);
}

export type BracketDbMatch = {
  id: string;
  round: number;
  matchNumber: number;
  status: string;
  score1: number;
  score2: number;
  winnerId: string | null;
  team1: BracketParticipant | null;
  team2: BracketParticipant | null;
  seriesLength?: number;
  winsNeeded?: number;
  draftComplete?: boolean;
};

export type BracketDisplayMatch = {
  id: string;
  round: number;
  matchNumber: number;
  status: string;
  score1: number;
  score2: number;
  winnerId: string | null;
  team1: BracketParticipant | null;
  team2: BracketParticipant | null;
  isPlaceholder: boolean;
  seriesLength: number;
  winsNeeded: number;
  draftComplete: boolean;
};

export type BracketDisplayRound = {
  round: number;
  labelKey: "tour1" | "tour2" | "semifinal" | "quarterfinal" | "final" | "losersRound" | "grandFinal";
  labelParams?: { n: number };
  matches: BracketDisplayMatch[];
};

export function getGlobalMatchNumber(
  round: number,
  matchNumber: number,
  bracketSize: number
): number {
  if (round <= 0) return matchNumber;
  let offset = 0;
  for (let r = 1; r < round; r++) {
    offset += bracketSize / Math.pow(2, r);
  }
  return offset + matchNumber;
}

export function getFeederMatchNumbers(
  round: number,
  matchNumber: number,
  bracketSize: number
) {
  if (round <= 1) return null;
  const prevRound = round - 1;
  return {
    team1: getGlobalMatchNumber(prevRound, (matchNumber - 1) * 2 + 1, bracketSize),
    team2: getGlobalMatchNumber(prevRound, (matchNumber - 1) * 2 + 2, bracketSize),
  };
}

export function getLosersFeederMatchNumbers(
  lbRound: number,
  lbMatchNumber: number,
  bracketSize: number
) {
  if (lbRound === 1) {
    const wbMatch1 = (lbMatchNumber - 1) * 2 + 1;
    const wbMatch2 = wbMatch1 + 1;
    return {
      team1: getGlobalMatchNumber(1, wbMatch1, bracketSize),
      team2: getGlobalMatchNumber(1, wbMatch2, bracketSize),
      referLosers: true,
    };
  }

  const prevMatch1 = (lbMatchNumber - 1) * 2 + 1;
  const prevMatch2 = prevMatch1 + 1;
  const wbR1Count = bracketSize / 2;
  return {
    team1: wbR1Count + prevMatch1,
    team2: wbR1Count + prevMatch2,
    referLosers: false,
  };
}

export function chunkPairs<T>(items: T[]): T[][] {
  const pairs: T[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    pairs.push(items.slice(i, i + 2));
  }
  return pairs;
}

function toDisplayMatch(
  existing: BracketDbMatch | undefined,
  round: number,
  matchNumber: number
): BracketDisplayMatch {
  if (existing) {
    return {
      ...existing,
      isPlaceholder: false,
      seriesLength: existing.seriesLength ?? 1,
      winsNeeded: existing.winsNeeded ?? 1,
      draftComplete: existing.draftComplete ?? false,
    };
  }
  return {
    id: `placeholder-r${round}-m${matchNumber}`,
    round,
    matchNumber,
    status: "pending",
    score1: 0,
    score2: 0,
    winnerId: null,
    team1: null,
    team2: null,
    isPlaceholder: true,
    seriesLength: 1,
    winsNeeded: 1,
    draftComplete: false,
  };
}

function matchMapByRound(
  allMatches: BracketDbMatch[],
  roundFilter: (round: number) => boolean
) {
  const map = new Map<string, BracketDbMatch>();
  for (const m of allMatches) {
    if (roundFilter(m.round)) {
      map.set(`${m.round}:${m.matchNumber}`, m);
    }
  }
  return map;
}

export function buildWinnersRounds(
  participantCount: number,
  allMatches: BracketDbMatch[]
): BracketDisplayRound[] {
  const bracketSize = getBracketSize(participantCount);
  const totalRounds = getRoundCount(bracketSize);
  const rounds: BracketDisplayRound[] = [];
  const byKey = matchMapByRound(allMatches, (r) => r > 0);

  for (let r = 1; r <= totalRounds; r++) {
    const matchCount = bracketSize / Math.pow(2, r);
    let labelKey: BracketDisplayRound["labelKey"] = "tour2";
    if (r === 1) labelKey = "tour1";
    else if (r === totalRounds) labelKey = "final";
    else if (matchCount === 2) labelKey = "semifinal";
    else if (matchCount === 4) labelKey = "quarterfinal";

    const matches: BracketDisplayMatch[] = [];
    for (let m = 1; m <= matchCount; m++) {
      matches.push(toDisplayMatch(byKey.get(`${r}:${m}`), r, m));
    }
    rounds.push({ round: r, labelKey, matches });
  }

  return rounds;
}

export function buildLosersRounds(
  participantCount: number,
  allMatches: BracketDbMatch[]
): BracketDisplayRound[] {
  const bracketSize = getBracketSize(participantCount);
  const lbRounds = getLosersRoundCount(bracketSize);
  if (lbRounds === 0) return [];

  const rounds: BracketDisplayRound[] = [];
  const byKey = matchMapByRound(allMatches, (r) => r < 0);

  for (let r = 1; r <= lbRounds; r++) {
    const matchCount = getLosersMatchCount(bracketSize, r);
    const matches: BracketDisplayMatch[] = [];
    for (let m = 1; m <= matchCount; m++) {
      matches.push(toDisplayMatch(byKey.get(`${-r}:${m}`), -r, m));
    }
    rounds.push({
      round: r,
      labelKey: "losersRound",
      labelParams: { n: r },
      matches,
    });
  }

  return rounds;
}

export function buildGrandFinalRound(
  allMatches: BracketDbMatch[]
): BracketDisplayRound | null {
  const gf = allMatches.find(
    (m) => m.round === GRAND_FINAL_ROUND && m.matchNumber === 1
  );
  if (!gf && !allMatches.some((m) => m.round === GRAND_FINAL_ROUND)) {
    return null;
  }

  return {
    round: GRAND_FINAL_ROUND,
    labelKey: "grandFinal",
    matches: [toDisplayMatch(gf, GRAND_FINAL_ROUND, 1)],
  };
}

/** @deprecated use buildWinnersRounds */
export function buildBracketRounds(
  participantCount: number,
  round1Matches: Array<{
    id: string;
    round: number;
    matchNumber: number;
    status: string;
    team1: BracketParticipant | null;
    team2: BracketParticipant | null;
  }>
): BracketDisplayRound[] {
  const asDb: BracketDbMatch[] = round1Matches.map((m) => ({
    ...m,
    score1: 0,
    score2: 0,
    winnerId: null,
  }));
  return buildWinnersRounds(participantCount, asDb);
}
