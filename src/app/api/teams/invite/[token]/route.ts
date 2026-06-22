import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { acceptTeamInvite, getTeamInviteByToken } from "@/lib/team-invite";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const invite = await getTeamInviteByToken(token);

  if (!invite) {
    return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
  }

  if (invite.status !== "PENDING") {
    return NextResponse.json(
      { error: "Invite no longer valid", status: invite.status },
      { status: 410 }
    );
  }

  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invite expired" }, { status: 410 });
  }

  return NextResponse.json({
    teamName: invite.team.name,
    teamTag: invite.team.tag,
    inviterName: invite.invitedBy.displayName || invite.invitedBy.username,
    email: invite.email,
    username: invite.username,
    requiresRegistration: !invite.receiverId,
  });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userEmail =
      session.user.email ??
      (
        await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { email: true },
        })
      )?.email;

    if (!userEmail) {
      return NextResponse.json(
        { error: "Session missing email — please sign out and sign in again" },
        { status: 400 }
      );
    }

    const { token } = await params;
    const result = await acceptTeamInvite(token, session.user.id, userEmail);

    if ("error" in result) {
      return NextResponse.json(
        {
          error: result.error,
          teamName: "teamName" in result ? result.teamName : undefined,
        },
        { status: result.status }
      );
    }

    return NextResponse.json({
      teamId: result.teamId,
      teamName: result.teamName,
    });
  } catch (error) {
    console.error("[POST /api/teams/invite/[token]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
