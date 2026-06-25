import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import {
  isValidSoloPlayerCount,
  MIN_SOLO_PLAYERS,
  MIN_TOURNAMENT_PARTICIPANTS,
  SOLO_TEAM_SIZE,
} from "@/lib/tournament-prize-config";
import { formRandomTeamsForSoloTournament } from "@/lib/tournament-random-teams";

export async function getTournamentCheckInSummary(tournamentId: string) {
  const entries = await prisma.tournamentEntry.findMany({
    where: { tournamentId },
    include: {
      team: { select: { id: true, name: true, tag: true, captainId: true } },
      user: { select: { id: true, username: true } },
    },
    orderBy: { registeredAt: "asc" },
  });

  return {
    total: entries.length,
    checkedIn: entries.filter((e) => e.checkedInAt).length,
    allCheckedIn:
      entries.length > 0 && entries.every((entry) => entry.checkedInAt),
    entries: entries.map((entry) => ({
      id: entry.id,
      checkedInAt: entry.checkedInAt,
      name: entry.team
        ? entry.team.name
        : entry.user?.username ?? "—",
      tag: entry.team?.tag ?? null,
      captainId: entry.team?.captainId ?? entry.userId,
      isCheckedIn: !!entry.checkedInAt,
    })),
  };
}

export async function startTournamentCheckIn(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      title: true,
      status: true,
      type: true,
      entries: {
        include: {
          team: { select: { captainId: true } },
          user: { select: { id: true } },
        },
      },
    },
  });

  if (!tournament) {
    return { ok: false as const, error: "not_found" };
  }
  if (tournament.status !== "REGISTRATION") {
    return { ok: false as const, error: "invalid_status" };
  }

  const soloPlayers =
    tournament.type === "SOLO"
      ? tournament.entries.filter((entry) => entry.userId && !entry.teamId)
      : [];
  const teamEntries =
    tournament.type === "TEAM"
      ? tournament.entries.filter((entry) => entry.teamId)
      : [];

  const participantCount =
    tournament.type === "SOLO" ? soloPlayers.length : teamEntries.length;

  if (participantCount === 0) {
    return { ok: false as const, error: "no_entries" };
  }

  if (tournament.type === "SOLO") {
    if (!isValidSoloPlayerCount(soloPlayers.length)) {
      return {
        ok: false as const,
        error: "solo_team_size_mismatch" as const,
        minPlayers: MIN_SOLO_PLAYERS,
        teamSize: SOLO_TEAM_SIZE,
        current: soloPlayers.length,
      };
    }

    const formed = await formRandomTeamsForSoloTournament(tournamentId);
    if (!formed.ok) {
      return formed;
    }
  } else if (teamEntries.length < MIN_TOURNAMENT_PARTICIPANTS) {
    return {
      ok: false as const,
      error: "min_participants" as const,
      required: MIN_TOURNAMENT_PARTICIPANTS,
      current: teamEntries.length,
    };
  }

  await prisma.$transaction([
    prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: "CHECK_IN" },
    }),
    prisma.tournamentEntry.updateMany({
      where: { tournamentId },
      data: { checkedInAt: null },
    }),
  ]);

  const entriesForCheckIn = await prisma.tournamentEntry.findMany({
    where: { tournamentId },
    include: {
      team: { select: { captainId: true } },
      user: { select: { id: true } },
    },
  });

  const notifyUserIds = new Set<string>();
  for (const entry of entriesForCheckIn) {
    if (entry.team?.captainId) notifyUserIds.add(entry.team.captainId);
    else if (entry.userId) notifyUserIds.add(entry.userId);
  }

  const link = `/tournaments/${tournamentId}`;

  await Promise.all(
    [...notifyUserIds].map((userId) =>
      createNotification({
        userId,
        type: "TOURNAMENT_CHECK_IN",
        titleEn: "Tournament check-in",
        titleFr: "Check-in du tournoi",
        messageEn: `Confirm your presence for "${tournament.title}".`,
        messageFr: `Confirmez votre présence pour « ${tournament.title} ».`,
        link,
      })
    )
  );

  return { ok: true as const };
}

export async function confirmTournamentCheckIn(
  tournamentId: string,
  userId: string
) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { status: true },
  });

  if (!tournament || tournament.status !== "CHECK_IN") {
    return { ok: false as const, error: "check_in_closed" };
  }

  const entry = await prisma.tournamentEntry.findFirst({
    where: {
      tournamentId,
      OR: [{ team: { captainId: userId } }, { userId }],
    },
  });

  if (!entry) {
    return { ok: false as const, error: "not_participant" };
  }

  if (entry.checkedInAt) {
    return { ok: true as const, already: true };
  }

  await prisma.tournamentEntry.update({
    where: { id: entry.id },
    data: { checkedInAt: new Date() },
  });

  return { ok: true as const };
}

export async function assertAllParticipantsCheckedIn(tournamentId: string) {
  const unchecked = await prisma.tournamentEntry.count({
    where: { tournamentId, checkedInAt: null },
  });
  return unchecked === 0;
}

/** Solo entries with a userId, or team entries where the user is captain. */
export function canUserConfirmCheckInForEntry(
  entry: {
    userId: string | null;
    team: { captainId: string } | null;
  },
  userId: string
) {
  if (entry.userId === userId) return true;
  return entry.team?.captainId === userId;
}

export function findUserTournamentEntry<
  T extends {
    userId: string | null;
    team: {
      captainId: string;
      members: { user: { id: string } }[];
    } | null;
  },
>(entries: T[], userId: string) {
  return entries.find(
    (entry) =>
      entry.userId === userId ||
      entry.team?.members.some((member) => member.user.id === userId)
  );
}
