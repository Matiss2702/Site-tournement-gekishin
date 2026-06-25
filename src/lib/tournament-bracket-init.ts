import { prisma } from "@/lib/prisma";
import { buildRandomRound1Pairings, getBracketSize } from "@/lib/bracket";
import {
  advanceByeWinner,
  ensureBracketStructure,
} from "@/lib/bracket-progression";
import { syncTournamentMatchDrafts } from "@/lib/draft-matches";

export async function initializeTournamentBracketIfEmpty(tournamentId: string) {
  const existing = await prisma.match.count({ where: { tournamentId } });
  if (existing > 0) return;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { format: true },
  });
  if (!tournament) return;

  const entries = await prisma.tournamentEntry.findMany({
    where: { tournamentId },
    select: { teamId: true, userId: true },
  });

  const participantIds = entries
    .map((entry) => entry.teamId ?? entry.userId)
    .filter((id): id is string => !!id);

  if (participantIds.length < 2) return;

  const pairings = buildRandomRound1Pairings(participantIds);
  const bracketSize = getBracketSize(participantIds.length);
  const format = tournament.format;

  await prisma.$transaction(async (tx) => {
    await ensureBracketStructure(
      tx,
      tournamentId,
      participantIds.length,
      format
    );

    for (let i = 0; i < pairings.length; i++) {
      const pairing = pairings[i];
      const isBye = !pairing.team2Id;

      const match = await tx.match.update({
        where: {
          id: (
            await tx.match.findFirstOrThrow({
              where: {
                tournamentId,
                round: 1,
                matchNumber: i + 1,
              },
            })
          ).id,
        },
        data: {
          team1Id: pairing.team1Id,
          team2Id: pairing.team2Id,
          status: isBye ? "bye" : "pending",
        },
      });

      if (isBye) {
        await advanceByeWinner(
          tx,
          tournamentId,
          match,
          bracketSize,
          format
        );
      }
    }
  });

  await syncTournamentMatchDrafts(tournamentId);
}
