import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

function newTokens() {
  return {
    spectatorToken: randomUUID(),
    team1Token: randomUUID(),
    team2Token: randomUUID(),
  };
}

const draftInclude = {
  team1: { select: { id: true, name: true, tag: true, captainId: true } },
  team2: { select: { id: true, name: true, tag: true, captainId: true } },
  match: { select: { id: true, round: true, matchNumber: true, status: true } },
} as const;

export async function ensureMatchDraftTokens(matchId: string) {
  let config = await prisma.draftConfig.findUnique({
    where: { matchId },
  });

  if (!config) return null;

  if (config.spectatorToken && config.team1Token && config.team2Token) {
    return prisma.draftConfig.findUnique({
      where: { matchId },
      include: draftInclude,
    });
  }

  const data: Record<string, string> = {};
  if (!config.spectatorToken) data.spectatorToken = randomUUID();
  if (!config.team1Token) data.team1Token = randomUUID();
  if (!config.team2Token) data.team2Token = randomUUID();

  await prisma.draftConfig.update({
    where: { matchId },
    data,
  });

  return prisma.draftConfig.findUnique({
    where: { matchId },
    include: draftInclude,
  });
}

export { newTokens };
