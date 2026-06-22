import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { leaveTeam, removeTeamMember } from "@/lib/team-leave";
import { z } from "zod";

const updateMemberSchema = z.object({
  memberRole: z.enum(["CAPTAIN", "MEMBER", "SUBSTITUTE"]),
  gameRole: z.enum(["TANK", "SUPPORT", "DPS"]).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teamId, memberId } = await params;
  const body = await request.json();
  const parsed = updateMemberSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team || team.captainId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const member = await prisma.teamMember.findUnique({
    where: { id: memberId },
  });

  if (!member || member.teamId !== teamId) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (parsed.data.memberRole === "CAPTAIN") {
    await prisma.$transaction([
      prisma.team.update({
        where: { id: teamId },
        data: { captainId: member.userId },
      }),
      prisma.teamMember.update({
        where: { id: memberId },
        data: {
          memberRole: "CAPTAIN",
          ...(parsed.data.gameRole ? { gameRole: parsed.data.gameRole } : {}),
        },
      }),
      prisma.teamMember.updateMany({
        where: {
          teamId,
          userId: { not: member.userId },
          memberRole: "CAPTAIN",
        },
        data: { memberRole: "MEMBER" },
      }),
    ]);
  } else {
    await prisma.teamMember.update({
      where: { id: memberId },
      data: {
        memberRole: parsed.data.memberRole,
        ...(parsed.data.gameRole ? { gameRole: parsed.data.gameRole } : {}),
      },
    });
  }

  const updated = await prisma.teamMember.findUnique({
    where: { id: memberId },
    include: {
      user: { select: { id: true, username: true, displayName: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teamId, memberId } = await params;

  const member = await prisma.teamMember.findUnique({
    where: { id: memberId },
  });

  if (!member || member.teamId !== teamId) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (member.userId === session.user.id) {
    const result = await leaveTeam(teamId, session.user.id);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      left: true,
      teamDeleted: result.teamDeleted,
    });
  }

  const result = await removeTeamMember(teamId, session.user.id, memberId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ removed: true });
}
