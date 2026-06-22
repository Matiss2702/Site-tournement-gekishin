import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  GameRole,
  TeamMemberRole,
} from "../src/generated/prisma/client";
import { HEROES } from "../src/lib/heroes";

const SEED_PASSWORD = "Password123!";
const SEED_USERNAME_PREFIX = "seed_";

const TEAMS = [
  { name: "Saiyan Force", tag: "SFRC" },
  { name: "Capsule Corp", tag: "CAPS" },
  { name: "Red Ribbon", tag: "RRBC" },
  { name: "Namek Warriors", tag: "NAME" },
  { name: "Z Fighters", tag: "ZFTR" },
  { name: "Universe 7", tag: "UNI7" },
  { name: "Frieza Force", tag: "FRZA" },
  { name: "Galactic Patrol", tag: "GPTR" },
  { name: "Majin Squad", tag: "MAJN" },
] as const;

function getConnectionString() {
  const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url || url.startsWith("prisma+")) {
    throw new Error(
      "DIRECT_DATABASE_URL must be set to a postgres:// connection string"
    );
  }
  return url;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: getConnectionString() })),
});

function memberCountForTeam(index: number) {
  return 4 + (index % 3);
}

function buildMemberPlan(count: number): Array<{
  memberRole: TeamMemberRole;
  gameRole: GameRole | null;
}> {
  const plan: Array<{ memberRole: TeamMemberRole; gameRole: GameRole | null }> = [
    { memberRole: "CAPTAIN", gameRole: "DPS" },
    { memberRole: "MEMBER", gameRole: "TANK" },
    { memberRole: "MEMBER", gameRole: "SUPPORT" },
    { memberRole: "MEMBER", gameRole: "DPS" },
  ];

  for (let i = plan.length; i < count; i++) {
    plan.push({
      memberRole: "SUBSTITUTE",
      gameRole: i % 2 === 0 ? "DPS" : null,
    });
  }

  return plan.slice(0, count);
}

async function clearSeedTeams() {
  const seedUsers = await prisma.user.findMany({
    where: { username: { startsWith: SEED_USERNAME_PREFIX } },
    select: { id: true },
  });

  if (seedUsers.length === 0) return;

  const seedUserIds = seedUsers.map((u) => u.id);

  await prisma.tournamentEntry.deleteMany({
    where: {
      OR: [
        { userId: { in: seedUserIds } },
        { team: { captainId: { in: seedUserIds } } },
      ],
    },
  });

  await prisma.team.deleteMany({
    where: { captainId: { in: seedUserIds } },
  });

  await prisma.user.deleteMany({
    where: { id: { in: seedUserIds } },
  });
}

async function seedHeroes() {
  await prisma.hero.deleteMany();
  await prisma.hero.createMany({
    data: HEROES.map(({ nameEn, nameFr, gameRole, imageUrl }) => ({
      nameEn,
      nameFr,
      gameRole,
      imageUrl,
    })),
  });
  console.log(`Seeded ${HEROES.length} heroes`);
}

async function seedTeams() {
  await clearSeedTeams();

  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 12);
  let totalMembers = 0;

  for (const [teamIndex, teamDef] of TEAMS.entries()) {
    const memberCount = memberCountForTeam(teamIndex);
    const memberPlan = buildMemberPlan(memberCount);
    const memberIds: string[] = [];

    for (let memberIndex = 0; memberIndex < memberCount; memberIndex++) {
      const username = `${SEED_USERNAME_PREFIX}t${teamIndex + 1}_m${memberIndex + 1}`;
      const email = `${username}@seed.gekishin.local`;

      const user = await prisma.user.create({
        data: {
          email,
          username,
          password: hashedPassword,
          displayName: `${teamDef.name} ${memberIndex + 1}`,
          locale: teamIndex % 2 === 0 ? "fr" : "en",
        },
      });

      memberIds.push(user.id);
    }

    totalMembers += memberCount;

    await prisma.team.create({
      data: {
        name: teamDef.name,
        tag: teamDef.tag,
        captainId: memberIds[0],
        members: {
          create: memberIds.map((userId, memberIndex) => ({
            userId,
            memberRole: memberPlan[memberIndex].memberRole,
            gameRole: memberPlan[memberIndex].gameRole,
          })),
        },
      },
    });

    console.log(`  ${teamDef.name} [${teamDef.tag}] — ${memberCount} members`);
  }

  console.log(`\nSeeded ${TEAMS.length} teams (${totalMembers} users total)`);
  console.log(`Seed login password for all seed users: ${SEED_PASSWORD}`);
  console.log(`Example user: ${SEED_USERNAME_PREFIX}t1_m1`);
}

async function main() {
  console.log("Seeding heroes...");
  await seedHeroes();

  console.log("\nSeeding teams (4–6 members each)...");
  await seedTeams();
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
