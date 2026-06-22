"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

interface Ban {
  id: string;
  gameRole: string;
  reason: string | null;
  user: { id: string; username: string };
}

interface Participant {
  id: string;
  username: string;
}

interface RoleBanManagerProps {
  tournamentId: string;
  bans: Ban[];
  participants: Participant[];
}

export function RoleBanManager({
  tournamentId,
  bans,
  participants,
}: RoleBanManagerProps) {
  const t = useTranslations("roles");
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [gameRole, setGameRole] = useState<"TANK" | "SUPPORT" | "DPS">("TANK");
  const [reason, setReason] = useState("");

  async function addBan() {
    if (!userId) return;
    await fetch(`/api/tournaments/${tournamentId}/bans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, gameRole, reason }),
    });
    setUserId("");
    setReason("");
    router.refresh();
  }

  async function removeBan(banId: string) {
    await fetch(`/api/tournaments/${tournamentId}/bans?banId=${banId}`, {
      method: "DELETE",
    });
    router.refresh();
  }

  const roleBadge = (role: string) => {
    const cls =
      role === "TANK"
        ? "badge-tank"
        : role === "SUPPORT"
          ? "badge-support"
          : "badge-dps";
    return <span className={`badge ${cls}`}>{t(role as "TANK")}</span>;
  };

  return (
    <div className="card">
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="flex-1 min-w-[150px]"
        >
          <option value="">Select player</option>
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.username}
            </option>
          ))}
        </select>
        <select
          value={gameRole}
          onChange={(e) =>
            setGameRole(e.target.value as "TANK" | "SUPPORT" | "DPS")
          }
        >
          <option value="TANK">{t("TANK")}</option>
          <option value="SUPPORT">{t("SUPPORT")}</option>
          <option value="DPS">{t("DPS")}</option>
        </select>
        <input
          placeholder="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="flex-1 min-w-[150px]"
        />
        <button onClick={addBan} className="btn btn-danger">
          Ban Role
        </button>
      </div>

      {bans.length === 0 ? (
        <p className="text-muted text-sm">No role bans</p>
      ) : (
        <div className="space-y-2">
          {bans.map((ban) => (
            <div
              key={ban.id}
              className="flex items-center justify-between py-2 border-b border-card-border last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{ban.user.username}</span>
                {roleBadge(ban.gameRole)}
                {ban.reason && (
                  <span className="text-sm text-muted">— {ban.reason}</span>
                )}
              </div>
              <button
                onClick={() => removeBan(ban.id)}
                className="text-danger text-sm hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
