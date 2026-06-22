import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserTeamMember } from "@/lib/user-teams";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      captain: { select: { id: true, username: true, displayName: true } },
      members: {
        include: {
          user: { select: { id: true, username: true, displayName: true } },
        },
      },
      invites: {
        where: { status: "PENDING" },
        include: {
          invitedBy: { select: { id: true, username: true } },
          receiver: { select: { id: true, username: true } },
        },
      },
    },
  });

  if (!team) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isMember = await isUserTeamMember(session.user.id, id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(team);
}
