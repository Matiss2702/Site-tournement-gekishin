import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import {
  isTournamentDecisivelyComplete,
  placementLabel,
  resolveTournamentPlacements,
  type TournamentPlacements,
} from "@/lib/tournament-placements";
import { getBracketSize } from "@/lib/bracket";

type Tx = Prisma.TransactionClient;

type TournamentForPrizes = {
  id: string;
  title: string;
  type: string;
  format: string;
  status: string;
  prizesDistributedAt: Date | null;
  prizeCodes: { id: string; placement: number; code: string; grantId: string | null }[];
  entries: { userId: string | null; teamId: string | null }[];
  matches: {
    round: number;
    matchNumber: number;
    status: string;
    team1Id: string | null;
    team2Id: string | null;
    winnerId: string | null;
  }[];
};

type PendingPrizeNotification = {
  userId: string;
  placement: number;
  code: string;
};

async function getRecipientUserIds(
  client: Tx,
  tournament: Pick<TournamentForPrizes, "type">,
  participantId: string
) {
  const members = await client.teamMember.findMany({
    where: { teamId: participantId },
    select: { userId: true },
    orderBy: [{ memberRole: "asc" }, { joinedAt: "asc" }],
  });
  if (members.length > 0) {
    return members.map((m) => m.userId);
  }

  if (tournament.type === "TEAM") {
    return [];
  }

  return [participantId];
}

async function distributePlacementPrizes(
  client: Tx,
  tournament: TournamentForPrizes,
  placement: number,
  participantId: string
): Promise<PendingPrizeNotification[]> {
  const userIds = await getRecipientUserIds(client, tournament, participantId);
  if (userIds.length === 0) return [];

  const availableCodes = await client.tournamentPrizeCode.findMany({
    where: {
      tournamentId: tournament.id,
      placement,
      grantId: null,
    },
    orderBy: { createdAt: "asc" },
    take: userIds.length,
  });

  if (availableCodes.length === 0) return [];

  const teamId =
    tournament.type === "TEAM" || userIds.length > 1 ? participantId : null;
  const pending: PendingPrizeNotification[] = [];

  for (let i = 0; i < userIds.length; i++) {
    const codeRow = availableCodes[i];
    if (!codeRow) break;

    const userId = userIds[i];
    const existing = await client.tournamentPrizeGrant.findUnique({
      where: {
        tournamentId_userId: { tournamentId: tournament.id, userId },
      },
    });
    if (existing) continue;

    const grant = await client.tournamentPrizeGrant.create({
      data: {
        tournamentId: tournament.id,
        userId,
        teamId,
        placement,
        code: codeRow.code,
      },
    });

    await client.tournamentPrizeCode.update({
      where: { id: codeRow.id },
      data: { grantId: grant.id },
    });

    pending.push({ userId, placement, code: codeRow.code });
  }

  return pending;
}

async function applyPrizeDistribution(
  client: Tx,
  tournament: TournamentForPrizes,
  placements: TournamentPlacements
) {
  const rows: Array<{ placement: number; participantId: string | null }> = [
    { placement: 1, participantId: placements.first },
    { placement: 2, participantId: placements.second },
    { placement: 3, participantId: placements.third },
  ];

  const pending: PendingPrizeNotification[] = [];

  for (const row of rows) {
    if (!row.participantId) continue;
    const hasCodes = tournament.prizeCodes.some(
      (code) => code.placement === row.placement
    );
    if (!hasCodes) continue;

    const created = await distributePlacementPrizes(
      client,
      tournament,
      row.placement,
      row.participantId
    );
    pending.push(...created);
  }

  await client.tournament.update({
    where: { id: tournament.id },
    data: { prizesDistributedAt: new Date() },
  });

  return pending;
}

async function sendPrizeNotifications(
  tournament: Pick<TournamentForPrizes, "id" | "title">,
  pending: PendingPrizeNotification[]
) {
  for (const row of pending) {
    const user = await prisma.user.findUnique({
      where: { id: row.userId },
      select: { locale: true },
    });
    const locale = user?.locale === "fr" ? "fr" : "en";
    const placeLabel = placementLabel(row.placement, locale);

    await createNotification({
      userId: row.userId,
      type: "TOURNAMENT_PRIZE",
      titleEn: "Tournament prize code",
      titleFr: "Code récompense tournoi",
      messageEn: `You earned ${placeLabel} in "${tournament.title}". Your personal code: ${row.code}`,
      messageFr: `Vous avez obtenu la ${placeLabel} dans « ${tournament.title} ». Votre code personnel : ${row.code}`,
      link: `/tournaments/${tournament.id}`,
    });
  }
}

export async function tryCompleteTournamentAndDistributePrizes(
  tournamentId: string
) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      prizeCodes: { orderBy: [{ placement: "asc" }, { createdAt: "asc" }] },
      entries: { select: { userId: true, teamId: true } },
      matches: {
        select: {
          round: true,
          matchNumber: true,
          status: true,
          team1Id: true,
          team2Id: true,
          winnerId: true,
        },
      },
    },
  });

  if (!tournament || tournament.status === "COMPLETED") {
    return;
  }

  const bracketSize = getBracketSize(tournament.entries.length);
  const placements = resolveTournamentPlacements(
    tournament.format,
    bracketSize,
    tournament.matches
  );

  if (!placements?.first) return;

  const pending = await prisma.$transaction(async (tx) => {
    const fresh = await tx.tournament.findUnique({
      where: { id: tournamentId },
      select: { status: true, prizesDistributedAt: true },
    });
    if (!fresh || fresh.status === "COMPLETED") {
      return [];
    }

    await tx.tournament.update({
      where: { id: tournamentId },
      data: {
        status: "COMPLETED",
        endDate: new Date(),
      },
    });

    if (tournament.prizeCodes.length === 0 || fresh.prizesDistributedAt) {
      return [];
    }

    return applyPrizeDistribution(tx, tournament, placements);
  });

  if (pending.length > 0) {
    await sendPrizeNotifications(tournament, pending);
  }
}

export async function syncTournamentCompletionIfReady(
  tournamentId: string
): Promise<string | null> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      status: true,
      format: true,
      entries: { select: { id: true } },
      matches: {
        select: {
          round: true,
          matchNumber: true,
          status: true,
          team1Id: true,
          team2Id: true,
          winnerId: true,
        },
      },
    },
  });

  if (!tournament) return null;
  if (tournament.status !== "IN_PROGRESS") return tournament.status;

  const bracketSize = getBracketSize(tournament.entries.length);
  if (
    !isTournamentDecisivelyComplete(
      tournament.format,
      bracketSize,
      tournament.matches
    )
  ) {
    return tournament.status;
  }

  await tryCompleteTournamentAndDistributePrizes(tournamentId);

  const refreshed = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { status: true },
  });

  return refreshed?.status ?? tournament.status;
}

export async function getUserTournamentPrize(
  tournamentId: string,
  userId: string
) {
  return prisma.tournamentPrizeGrant.findUnique({
    where: { tournamentId_userId: { tournamentId, userId } },
    include: {
      team: { select: { id: true, name: true, tag: true } },
    },
  });
}
