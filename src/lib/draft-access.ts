export type DraftAccessMode = "spectator" | "captain" | "organizer";

export interface DraftAccess {
  mode: DraftAccessMode;
  teamId?: string;
  teamName?: string;
  teamSlot?: 1 | 2;
}

interface DraftConfigTokens {
  spectatorToken: string | null;
  team1Token: string | null;
  team2Token: string | null;
  team1Id: string | null;
  team2Id: string | null;
  team1?: { id: string; name: string } | null;
  team2?: { id: string; name: string } | null;
}

export function resolveDraftAccess(
  config: DraftConfigTokens,
  token: string
): DraftAccess | null {
  if (config.spectatorToken === token) {
    return { mode: "spectator" };
  }

  if (config.team1Token === token && config.team1Id) {
    return {
      mode: "captain",
      teamId: config.team1Id,
      teamName: config.team1?.name,
      teamSlot: 1,
    };
  }

  if (config.team2Token === token && config.team2Id) {
    return {
      mode: "captain",
      teamId: config.team2Id,
      teamName: config.team2?.name,
      teamSlot: 2,
    };
  }

  return null;
}

export function getDraftTeamIds(config: {
  team1Id: string | null;
  team2Id: string | null;
}): string[] {
  return [config.team1Id, config.team2Id].filter(Boolean) as string[];
}
