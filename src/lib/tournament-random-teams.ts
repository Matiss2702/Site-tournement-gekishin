import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import {
  isValidSoloPlayerCount,
  MIN_SOLO_PLAYERS,
  SOLO_TEAM_SIZE,
} from "@/lib/tournament-prize-config";

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export async function formRandomTeamsForSoloTournament(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      title: true,
      type: true,
      entries: {
        where: { userId: { not: null }, teamId: null },
        include: {
          user: { select: { id: true, username: true, displayName: true } },
        },
      },
    },
  });

  if (!tournament) {
    return { ok: false as const, error: "not_found" as const };
  }

  if (tournament.type !== "SOLO") {
    return { ok: false as const, error: "invalid_type" as const };
  }

  const players = tournament.entries;
  if (players.length === 0) {
    return { ok: false as const, error: "no_entries" as const };
  }

  if (!isValidSoloPlayerCount(players.length)) {
    return {
      ok: false as const,
      error: "solo_team_size_mismatch" as const,
      minPlayers: MIN_SOLO_PLAYERS,
      teamSize: SOLO_TEAM_SIZE,
      current: players.length,
    };
  }

  const shuffled = shuffle(players);
  const groups: typeof players[] = [];
  for (let i = 0; i < shuffled.length; i += SOLO_TEAM_SIZE) {
    groups.push(shuffled.slice(i, i + SOLO_TEAM_SIZE));
  }

  const teamAssignments: {
    teamId: string;
    teamName: string;
    userIds: string[];
    captainId: string;
  }[] = [];

  await prisma.$transaction(async (tx) => {
    const oldEntryIds = players.map((entry) => entry.id);

    for (let index = 0; index < groups.length; index++) {
      const group = groups[index];
      const captain = group[0].user!;
      const teamNumber = index + 1;
      const teamName = `Équipe ${teamNumber}`;

      const team = await tx.team.create({
        data: {
          name: teamName,
          tag: String(teamNumber).padStart(2, "0"),
          captainId: captain.id,
          tournamentId,
          members: {
            create: group.map((entry, memberIndex) => ({
              userId: entry.user!.id,
              memberRole: memberIndex === 0 ? "CAPTAIN" : "MEMBER",
            })),
          },
        },
      });

      await tx.tournamentEntry.create({
        data: {
          tournamentId,
          teamId: team.id,
        },
      });

      teamAssignments.push({
        teamId: team.id,
        teamName,
        userIds: group.map((entry) => entry.user!.id),
        captainId: captain.id,
      });
    }

    await tx.tournamentEntry.deleteMany({
      where: { id: { in: oldEntryIds } },
    });
  });

  const link = `/tournaments/${tournamentId}`;

  await Promise.all(
    teamAssignments.flatMap((assignment) =>
      assignment.userIds.map((userId) =>
        createNotification({
          userId,
          type: "TOURNAMENT_JOIN",
          titleEn: "Team assigned",
          titleFr: "Équipe attribuée",
          messageEn: `You were placed on ${assignment.teamName} for "${tournament.title}".`,
          messageFr: `Vous avez été placé dans ${assignment.teamName} pour « ${tournament.title} ».`,
          link,
        })
      )
    )
  );

  return { ok: true as const, teamCount: teamAssignments.length };
}

export function soloTournamentUsesTeams(
  type: string,
  entries: { userId: string | null; teamId: string | null }[]
) {
  return type === "SOLO" && entries.some((entry) => entry.teamId != null);
}
