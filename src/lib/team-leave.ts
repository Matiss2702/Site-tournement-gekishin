import { prisma } from "@/lib/prisma";

export async function leaveTeam(teamId: string, userId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: { select: { id: true, userId: true } },
    },
  });

  if (!team) {
    return { error: "not_found" as const, status: 404 as const };
  }

  const membership = team.members.find((m) => m.userId === userId);
  if (!membership) {
    return { error: "not_member" as const, status: 404 as const };
  }

  const otherMembers = team.members.filter((m) => m.userId !== userId);
  const isCaptain = team.captainId === userId;

  if (isCaptain && otherMembers.length > 0) {
    return { error: "captain_must_transfer" as const, status: 409 as const };
  }

  if (isCaptain && otherMembers.length === 0) {
    await prisma.team.delete({ where: { id: teamId } });
    return { ok: true as const, teamDeleted: true as const };
  }

  await prisma.teamMember.delete({ where: { id: membership.id } });
  return { ok: true as const, teamDeleted: false as const };
}

export async function removeTeamMember(
  teamId: string,
  captainUserId: string,
  memberRecordId: string
) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team || team.captainId !== captainUserId) {
    return { error: "forbidden" as const, status: 403 as const };
  }

  const member = await prisma.teamMember.findUnique({
    where: { id: memberRecordId },
  });

  if (!member || member.teamId !== teamId) {
    return { error: "not_found" as const, status: 404 as const };
  }

  if (member.userId === captainUserId) {
    return { error: "cannot_remove_captain" as const, status: 400 as const };
  }

  await prisma.teamMember.delete({ where: { id: memberRecordId } });
  return { ok: true as const };
}
