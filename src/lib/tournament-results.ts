type EntryLike = {
  teamId: string | null;
  userId: string | null;
  team: { id: string; name: string; tag: string | null } | null;
  user: { id: string; username: string } | null;
};

type TeamLike = {
  id: string;
  name: string;
  tag: string | null;
};

export type PodiumEntry = {
  name: string;
  tag: string | null;
};

export function resolvePodiumEntry(
  participantId: string | null | undefined,
  entries: EntryLike[],
  teams?: TeamLike[]
): PodiumEntry | null {
  if (!participantId) return null;

  for (const entry of entries) {
    if (entry.teamId === participantId && entry.team) {
      return { name: entry.team.name, tag: entry.team.tag };
    }
    if (entry.userId === participantId && entry.user) {
      return { name: entry.user.username, tag: null };
    }
  }

  const team = teams?.find((row) => row.id === participantId);
  if (team) return { name: team.name, tag: team.tag };

  return null;
}

export function collectTeamsFromMatches(
  matches: Array<{
    team1: TeamLike | null;
    team2: TeamLike | null;
    winner: TeamLike | null;
  }>
) {
  const teams = new Map<string, TeamLike>();
  for (const match of matches) {
    for (const team of [match.team1, match.team2, match.winner]) {
      if (team) teams.set(team.id, team);
    }
  }
  return [...teams.values()];
}
