import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  buildRandomRound1Pairings,
  getBracketSize,
} from "../src/lib/bracket";
import {
  advanceByeWinner,
  ensureBracketStructure,
  propagateAdvancement,
  resolveWinnerId,
  updateEntryStats,
} from "../src/lib/bracket-progression";
import {
  countHeroBansByRole,
  countHeroPicksByRole,
  getBansPerRole,
  getPicksPerRole,
} from "../src/lib/draft";
import { executeDraftAction } from "../src/lib/draft-actions";
import { isMatchDraftComplete } from "../src/lib/draft-match-status";
import {
  getCurrentDraftRound,
  isMatchDraftable,
  launchDraftsForRound,
  syncTournamentMatchDrafts,
} from "../src/lib/draft-matches";
import { getActiveTeamId } from "../src/lib/draft-turn-order";
import type { GameRole } from "../src/components/HeroCard";

const ORGANIZER_EMAIL = "xxbloodriverxx120@gmail.com";

const TEAM_IDS = [
  "cmqo6fuh60014lzms8btq2cnh", // Saiyan Force
  "cmqo6fuhp001elzms9vt5ki61", // Capsule Corp
  "cmqo6fuia001qlzms82g4zvzz", // Red Ribbon
  "cmqo6fuin0021lzmshiiu0ca9", // Namek Warriors
  "cmqo6fuj0002blzms71mhzts0", // Z Fighters
  "cmqo6fujg002nlzms1xd14mjn", // Universe 7
  "cmqp55b450001sxmse1nov4cg", // Frieza Force
  "cmqp55bgc0005sxms0u9mi8dm", // Galactic Patrol
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

type HeroRow = {
  nameEn: string;
  gameRole: GameRole;
};

function buildHeroRoleMap(heroes: HeroRow[]) {
  return new Map(heroes.map((h) => [h.nameEn, h.gameRole]));
}

function usedHeroNames(
  actions: { heroName: string | null; action: string }[]
) {
  return new Set(
    actions
      .filter((a) => (a.action === "BAN" || a.action === "PICK") && a.heroName)
      .map((a) => a.heroName!)
  );
}

function pickBanHero(
  heroes: HeroRow[],
  actions: { heroName: string | null; action: string; teamId: string | null }[],
  teamId: string,
  heroRoleByName: Map<string, GameRole>
) {
  const used = usedHeroNames(actions);
  const counts = countHeroBansByRole(actions, heroRoleByName, teamId);
  const roleOrder: GameRole[] = ["DPS", "DPS", "SUPPORT", "TANK"];

  for (const role of roleOrder) {
    if (counts[role] >= getBansPerRole(role)) continue;
    const hero = heroes.find((h) => h.gameRole === role && !used.has(h.nameEn));
    if (hero) return hero;
  }

  for (const role of ["TANK", "SUPPORT", "DPS"] as GameRole[]) {
    if (counts[role] >= getBansPerRole(role)) continue;
    const hero = heroes.find((h) => h.gameRole === role && !used.has(h.nameEn));
    if (hero) return hero;
  }

  return null;
}

function pickPickHero(
  heroes: HeroRow[],
  actions: { heroName: string | null; action: string; teamId: string | null }[],
  teamId: string,
  heroRoleByName: Map<string, GameRole>
) {
  const used = usedHeroNames(actions);
  const counts = countHeroPicksByRole(actions, heroRoleByName, teamId);
  const roleOrder: GameRole[] = ["TANK", "SUPPORT", "DPS", "DPS"];

  for (const role of roleOrder) {
    if (counts[role] >= getPicksPerRole(role)) continue;
    const hero = heroes.find((h) => h.gameRole === role && !used.has(h.nameEn));
    if (hero) return hero;
  }

  return null;
}

async function completeMatchDraft(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { team1Id: true, team2Id: true },
  });
  if (!match?.team1Id || !match.team2Id) return;

  const heroes = await prisma.hero.findMany({
    select: { nameEn: true, gameRole: true },
  });
  const heroRoleByName = buildHeroRoleMap(
    heroes.map((h) => ({ nameEn: h.nameEn, gameRole: h.gameRole as GameRole }))
  );

  let config = await prisma.draftConfig.findUnique({ where: { matchId } });
  if (!config) throw new Error(`No draft config for match ${matchId}`);

  let guard = 0;
  while (config?.isActive && guard++ < 30) {
    const actions = await prisma.draftAction_.findMany({
      where: { matchId },
      orderBy: { order: "asc" },
    });

    const phase =
      config.currentPhase === "HERO_PICK" ? "HERO_PICK" : "HERO_BAN";
    const activeTeamId = getActiveTeamId(
      phase,
      actions,
      match.team1Id,
      match.team2Id
    );
    if (!activeTeamId) break;

    const hero =
      phase === "HERO_BAN"
        ? pickBanHero(heroes, actions, activeTeamId, heroRoleByName)
        : pickPickHero(heroes, actions, activeTeamId, heroRoleByName);

    if (!hero) {
      throw new Error(`No hero available for ${phase} match ${matchId}`);
    }

    const result = await executeDraftAction(matchId, {
      action: phase === "HERO_BAN" ? "BAN" : "PICK",
      phase,
      heroName: hero.nameEn,
      teamId: activeTeamId,
    });

    if ("error" in result) {
      throw new Error(`${phase} failed on ${matchId}: ${result.error}`);
    }

    config = await prisma.draftConfig.findUnique({ where: { matchId } });
  }

  const done = await isMatchDraftComplete(matchId);
  if (!done) {
    throw new Error(`Draft not complete for match ${matchId}`);
  }
}

