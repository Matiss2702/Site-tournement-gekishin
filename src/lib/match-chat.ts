import { prisma } from "@/lib/prisma";

const MAX_BODY_LENGTH = 500;
const MAX_MESSAGES = 100;

export function sanitizeChatBody(raw: string) {
  const body = raw.trim().replace(/\s+/g, " ");
  if (!body) return null;
  if (body.length > MAX_BODY_LENGTH) {
    return body.slice(0, MAX_BODY_LENGTH);
  }
  return body;
}

/** User must belong to team1 or team2 of the match. */
export async function getMatchChatAccess(matchId: string, userId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      tournamentId: true,
      team1Id: true,
      team2Id: true,
      status: true,
      team1: { select: { id: true, name: true, tag: true } },
      team2: { select: { id: true, name: true, tag: true } },
    },
  });

  if (!match || !match.team1Id || !match.team2Id) {
    return { ok: false as const, error: "match_not_ready" };
  }

  const membership = await prisma.teamMember.findFirst({
    where: {
      userId,
      teamId: { in: [match.team1Id, match.team2Id] },
    },
    select: { teamId: true },
  });

  if (!membership) {
    return { ok: false as const, error: "forbidden" };
  }

  return {
    ok: true as const,
    match,
    teamId: membership.teamId,
  };
}

export async function listMatchChatMessages(matchId: string) {
  const messages = await prisma.matchChatMessage.findMany({
    where: { matchId },
    orderBy: { createdAt: "asc" },
    take: MAX_MESSAGES,
    include: {
      user: { select: { id: true, username: true, displayName: true } },
      team: { select: { id: true, name: true, tag: true } },
    },
  });

  return messages.map((message) => ({
    id: message.id,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    user: {
      id: message.user.id,
      username: message.user.username,
      displayName: message.user.displayName,
    },
    team: {
      id: message.team.id,
      name: message.team.name,
      tag: message.team.tag,
    },
  }));
}

export async function findUserMatchChatId(
  tournamentId: string,
  userId: string
) {
  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  });
  const teamIds = memberships.map((m) => m.teamId);
  if (teamIds.length === 0) return null;

  const match = await prisma.match.findFirst({
    where: {
      tournamentId,
      team1Id: { not: null },
      team2Id: { not: null },
      status: { notIn: ["completed", "bye"] },
      OR: [{ team1Id: { in: teamIds } }, { team2Id: { in: teamIds } }],
    },
    orderBy: [{ round: "desc" }, { matchNumber: "asc" }],
    select: { id: true },
  });

  return match?.id ?? null;
}

export async function createMatchChatMessage(input: {
  matchId: string;
  userId: string;
  teamId: string;
  body: string;
}) {
  const message = await prisma.matchChatMessage.create({
    data: {
      matchId: input.matchId,
      userId: input.userId,
      teamId: input.teamId,
      body: input.body,
    },
    include: {
      user: { select: { id: true, username: true, displayName: true } },
      team: { select: { id: true, name: true, tag: true } },
    },
  });

  return {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    user: {
      id: message.user.id,
      username: message.user.username,
      displayName: message.user.displayName,
    },
    team: {
      id: message.team.id,
      name: message.team.name,
      tag: message.team.tag,
    },
  };
}
