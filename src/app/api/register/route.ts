import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { acceptTeamInvite, getTeamInviteByToken } from "@/lib/team-invite";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, username, password, displayName, locale, inviteToken } =
      parsed.data;

    if (inviteToken) {
      const invite = await getTeamInviteByToken(inviteToken);
      if (!invite || invite.status !== "PENDING") {
        return NextResponse.json({ error: "Invalid invite" }, { status: 400 });
      }
      if (
        invite.email &&
        invite.email.toLowerCase() !== email.toLowerCase()
      ) {
        return NextResponse.json(
          { error: "Email must match the invitation" },
          { status: 400 }
        );
      }
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Email or username already exists" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        displayName,
        locale,
      },
      select: { id: true, email: true, username: true },
    });

    let teamId: string | undefined;

    if (inviteToken) {
      const result = await acceptTeamInvite(inviteToken, user.id, user.email);
      if ("error" in result) {
        return NextResponse.json(
          { error: result.error, user },
          { status: result.status }
        );
      }
      teamId = result.teamId;
    }

    return NextResponse.json({ user, teamId }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
