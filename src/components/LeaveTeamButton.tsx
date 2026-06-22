"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

interface LeaveTeamButtonProps {
  teamId: string;
  memberId: string;
  isCaptain: boolean;
  hasOtherMembers: boolean;
}

export function LeaveTeamButton({
  teamId,
  memberId,
  isCaptain,
  hasOtherMembers,
}: LeaveTeamButtonProps) {
  const t = useTranslations("teams");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const blocked = isCaptain && hasOtherMembers;

  async function handleLeave() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/teams");
        router.refresh();
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (data.error === "captain_must_transfer") {
        setError(t("captainMustTransfer"));
      } else {
        setError(data.error || t("leaveFailed"));
      }
      setConfirming(false);
    } catch {
      setError(t("leaveFailed"));
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8">
      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {blocked ? (
        <p className="text-sm text-muted">{t("captainMustTransfer")}</p>
      ) : confirming ? (
        <div className="card space-y-3">
          <p className="text-sm">
            {isCaptain && !hasOtherMembers
              ? t("leaveDisbandConfirm")
              : t("leaveConfirm")}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleLeave}
              disabled={loading}
              className="btn bg-danger text-white hover:opacity-90"
            >
              {loading ? "..." : t("leave")}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={loading}
              className="btn btn-secondary"
            >
              {t("leaveCancel")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="btn btn-secondary text-danger border-danger/40 hover:bg-danger/10"
        >
          {t("leave")}
        </button>
      )}
    </div>
  );
}
