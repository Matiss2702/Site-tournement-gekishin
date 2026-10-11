import { prisma } from "@/lib/prisma";
import { PRIZE_CODES_PER_TEAM, PRIZE_PLACEMENTS } from "@/lib/tournament-prize-config";
import { distributeOutstandingPrizes } from "@/lib/tournament-prizes";

export type PrizeCodeInput = { placement: number; code: string };

export async function saveTournamentPrizeCodes(
  tournamentId: string,
  prizeCodes: PrizeCodeInput[]
) {
  const existing = await prisma.tournamentPrizeCode.findMany({
    where: { tournamentId },
  });

  const normalized = prizeCodes.map((row) => ({
    placement: row.placement,
    code: row.code.trim(),
  }));

  if (new Set(normalized.map((row) => row.code)).size !== normalized.length) {
    return { ok: false as const, error: "prize_code_duplicate" as const };
  }

  for (const placement of PRIZE_PLACEMENTS) {
    const incoming = normalized.filter((row) => row.placement === placement);
    const granted = existing.filter(
      (row) => row.placement === placement && row.grantId
    );
    if (incoming.length > 0 && incoming.length !== PRIZE_CODES_PER_TEAM) {
      return {
        ok: false as const,
        error: "prize_codes_per_placement" as const,
      };
    }
    const incomingCodes = new Set(incoming.map((row) => row.code));
    if (granted.some((row) => !incomingCodes.has(row.code))) {
      return {
        ok: false as const,
        error: "prize_code_already_granted" as const,
      };
    }
  }

  const grantedCodes = new Set(
    existing.filter((row) => row.grantId).map((row) => row.code)
  );

  await prisma.$transaction(async (tx) => {
    await tx.tournamentPrizeCode.deleteMany({
      where: { tournamentId, grantId: null },
    });
    const toCreate = normalized.filter((row) => !grantedCodes.has(row.code));
    if (toCreate.length > 0) {
      await tx.tournamentPrizeCode.createMany({
        data: toCreate.map((row) => ({
          tournamentId,
          placement: row.placement,
          code: row.code,
        })),
      });
    }
  });

  const delivered = await distributeOutstandingPrizes(tournamentId);
  return { ok: true as const, delivered };
}
