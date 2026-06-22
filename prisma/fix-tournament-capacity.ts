import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const TOURNAMENT_ID = "cmqo5uuvu00091ymslsb7ke5q";
const TARGET_MAX_TEAMS = 8;
const TEAMS_TO_UNREGISTER = [
  "Frieza Force",
  "Galactic Patrol",
  "Majin Squad",
];

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

  console.log(`Fixing: ${tournament.title}`);
  console.log(`  maxTeams: ${tournament.maxTeams} → ${TARGET_MAX_TEAMS}`);

  await prisma.tournament.update({
    where: { id: TOURNAMENT_ID },
    data: { maxTeams: TARGET_MAX_TEAMS },
  });

  for (const teamName of TEAMS_TO_UNREGISTER) {
    const team = await prisma.team.findFirst({ where: { name: teamName } });
    if (!team) continue;

    const deleted = await prisma.tournamentEntry.deleteMany({
      where: { tournamentId: TOURNAMENT_ID, teamId: team.id },
    });
    if (deleted.count > 0) {
      console.log(`  Removed registration: ${teamName}`);
    }
  }

  const entries = await prisma.tournamentEntry.findMany({
    where: { tournamentId: TOURNAMENT_ID },
    include: { team: { select: { name: true } } },
    orderBy: { registeredAt: "asc" },
  });

  console.log(`\n${entries.length} / ${TARGET_MAX_TEAMS} teams registered:`);
  for (const entry of entries) {
    console.log(`  - ${entry.team?.name}`);
  }

  if (entries.length < TARGET_MAX_TEAMS) {
    console.log(
      `\n${TARGET_MAX_TEAMS - entries.length} slot(s) still open for registration.`
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
