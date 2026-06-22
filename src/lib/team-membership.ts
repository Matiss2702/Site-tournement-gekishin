import { prisma } from "@/lib/prisma";

export type TournamentRegistrationConflict = {
  username: string;
  otherTeamName: string;
  otherTeamTag: string | null;
};

export async function isUserInTeam(userId: string, teamId: string) {
  const member = await prisma.teamMember.findFirst({
    where: { userId, teamId },
    select: { id: true },
  });
  return !!member;
}

/** Blocks only duplicate membership in the same team. */
export async function assertUserNotAlreadyInTeam(
  userId: string,
  teamId: string
): Promise<{ ok: true } | { ok: false; error: "already_in_team" }> {
  const existing = await isUserInTeam(userId, teamId);
  if (existing) {
    return { ok: false, error: "already_in_team" };
  }
  return { ok: true };
}

export async function findTournamentRegistrationConflicts(
  tournamentId: string,
  teamId: string
): Promise<TournamentRegistrationConflict[]> {
  const [registeringMembers, otherEntries] = await Promise.all([
    prisma.teamMember.findMany({
      where: { teamId },
      select: { userId: true, user: { select: { username: true } } },
    }),
    prisma.tournamentEntry.findMany({
      where: {
        tournamentId,
        teamId: { not: null, notIn: [teamId] },
      },
      select: {
        team: {
          select: {
            name: true,
            tag: true,
            members: { select: { userId: true } },
          },
        },
      },
    }),
  ]);

  const registeringByUserId = new Map(
    registeringMembers.map((m) => [m.userId, m.user.username])
  );

  const conflicts: TournamentRegistrationConflict[] = [];
  const seen = new Set<string>();

  for (const entry of otherEntries) {
    if (!entry.team) continue;
    for (const member of entry.team.members) {
      const username = registeringByUserId.get(member.userId);
      if (!username) continue;
      const key = `${member.userId}:${entry.team.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      conflicts.push({
        username,
        otherTeamName: entry.team.name,
        otherTeamTag: entry.team.tag,
      });
    }
  }

  return conflicts;
}

export async function assertTeamCanRegisterForTournament(
  tournamentId: string,
  teamId: string
): Promise<
  | { ok: true }
  | { ok: false; error: "member_conflict"; conflicts: TournamentRegistrationConflict[] }
> {
  const conflicts = await findTournamentRegistrationConflicts(
    tournamentId,
    teamId
  );
  if (conflicts.length > 0) {
    return { ok: false, error: "member_conflict", conflicts };
  }
  return { ok: true };
}
