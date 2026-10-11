import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  GameRole,
  TeamMemberRole,
} from "../src/generated/prisma/client";

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
  const { readFileSync } = await import("fs");
  const { join } = await import("path");
  const seedPath = join(__dirname, "data", "heroes-seed.json");
  const heroes = JSON.parse(readFileSync(seedPath, "utf8")) as Array<{
    id: string;
    nameEn: string;
    nameFr: string;
    gameRole: GameRole;
    imageUrl: string;
    officialId: string;
    summaryEn: string;
    summaryFr: string;
    skills: unknown;
  }>;

  for (const hero of heroes) {
    await prisma.hero.upsert({
      where: { nameEn: hero.nameEn },
      create: {
        id: hero.id,
        nameEn: hero.nameEn,
        nameFr: hero.nameFr,
        gameRole: hero.gameRole,
        imageUrl: hero.imageUrl,
        officialId: hero.officialId,
        summaryEn: hero.summaryEn,
        summaryFr: hero.summaryFr,
        skills: hero.skills as object[],
      },
      update: {
        nameFr: hero.nameFr,
        gameRole: hero.gameRole,
        imageUrl: hero.imageUrl,
        officialId: hero.officialId,
        summaryEn: hero.summaryEn,
        summaryFr: hero.summaryFr,
        skills: hero.skills as object[],
      },
    });
  }

  console.log(`Seeded ${heroes.length} heroes with skills`);
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

async function seedPlatformAdmin() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const displayName = process.env.ADMIN_DISPLAY_NAME?.trim() || "Bandai Namco";

  if (!username && !email && !password) {
    console.log(
      "\nADMIN_USERNAME, ADMIN_EMAIL and ADMIN_PASSWORD are empty — platform admin skipped."
    );
    return;
  }

  if (!username || !email || !password) {
    throw new Error(
      "Set ADMIN_USERNAME, ADMIN_EMAIL and ADMIN_PASSWORD together in .env to create the platform admin."
    );
  }

  if (username.startsWith(SEED_USERNAME_PREFIX)) {
    throw new Error(
      `ADMIN_USERNAME cannot start with "${SEED_USERNAME_PREFIX}" because those accounts are reset on every seed.`
    );
  }

  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters.");
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        username,
        email,
        password: hashedPassword,
        displayName,
        role: "ADMIN",
      },
    });
    console.log(`\nUpdated platform admin: ${username}`);
    return;
  }

  await prisma.user.create({
    data: {
      username,
      email,
      password: hashedPassword,
      displayName,
      role: "ADMIN",
      locale: "en",
    },
  });
  console.log(`\nCreated platform admin: ${username}`);
}

async function main() {
  console.log("Seeding heroes...");
  await seedHeroes();

  console.log("\nSeeding teams (4–6 members each)...");
  await seedTeams();

  await seedPlatformAdmin();
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
