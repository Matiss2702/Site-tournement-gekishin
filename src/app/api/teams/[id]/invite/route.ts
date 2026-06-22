import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { teamInviteSchema } from "@/lib/validations";
import { sendTeamInviteEmail } from "@/lib/brevo";
import { createNotification } from "@/lib/notifications";
import { assertUserNotAlreadyInTeam } from "@/lib/team-membership";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teamId } = await params;
  const body = await request.json();
  const parsed = teamInviteSchema.safeParse(body);

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { captain: true },
  });

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  if (team.captainId !== session.user.id) {
    return NextResponse.json({ error: "Only captain can invite" }, { status: 403 });
  }

  let receiverId: string | undefined;
  let receiverEmail: string | undefined;
  let receiverLocale: "en" | "fr" = "en";

  if (parsed.data.username) {
    const user = await prisma.user.findUnique({
      where: { username: parsed.data.username },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    receiverId = user.id;
    receiverEmail = user.email;
    receiverLocale = (user.locale as "en" | "fr") || "en";

    const existingMember = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: user.id } },
    });
    if (existingMember) {
      return NextResponse.json({ error: "User already in team" }, { status: 409 });
    }

    const membershipCheck = await assertUserNotAlreadyInTeam(user.id, teamId);
    if (!membershipCheck.ok) {
      return NextResponse.json({ error: "already_in_team" }, { status: 409 });
    }
  } else if (parsed.data.email) {
    receiverEmail = parsed.data.email.toLowerCase();

    const pendingInvite = await prisma.teamInvite.findFirst({
      where: {
        teamId,
        email: receiverEmail,
        status: "PENDING",
      },
    });
    if (pendingInvite) {
      return NextResponse.json(
        { error: "An invite is already pending for this email" },
        { status: 409 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: receiverEmail },
    });
    if (user) {
      receiverId = user.id;
      receiverLocale = (user.locale as "en" | "fr") || "en";

      const existingMember = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: user.id } },
      });
      if (existingMember) {
        return NextResponse.json({ error: "User already in team" }, { status: 409 });
      }

      const membershipCheck = await assertUserNotAlreadyInTeam(user.id, teamId);
      if (!membershipCheck.ok) {
        return NextResponse.json({ error: "already_in_team" }, { status: 409 });
      }
    } else {
      receiverLocale =
        (session.user.locale as "en" | "fr") || "fr";
    }
  }

  const invite = await prisma.teamInvite.create({
    data: {
      teamId,
      invitedById: session.user.id,
      receiverId,
      email: receiverEmail,
      username: parsed.data.username,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const inviteLink = `${baseUrl}/${receiverLocale}/teams/invite/${invite.token}`;
  const isNewUser = !receiverId;

  if (receiverId) {
    await createNotification({
      userId: receiverId,
      type: "TEAM_INVITE",
      titleEn: "Team invitation",
      titleFr: "Invitation d'équipe",
      messageEn: `You've been invited to join ${team.name}`,
      messageFr: `Vous avez été invité à rejoindre ${team.name}`,
      link: `/teams/invite/${invite.token}`,
    });
  }

  let emailSent = false;
  let emailError: string | undefined;

  if (receiverEmail) {
    const result = await sendTeamInviteEmail(
      receiverEmail,
      team.name,
      session.user.username,
      inviteLink,
      receiverLocale,
      isNewUser
    );
    emailSent = result.success;
    if (!result.success) {
      emailError = result.reason === "no_api_key"
        ? "Email not configured"
        : "Email delivery failed — check Brevo sender settings";
    }
  }

  return NextResponse.json(
    { invite, emailSent, emailError, inviteLink: process.env.NODE_ENV === "development" ? inviteLink : undefined },
    { status: 201 }
  );
}
