import { prisma } from "@/lib/prisma";
import type { OrganizerPermission } from "@/generated/prisma/client";

export async function canManageDraft(
  tournamentId: string,
  userId: string
): Promise<boolean> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { organizerId: true },
  });

  if (!tournament) return false;
  if (tournament.organizerId === userId) return true;

  const organizer = await prisma.tournamentOrganizer.findFirst({
    where: {
      tournamentId,
      userId,
      permissions: { has: "MANAGE_DRAFT" satisfies OrganizerPermission },
    },
  });

  return !!organizer;
}

export async function canManageScores(
  tournamentId: string,
  userId: string
): Promise<boolean> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { organizerId: true },
  });

  if (!tournament) return false;
  if (tournament.organizerId === userId) return true;

  const organizer = await prisma.tournamentOrganizer.findFirst({
    where: {
      tournamentId,
      userId,
      permissions: { has: "MANAGE_SCORES" satisfies OrganizerPermission },
    },
  });

  return !!organizer;
}

export async function canManageTournament(
  tournamentId: string,
  userId: string
): Promise<boolean> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { organizerId: true },
  });

  if (!tournament) return false;
  if (tournament.organizerId === userId) return true;

  const organizer = await prisma.tournamentOrganizer.findFirst({
    where: {
      tournamentId,
      userId,
      permissions: { has: "MANAGE_TOURNAMENT" satisfies OrganizerPermission },
    },
  });

  return !!organizer;
}
