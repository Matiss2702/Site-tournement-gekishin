import { prisma } from "./prisma";

type NewEntry = { userId: string } | { teamId: string };

/**
 * Creates a tournament entry only if a slot is still free.
 * The tournament row is locked for the duration of the transaction so two
 * concurrent signups cannot both pass the capacity check and overflow it.
 */
export async function createEntryWithinCapacity(
  tournamentId: string,
  capacity: number | null,
  data: NewEntry
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Tournament" WHERE id = ${tournamentId} FOR UPDATE`;

    if (capacity) {
      const count = await tx.tournamentEntry.count({ where: { tournamentId } });
      if (count >= capacity) return null;
    }

    return tx.tournamentEntry.create({ data: { tournamentId, ...data } });
  });
}
