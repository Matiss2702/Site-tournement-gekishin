import { prisma } from "@/lib/prisma";
import { consentIsComplete, requiresBandaiConsent } from "@/lib/bandai-support";

export async function isPlatformAdmin(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === "ADMIN";
}

export async function getParticipantConsent(tournamentId: string, userId: string) {
  return prisma.tournamentParticipantConsent.findUnique({
    where: { tournamentId_userId: { tournamentId, userId } },
  });
}

/** Dates are always taken from the server. A later call does not move them. */
export async function recordParticipantConsent(tournamentId: string, userId: string) {
  const existing = await getParticipantConsent(tournamentId, userId);
  if (consentIsComplete(existing)) return existing;

  const now = new Date();
  const consent = await prisma.tournamentParticipantConsent.upsert({
    where: { tournamentId_userId: { tournamentId, userId } },
    create: {
      tournamentId,
      userId,
      isAdultConfirmed: true,
      adultConfirmedAt: now,
      rulesAccepted: true,
      rulesAcceptedAt: now,
    },
    update: {
      isAdultConfirmed: true,
      adultConfirmedAt: now,
      rulesAccepted: true,
      rulesAcceptedAt: now,
    },
  });

  await prisma.tournamentEntry.updateMany({
    where: { tournamentId, userId },
    data: {
      isAdultConfirmed: true,
      adultConfirmedAt: now,
      rulesAccepted: true,
      rulesAcceptedAt: now,
    },
  });

  return consent;
}

export async function usersMissingBandaiConsent(
  tournamentId: string,
  userIds: string[]
) {
  if (userIds.length === 0) return [];
  const consents = await prisma.tournamentParticipantConsent.findMany({
    where: { tournamentId, userId: { in: userIds } },
    select: { userId: true, isAdultConfirmed: true, rulesAccepted: true },
  });
  const complete = new Set(
    consents.filter((row) => consentIsComplete(row)).map((row) => row.userId)
  );
  return userIds.filter((userId) => !complete.has(userId));
}

export async function entryNeedsBandaiConsent(
  tournamentId: string,
  status: string,
  entry: {
    userId: string | null;
    team?: { members: { userId: string }[] } | null;
  }
) {
  if (!requiresBandaiConsent(status)) return false;
  const userIds = entry.userId
    ? [entry.userId]
    : (entry.team?.members.map((member) => member.userId) ?? []);
  const missing = await usersMissingBandaiConsent(tournamentId, userIds);
  return missing.length > 0;
}
