import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { teamSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teams = await withPrismaRetry(() =>
    prisma.team.findMany({
      where: {
        members: { some: { userId: session.user.id } },
      },
      include: {
        captain: { select: { id: true, username: true, displayName: true } },
        members: {
          include: {
            user: { select: { id: true, username: true, displayName: true } },
          },
        },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: "desc" },
    })
  );

  return NextResponse.json(teams);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = teamSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const team = await withPrismaRetry(() =>
      prisma.team.create({
        data: {
          name: parsed.data.name,
          tag: parsed.data.tag,
          captainId: session.user.id,
          members: {
            create: {
              userId: session.user.id,
              memberRole: "CAPTAIN",
            },
          },
        },
        include: {
          captain: { select: { id: true, username: true } },
          members: {
            include: { user: { select: { id: true, username: true } } },
          },
        },
      })
    );

    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    console.error("[POST /api/teams]", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        ...(process.env.NODE_ENV === "development" && {
          details: error instanceof Error ? error.message : String(error),
        }),
      },
      { status: 500 }
    );
  }
}