async function scoreMatch(
  tournamentId: string,
  matchId: string,
  winnerId: string
) {
  const existing = await prisma.match.findFirst({
    where: { id: matchId, tournamentId },
  });
  if (!existing?.team1Id || !existing.team2Id) return;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { format: true },
  });
  const format = tournament?.format ?? "DOUBLE_ELIMINATION";

  const entryCount = await prisma.tournamentEntry.count({ where: { tournamentId } });
  const bracketSize = getBracketSize(entryCount);

  const loserId =
    existing.team1Id === winnerId ? existing.team2Id : existing.team1Id;

  await prisma.$transaction(async (tx) => {
    const updated = await tx.match.update({
      where: { id: matchId },
      data: {
        score1: winnerId === existing.team1Id ? 1 : 0,
        score2: winnerId === existing.team2Id ? 1 : 0,
        winnerId,
        status: "completed",
        playedAt: new Date(),
      },
    });

    await updateEntryStats(tx, tournamentId, winnerId, loserId);
    await propagateAdvancement(tx, tournamentId, updated, bracketSize, format);
  });

  await syncTournamentMatchDrafts(tournamentId);
}

async function randomizeBracket(tournamentId: string, format: string) {
  const entries = await prisma.tournamentEntry.findMany({
    where: { tournamentId },
    select: { teamId: true, userId: true },
  });
  const participantIds = entries
    .map((e) => e.teamId ?? e.userId)
    .filter((id): id is string => !!id);

  const pairings = buildRandomRound1Pairings(participantIds);
  const bracketSize = getBracketSize(participantIds.length);

  await prisma.$transaction(async (tx) => {
    await tx.match.deleteMany({ where: { tournamentId } });
    await ensureBracketStructure(tx, tournamentId, participantIds.length, format);

    for (let i = 0; i < pairings.length; i++) {
      const pairing = pairings[i];
      const isBye = !pairing.team2Id;
      const match = await tx.match.update({
        where: {
          id: (
            await tx.match.findFirstOrThrow({
              where: { tournamentId, round: 1, matchNumber: i + 1 },
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
        await advanceByeWinner(tx, tournamentId, match, bracketSize, format);
      }
    }
  });

  await syncTournamentMatchDrafts(tournamentId);
}

async function getMatches(tournamentId: string) {
  return prisma.match.findMany({
    where: { tournamentId },
    select: {
      id: true,
      round: true,
      matchNumber: true,
      status: true,
      team1Id: true,
      team2Id: true,
    },
    orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
  });
}

async function processDraftRound(tournamentId: string, round: number) {
  const matches = (await getMatches(tournamentId)).filter(
    (m) => m.round === round && isMatchDraftable(m)
  );

  if (matches.length === 0) return 0;

  await launchDraftsForRound(tournamentId, round);

  for (const match of matches) {
    const config = await prisma.draftConfig.findUnique({
      where: { matchId: match.id },
    });
    if (!config) continue;
    if (config.isActive) {
      await completeMatchDraft(match.id);
    } else if (!(await isMatchDraftComplete(match.id))) {
      throw new Error(`Draft stuck for match ${match.id}`);
    }
  }

  return matches.length;
}

async function scoreReadyMatches(tournamentId: string) {
  const matches = await getMatches(tournamentId);
  const pending = matches.filter(
    (m) => m.status === "pending" && m.team1Id && m.team2Id
  );
  if (pending.length === 0) return 0;

  const rounds = [...new Set(pending.map((m) => m.round))].sort((a, b) => {
    if (a === 0) return 1;
    if (b === 0) return -1;
    if (a > 0 && b > 0) return a - b;
    if (a < 0 && b < 0) return b - a;
    return a > 0 ? -1 : 1;
  });

  for (const round of rounds) {
    const inRound = pending.filter((m) => m.round === round);
    const readiness = await Promise.all(
      inRound.map((m) => isMatchDraftComplete(m.id))
    );
    if (!readiness.every(Boolean)) continue;

    for (const match of inRound) {
      await scoreMatch(tournamentId, match.id, match.team1Id!);
    }
    return inRound.length;
  }

  return 0;
}

async function main() {
  const organizer = await prisma.user.findUnique({
    where: { email: ORGANIZER_EMAIL },
  });
  if (!organizer) throw new Error(`Organizer not found: ${ORGANIZER_EMAIL}`);

  const tournament = await prisma.tournament.create({
    data: {
      title: "Demo complet — Bloodriver",
      description:
        "Tournoi démo 8 équipes avec drafts ban/pick sur chaque match jusqu'à la finale.",
      type: "TEAM",
      format: "DOUBLE_ELIMINATION",
      status: "IN_PROGRESS",
      maxTeams: 8,
      organizerId: organizer.id,
      roundSeriesLength: 1,
      semiSeriesLength: 3,
      finalSeriesLength: 3,
      organizers: {
        create: {
          userId: organizer.id,
          permissions: [
            "MANAGE_TOURNAMENT",
            "MANAGE_SCORES",
            "MANAGE_DRAFT",
            "MANAGE_PARTICIPANTS",
            "MANAGE_BANS",
          ],
        },
      },
    },
  });

  console.log(`Created tournament: ${tournament.id}`);

  for (const teamId of TEAM_IDS) {
    await prisma.tournamentEntry.create({
      data: { tournamentId: tournament.id, teamId },
    });
  }
  console.log(`Registered ${TEAM_IDS.length} teams`);

  await randomizeBracket(tournament.id, "DOUBLE_ELIMINATION");
  console.log("Bracket randomized");

  let iterations = 0;
  while (iterations++ < 80) {
    const tournamentState = await prisma.tournament.findUnique({
      where: { id: tournament.id },
      select: { status: true },
    });
    if (tournamentState?.status === "COMPLETED") break;

    const matches = await getMatches(tournament.id);
    const pendingPlayable = matches.filter(
      (m) =>
        m.status === "pending" &&
        m.team1Id &&
        m.team2Id &&
        isMatchDraftable(m)
    );

    if (pendingPlayable.length === 0) {
      const gf = matches.find((m) => m.round === 0 && m.status === "pending");
      if (gf?.team1Id && gf.team2Id) {
        const round = 0;
        await launchDraftsForRound(tournament.id, round);
        const gfConfig = await prisma.draftConfig.findUnique({
          where: { matchId: gf.id },
        });
        if (gfConfig?.isActive) await completeMatchDraft(gf.id);
        if (await isMatchDraftComplete(gf.id)) {
          await scoreMatch(tournament.id, gf.id, gf.team1Id);
        }
      }
      break;
    }

    const currentRound = getCurrentDraftRound(matches);
    if (currentRound == null) break;

    const drafted = await processDraftRound(tournament.id, currentRound);
    const scored = await scoreReadyMatches(tournament.id);

    console.log(
      `Round ${currentRound}: drafts completed for ${drafted} matches, scored ${scored}`
    );

    if (drafted === 0 && scored === 0) {
      const anyPending = pendingPlayable.length > 0;
      if (anyPending) {
        console.log("Retrying draft launch...");
        await launchDraftsForRound(tournament.id, currentRound);
      } else {
        break;
      }
    }
  }

  const finalState = await prisma.tournament.findUnique({
    where: { id: tournament.id },
    include: {
      matches: {
        where: { round: 0 },
        include: {
          team1: { select: { name: true } },
          team2: { select: { name: true } },
        },
      },
    },
  });

  const completedMatches = await prisma.match.count({
    where: { tournamentId: tournament.id, status: "completed" },
  });
  const totalMatches = await prisma.match.count({
    where: { tournamentId: tournament.id },
  });

  console.log("\n=== DONE ===");
  console.log(`Tournament ID: ${tournament.id}`);
  console.log(`URL: http://localhost:3000/fr/tournaments/${tournament.id}`);
  console.log(`Status: ${finalState?.status}`);
  console.log(`Matches completed: ${completedMatches}/${totalMatches}`);
  if (finalState?.matches[0]) {
    const gf = finalState.matches[0];
    console.log(
      `Grand Final: ${gf.team1?.name} vs ${gf.team2?.name} — ${gf.status}`
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
