import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { getBracketSize } from "../src/lib/bracket";
import { repairBracketProgression } from "../src/lib/bracket-progression";

const TOURNAMENT_ID = process.argv[2] ?? "cmqo5uuvu00091ymslsb7ke5q";

function getConnectionString() {
  const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url || url.startsWith("prisma+")) {
    throw new Error("DIRECT_DATABASE_URL must be a postgres:// URL");
  }
  return url;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: getConnectionString() })),
});

async function main() {
  const tournament = await prisma.tournament.findUnique({
    where: { id: TOURNAMENT_ID },
    select: { title: true, format: true },
  });
  if (!tournament) throw new Error("Tournament not found");

  const entryCount = await prisma.tournamentEntry.count({
    where: { tournamentId: TOURNAMENT_ID },
  });
  const bracketSize = getBracketSize(entryCount);

  console.log(`Repairing losers bracket: ${tournament.title}`);

  await prisma.$transaction(async (tx) => {
    await repairBracketProgression(
      tx,
      TOURNAMENT_ID,
      bracketSize,
      tournament.format
    );
  });

  const lb = await prisma.match.findMany({
    where: { tournamentId: TOURNAMENT_ID, round: { lt: 0 } },
    orderBy: [{ round: "desc" }, { matchNumber: "asc" }],
    include: {
      team1: { select: { name: true } },
      team2: { select: { name: true } },
    },
  });

  console.log("\nLosers bracket after repair:");
  for (const m of lb) {
    console.log(
      `  R${m.round} M${m.matchNumber} [${m.status}]`,
      m.team1?.name ?? "—",
      "vs",
      m.team2?.name ?? "—"
    );
  }

  const gf = await prisma.match.findFirst({
    where: { tournamentId: TOURNAMENT_ID, round: 0 },
    include: {
      team1: { select: { name: true } },
      team2: { select: { name: true } },
    },
  });
  if (gf) {
    console.log(
      `\nGrand final:`,
      gf.team1?.name ?? "—",
      "vs",
      gf.team2?.name ?? "—"
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
