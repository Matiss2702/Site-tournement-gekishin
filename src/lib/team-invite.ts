import { prisma } from "@/lib/prisma";
import { assertUserNotAlreadyInTeam } from "@/lib/team-membership";

export async function getTeamInviteByToken(token: string) {
  return prisma.teamInvite.findUnique({
    where: { token },
    include: {
      team: { select: { id: true, name: true, tag: true } },
      invitedBy: { select: { username: true, displayName: true } },
    },
  });
}

export async function acceptTeamInvite(
  token: string,
  userId: string,
  userEmail: string
) {
  const invite = await getTeamInviteByToken(token);

  if (!invite || invite.status !== "PENDING") {
    return { error: "Invalid invite", status: 404 as const };
  }

  if (invite.expiresAt && invite.expiresAt < new Date()) {
    await prisma.teamInvite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });
    return { error: "Invite expired", status: 410 as const };
  }

  if (invite.receiverId && invite.receiverId !== userId) {
    return { error: "Not your invite", status: 403 as const };
  }

  if (
    invite.email &&
    userEmail &&
    invite.email.toLowerCase() !== userEmail.toLowerCase()
  ) {
    return { error: "Invite email mismatch", status: 403 as const };
  }

  const existing = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: { teamId: invite.teamId, userId },
    },
  });

  if (existing) {
    await prisma.teamInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", receiverId: userId },
    });
    return { teamId: invite.teamId, teamName: invite.team.name };
  }

  const membershipCheck = await assertUserNotAlreadyInTeam(
    userId,
    invite.teamId
  );
  if (!membershipCheck.ok) {
    return {
      error: "already_in_team",
      status: 409 as const,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.teamMember.create({
      data: {
        teamId: invite.teamId,
        userId,
        memberRole: "MEMBER",
      },
    });
    await tx.teamInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", receiverId: userId },
    });
  });

  return { teamId: invite.teamId, teamName: invite.team.name };
}
