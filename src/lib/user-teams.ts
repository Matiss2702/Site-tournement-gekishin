import { prisma } from "@/lib/prisma";

export async function getUserTeams(userId: string) {
  return prisma.team.findMany({
    where: {
      tournamentId: null,
      members: { some: { userId } },
    },
    select: {
      id: true,
      name: true,
      tag: true,
      _count: { select: { members: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getUserTeamsWithDetails(userId: string) {
  return prisma.team.findMany({
    where: {
      tournamentId: null,
      members: { some: { userId } },
    },
    include: {
      captain: { select: { username: true } },
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function isUserTeamMember(userId: string, teamId: string) {
  const member = await prisma.teamMember.findFirst({
    where: { userId, teamId },
    select: { id: true },
  });
  return !!member;
}
