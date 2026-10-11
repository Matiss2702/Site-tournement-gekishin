"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  PRIZE_CODES_PER_TEAM,
  PRIZE_PLACEMENTS,
} from "@/lib/tournament-prize-config";

export type PrizeCodeSlot = {
  placement: number;
  code: string;
  granted: boolean;
};

function slotsFor(placement: number, codes: PrizeCodeSlot[]) {
  const rows = codes.filter((row) => row.placement === placement);
  const next = rows.map((row) => row.code);
  while (next.length < PRIZE_CODES_PER_TEAM) next.push("");
  return next.slice(0, PRIZE_CODES_PER_TEAM);
}

function grantedFor(placement: number, codes: PrizeCodeSlot[]) {
  return codes
    .filter((row) => row.placement === placement && row.granted)
    .map((row) => row.code);
}

export function TournamentPrizeCodesForm({
  tournamentId,
  codes,
}: {
  tournamentId: string;
  codes: PrizeCodeSlot[];
}) {
  const t = useTranslations("tournaments");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(() => ({
    1: slotsFor(1, codes),
    2: slotsFor(2, codes),
    3: slotsFor(3, codes),
  }));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const locked = {
    1: new Set(grantedFor(1, codes)),
    2: new Set(grantedFor(2, codes)),
    3: new Set(grantedFor(3, codes)),
  };
  const anyGranted = codes.some((row) => row.granted);
  const hasCodes = codes.some((row) => row.code.trim() !== "");

  async function handleSave() {
    setLoading(true);
    setMessage("");
    setSaved(false);

    const prizeCodes: { placement: number; code: string }[] = [];
    for (const placement of PRIZE_PLACEMENTS) {
      const filled = values[placement].map((code) => code.trim()).filter(Boolean);
      if (filled.length > 0 && filled.length !== PRIZE_CODES_PER_TEAM) {
        setMessage(t("prizeCodesPerPlacement", { count: PRIZE_CODES_PER_TEAM }));
        setLoading(false);
        return;
      }
      for (const code of filled) prizeCodes.push({ placement, code });
    }

    const res = await fetch(`/api/tournaments/${tournamentId}/prize-codes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prizeCodes }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(
        data.error === "prize_codes_per_placement"
          ? t("prizeCodesPerPlacement", { count: PRIZE_CODES_PER_TEAM })
          : data.error === "prize_code_duplicate"
            ? t("prizeCodeDuplicate")
            : data.error === "prize_code_already_granted"
              ? t("prizeCodesGrantedLocked")
              : t("prizeCodesSaveFailed")
      );
      setLoading(false);
      return;
    }

    const data = await res.json().catch(() => ({}));
    setSaved(true);
    setMessage(
      typeof data.delivered === "number" && data.delivered > 0
        ? t("prizeCodesDelivered")
        : t("prizeCodesSaved")
    );
    setOpen(false);
    setLoading(false);
    router.refresh();
  }

  if (!open) {
    return (
      <section className="card mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{t("prizeCodesTitle")}</h2>
            <p className={`text-sm mt-1 ${message && saved ? "text-emerald-300" : "text-muted"}`}>
              {message || (hasCodes ? t("prizeCodesHidden") : t("prizeCodesLaterHint"))}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="btn btn-secondary"
          >
            {hasCodes ? t("editPrizeCodes") : t("addPrizeCodes")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card mb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{t("prizeCodesTitle")}</h2>
          <p className="text-sm text-muted mt-1">{t("prizeCodesLaterHint")}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn btn-secondary"
        >
          {t("hidePrizeCodes")}
        </button>
      </div>
      {anyGranted && (
        <p className="text-sm text-amber-300/90 mt-2">{t("prizeCodesGrantedLocked")}</p>
      )}

      <div className="mt-5 space-y-5">
        {PRIZE_PLACEMENTS.map((placement) => (
          <div key={placement} className="space-y-2">
            <p className="text-sm font-medium">{t(`prizePlacement.${placement}`)}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {values[placement].map((value, index) => {
                const lockedCode = locked[placement].has(value) && value.trim() !== "";
                return (
                  <input
                    key={`${placement}-${index}`}
                    value={value}
                    disabled={lockedCode}
                    placeholder={t("prizeCodePlaceholder", { n: index + 1 })}
                    onChange={(event) => {
                      const next = [...values[placement]];
                      next[index] = event.target.value;
                      setValues({ ...values, [placement]: next });
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={loading}
        className="btn btn-primary mt-5"
      >
        {loading ? "..." : t("savePrizeCodes")}
      </button>
      {message && (
        <p className={`text-sm mt-3 ${saved ? "text-emerald-300" : "text-red-400"}`}>
          {message}
        </p>
      )}
    </section>
  );
}
