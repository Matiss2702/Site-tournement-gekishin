import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const TOURNAMENT_ID = "cmqo5uuvu00091ymslsb7ke5q";
const TEAM_NAME = "Frieza Force";

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
    select: { title: true, maxTeams: true },
  });
  if (!tournament) throw new Error("Tournament not found");

  const entryCount = await prisma.tournamentEntry.count({
    where: { tournamentId: TOURNAMENT_ID },
  });

  if (tournament.maxTeams && entryCount >= tournament.maxTeams) {
    throw new Error("Tournament is already full");
  }

  const team = await prisma.team.findFirst({ where: { name: TEAM_NAME } });
  if (!team) throw new Error(`Team not found: ${TEAM_NAME}`);

  const alreadyRegistered = await prisma.tournamentEntry.findFirst({
    where: { tournamentId: TOURNAMENT_ID, teamId: team.id },
  });
  if (alreadyRegistered) {
    throw new Error(`${TEAM_NAME} is already registered`);
  }

  const r1m4 = await prisma.match.findFirst({
    where: { tournamentId: TOURNAMENT_ID, round: 1, matchNumber: 4 },
  });
  if (!r1m4) throw new Error("Round 1 match 4 not found");

  const r2m2 = await prisma.match.findFirst({
    where: { tournamentId: TOURNAMENT_ID, round: 2, matchNumber: 2 },
  });

  await prisma.$transaction(async (tx) => {
    await tx.tournamentEntry.create({
      data: { tournamentId: TOURNAMENT_ID, teamId: team.id },
    });

    await tx.match.update({
      where: { id: r1m4.id },
      data: {
        team2Id: team.id,
        status: "pending",
        score1: 0,
        score2: 0,
        winnerId: null,
        playedAt: null,
      },
    });

    if (r2m2 && r2m2.team2Id === r1m4.team1Id) {
      await tx.match.update({
        where: { id: r2m2.id },
        data: { team2Id: null },
      });
    }
  });

  const count = await prisma.tournamentEntry.count({
    where: { tournamentId: TOURNAMENT_ID },
  });

  console.log(`Added ${TEAM_NAME} to ${tournament.title}`);
  console.log(`  Registration: ${count} / ${tournament.maxTeams}`);
  console.log(`  Tour 1 match 4: Red Ribbon vs ${TEAM_NAME} (pending)`);
  console.log(`  Login: seed_extra_t1@seed.gekishin.local / Password123!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
