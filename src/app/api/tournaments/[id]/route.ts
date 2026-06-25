import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { MIN_TEAM_ROSTER_SIZE, getMinEntriesToStartTournament } from "@/lib/tournament-prize-config";
import { initializeTournamentBracketIfEmpty } from "@/lib/tournament-bracket-init";
import { assertTeamCanRegisterForTournament } from "@/lib/team-membership";
import { canManageTournament } from "@/lib/tournament-auth";
import {
  assertAllParticipantsCheckedIn,
  confirmTournamentCheckIn,
  startTournamentCheckIn,
} from "@/lib/tournament-check-in";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      organizer: { select: { id: true, username: true, displayName: true } },
      organizers: {
        include: { user: { select: { id: true, username: true } } },
      },
      entries: {
        include: {
          user: { select: { id: true, username: true, displayName: true } },
          team: {
            include: {
              members: {
                include: {
                  user: { select: { id: true, username: true } },
                },
              },
            },
          },
        },
      },
      matches: {
        include: {
          team1: { select: { id: true, name: true, tag: true } },
          team2: { select: { id: true, name: true, tag: true } },
          winner: { select: { id: true, name: true } },
        },
        orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
      },
      draftConfigs: true,
      draftActions: {
        orderBy: { order: "asc" },
        include: {
          team: { select: { id: true, name: true } },
          actor: { select: { id: true, username: true } },
        },
      },
      roleBans: {
        include: {
          user: { select: { id: true, username: true } },
        },
      },
    },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(tournament);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  if (!(await canManageTournament(id, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.status !== undefined) {
    const current = await prisma.tournament.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (body.status === "IN_PROGRESS") {
      if (current.status !== "CHECK_IN") {
        return NextResponse.json(
          { error: "check_in_required" },
          { status: 400 }
        );
      }
      const tournamentMeta = await prisma.tournament.findUnique({
        where: { id },
        select: { type: true },
      });
      const entries = await prisma.tournamentEntry.findMany({
        where: { tournamentId: id },
        select: { teamId: true, userId: true },
      });
      const entryCount = entries.length;
      const minEntries = getMinEntriesToStartTournament(
        tournamentMeta?.type ?? "TEAM",
        entries
      );
      if (entryCount < minEntries) {
        return NextResponse.json(
          {
            error: "min_participants",
            required: minEntries,
            current: entryCount,
          },
          { status: 400 }
        );
      }
      if (!(await assertAllParticipantsCheckedIn(id))) {
        return NextResponse.json(
          { error: "check_in_incomplete" },
          { status: 400 }
        );
      }
    }

    if (body.status === "CHECK_IN" && current.status !== "REGISTRATION") {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }

    if (body.status === "REGISTRATION" && current.status !== "REGISTRATION") {
      const snapshot = await prisma.tournament.findUnique({
        where: { id },
        select: {
          status: true,
          _count: { select: { entries: true } },
          matches: {
            where: { winnerId: { not: null } },
            select: { id: true },
            take: 1,
          },
        },
      });

      if (!snapshot) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      if (snapshot._count.entries > 0) {
        return NextResponse.json(
          { error: "reopen_has_entries" },
          { status: 400 }
        );
      }

      if (snapshot.matches.length > 0) {
        return NextResponse.json(
          { error: "reopen_has_results" },
          { status: 400 }
        );
      }

      const allowedFrom = ["DRAFT", "CHECK_IN", "IN_PROGRESS"];
      if (!allowedFrom.includes(snapshot.status)) {
        return NextResponse.json({ error: "invalid_status" }, { status: 400 });
      }
    }
  }

  const tournament = await prisma.tournament.update({
    where: { id },
    data: body,
  });

  if (body.status === "IN_PROGRESS") {
    await initializeTournamentBracketIfEmpty(id);
  }

  return NextResponse.json(tournament);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const action = body.action as string;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: { entries: true },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (action === "join") {
    if (tournament.status !== "REGISTRATION") {
      return NextResponse.json(
        { error: "Tournament not open for registration" },
        { status: 400 }
      );
    }

    const existing = tournament.entries.find((e) => e.userId === session.user.id);
    if (existing) {
      return NextResponse.json({ error: "Already joined" }, { status: 409 });
    }

    if (tournament.type === "SOLO") {
      if (
        tournament.maxPlayers &&
        tournament.entries.length >= tournament.maxPlayers
      ) {
        return NextResponse.json({ error: "Tournament full" }, { status: 400 });
      }

      const entry = await prisma.tournamentEntry.create({
        data: { tournamentId: id, userId: session.user.id },
      });

      await createNotification({
        userId: tournament.organizerId,
        type: "TOURNAMENT_JOIN",
        titleEn: "New participant",
        titleFr: "Nouveau participant",
        messageEn: `${session.user.username} joined your tournament`,
        messageFr: `${session.user.username} a rejoint votre tournoi`,
        link: `/tournaments/${id}`,
      });

      return NextResponse.json(entry, { status: 201 });
    }

    if (tournament.type === "TEAM" && body.teamId) {
      if (
        tournament.maxTeams &&
        tournament.entries.length >= tournament.maxTeams
      ) {
        return NextResponse.json({ error: "Tournament full" }, { status: 400 });
      }

      const existingTeam = tournament.entries.find(
        (e) => e.teamId === body.teamId
      );
      if (existingTeam) {
        return NextResponse.json(
          { error: "Team already registered" },
          { status: 409 }
        );
      }

      const team = await prisma.team.findUnique({
        where: { id: body.teamId },
        include: {
          members: {
            where: { userId: session.user.id },
            select: { id: true },
          },
          _count: { select: { members: true } },
        },
      });

      if (!team || team.members.length === 0) {
        return NextResponse.json(
          { error: "You are not a member of this team" },
          { status: 403 }
        );
      }

      if (team._count.members < MIN_TEAM_ROSTER_SIZE) {
        return NextResponse.json(
          {
            error: "team_too_small",
            memberCount: team._count.members,
            required: MIN_TEAM_ROSTER_SIZE,
          },
          { status: 400 }
        );
      }

      const registrationCheck = await assertTeamCanRegisterForTournament(
        id,
        body.teamId
      );
      if (!registrationCheck.ok) {
        return NextResponse.json(
          {
            error: "member_conflict",
            conflicts: registrationCheck.conflicts,
          },
          { status: 409 }
        );
      }

      const entry = await prisma.tournamentEntry.create({
        data: { tournamentId: id, teamId: body.teamId },
      });

      await createNotification({
        userId: tournament.organizerId,
        type: "TOURNAMENT_JOIN",
        titleEn: "New team registered",
        titleFr: "Nouvelle équipe inscrite",
        messageEn: `Team ${team.name} joined your tournament`,
        messageFr: `L'équipe ${team.name} a rejoint votre tournoi`,
        link: `/tournaments/${id}`,
      });

      return NextResponse.json(entry, { status: 201 });
    }

    return NextResponse.json({ error: "Team ID required" }, { status: 400 });
  }

  if (action === "start_check_in") {
    if (!(await canManageTournament(id, session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await startTournamentCheckIn(id);
    if (!result.ok) {
      const status =
        result.error === "not_found"
          ? 404
          : result.error === "no_entries"
            ? 400
            : 400;
      if (result.error === "min_participants") {
        return NextResponse.json(
          {
            error: result.error,
            required: result.required,
            current: result.current,
          },
          { status }
        );
      }
      if (result.error === "solo_team_size_mismatch") {
        return NextResponse.json(
          {
            error: result.error,
            minPlayers: result.minPlayers,
            teamSize: result.teamSize,
            current: result.current,
          },
          { status }
        );
      }
      return NextResponse.json({ error: result.error }, { status });
    }

    const updated = await prisma.tournament.findUnique({ where: { id } });
    return NextResponse.json(updated);
  }

  if (action === "confirm_check_in") {
    const result = await confirmTournamentCheckIn(id, session.user.id);
    if (!result.ok) {
      const status = result.error === "not_participant" ? 403 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ ok: true, already: result.already ?? false });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!(await canManageTournament(id, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await prisma.tournament.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/tournaments/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
