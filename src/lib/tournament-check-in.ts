import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { MIN_TOURNAMENT_PARTICIPANTS } from "@/lib/tournament-prize-config";

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
  if (tournament.entries.length === 0) {
    return { ok: false as const, error: "no_entries" };
  }
  if (tournament.entries.length < MIN_TOURNAMENT_PARTICIPANTS) {
    return {
      ok: false as const,
      error: "min_participants" as const,
      required: MIN_TOURNAMENT_PARTICIPANTS,
      current: tournament.entries.length,
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

  const notifyUserIds = new Set<string>();
  for (const entry of tournament.entries) {
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
