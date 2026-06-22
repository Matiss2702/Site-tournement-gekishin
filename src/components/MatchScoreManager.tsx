"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

interface Match {
  id: string;
  round: number;
  matchNumber: number;
  score1: number;
  score2: number;
  team1: { id: string; name: string } | null;
  team2: { id: string; name: string } | null;
  winner: { id: string; name: string } | null;
}

interface MatchScoreManagerProps {
  tournamentId: string;
  matches: Match[];
}

export function MatchScoreManager({
  tournamentId,
  matches,
}: MatchScoreManagerProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [scores, setScores] = useState({ score1: 0, score2: 0 });

  async function updateScore(matchId: string, winnerId?: string) {
    await fetch(`/api/tournaments/${tournamentId}/matches`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId,
        score1: scores.score1,
        score2: scores.score2,
        winnerId,
      }),
    });
    setEditing(null);
    router.refresh();
  }

  if (matches.length === 0) {
    return (
      <div className="card">
        <p className="text-muted text-sm">No matches yet</p>
      </div>
    );
  }

  return (
    <div className="card space-y-3">
      {matches.map((match) => (
        <div
          key={match.id}
          className="py-3 border-b border-card-border last:border-0"
        >
          <div className="text-xs text-muted mb-1">
            Round {match.round} · Match {match.matchNumber}
          </div>
          {editing === match.id ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                className="w-16"
                value={scores.score1}
                onChange={(e) =>
                  setScores({ ...scores, score1: parseInt(e.target.value) || 0 })
                }
              />
              <span>-</span>
              <input
                type="number"
                min="0"
                className="w-16"
                value={scores.score2}
                onChange={(e) =>
                  setScores({ ...scores, score2: parseInt(e.target.value) || 0 })
                }
              />
              <button
                onClick={() =>
                  updateScore(
                    match.id,
                    scores.score1 > scores.score2
                      ? match.team1?.id
                      : scores.score2 > scores.score1
                        ? match.team2?.id
                        : undefined
                  )
                }
                className="btn btn-primary text-sm py-1 px-2"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(null)}
                className="btn btn-secondary text-sm py-1 px-2"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span>
                {match.team1?.name || "TBD"}{" "}
                <strong>
                  {match.score1} - {match.score2}
                </strong>{" "}
                {match.team2?.name || "TBD"}
              </span>
              <button
                onClick={() => {
                  setEditing(match.id);
                  setScores({ score1: match.score1, score2: match.score2 });
                }}
                className="text-primary text-sm hover:underline"
              >
                Edit
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
