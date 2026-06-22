import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roleBanSchema } from "@/lib/validations";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const bans = await prisma.roleBan.findMany({
    where: { tournamentId: id },
    include: {
      user: { select: { id: true, username: true, displayName: true } },
    },
  });

  return NextResponse.json(bans);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: tournamentId } = await params;
  const body = await request.json();
  const parsed = roleBanSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const organizer = await prisma.tournamentOrganizer.findFirst({
    where: {
      tournamentId,
      userId: session.user.id,
      permissions: { has: "MANAGE_BANS" },
    },
  });

  if (!organizer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ban = await prisma.roleBan.create({
    data: {
      tournamentId,
      userId: parsed.data.userId,
      gameRole: parsed.data.gameRole,
      reason: parsed.data.reason,
    },
    include: {
      user: { select: { id: true, username: true } },
    },
  });

  return NextResponse.json(ban, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: tournamentId } = await params;
  const { searchParams } = new URL(request.url);
  const banId = searchParams.get("banId");

  if (!banId) {
    return NextResponse.json({ error: "banId required" }, { status: 400 });
  }

  const organizer = await prisma.tournamentOrganizer.findFirst({
    where: {
      tournamentId,
      userId: session.user.id,
      permissions: { has: "MANAGE_BANS" },
    },
  });

  if (!organizer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.roleBan.delete({ where: { id: banId } });
  return NextResponse.json({ success: true });
}
