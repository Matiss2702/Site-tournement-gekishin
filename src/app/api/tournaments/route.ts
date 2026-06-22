import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tournamentSchema } from "@/lib/validations";

export async function GET() {
  const tournaments = await prisma.tournament.findMany({
    include: {
      organizer: { select: { id: true, username: true, displayName: true } },
      _count: { select: { entries: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tournaments);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = tournamentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const tournament = await prisma.tournament.create({
      data: {
        title: data.title,
        description: data.description,
        type: data.type,
        format: data.format,
        maxTeams: data.maxTeams,
        maxPlayers: data.maxPlayers,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        roundSeriesLength: data.roundSeriesLength,
        semiSeriesLength: data.semiSeriesLength,
        finalSeriesLength: data.finalSeriesLength,
        organizerId: session.user.id,
        organizers: {
          create: {
            userId: session.user.id,
            permissions: [
              "MANAGE_TOURNAMENT",
              "MANAGE_SCORES",
              "MANAGE_DRAFT",
              "MANAGE_PARTICIPANTS",
              "MANAGE_BANS",
            ],
          },
        },
        prizeCodes:
          data.prizeCodes.length > 0
            ? {
                create: data.prizeCodes.map((row) => ({
                  placement: row.placement,
                  code: row.code.trim(),
                })),
              }
            : undefined,
      },
      include: {
        organizer: { select: { id: true, username: true } },
      },
    });

    return NextResponse.json(tournament, { status: 201 });
  } catch (error) {
    console.error("[POST /api/tournaments]", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      {
        error: "Internal server error",
        ...(process.env.NODE_ENV === "development" && { details: message }),
      },
      { status: 500 }
    );
  }
}
