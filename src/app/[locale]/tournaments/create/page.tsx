"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  PRIZE_CODES_PER_TEAM,
  PRIZE_PLACEMENTS,
} from "@/lib/tournament-prize-config";
import { SERIES_LENGTH_OPTIONS } from "@/lib/match-series";
import {
  MIN_TOURNAMENT_CAPACITY,
  TOURNAMENT_CAPACITY_OPTIONS,
  isValidTournamentCapacity,
} from "@/lib/tournament-capacity";

function emptyPrizeSlots(count: number) {
  return Array.from({ length: count }, () => "");
}

type PrizeFormState = Record<"1" | "2" | "3", string[]>;

function buildInitialPrizeForm(): PrizeFormState {
  return {
    "1": emptyPrizeSlots(PRIZE_CODES_PER_TEAM),
    "2": emptyPrizeSlots(PRIZE_CODES_PER_TEAM),
    "3": emptyPrizeSlots(PRIZE_CODES_PER_TEAM),
  };
}

function PrizeCodeFields({
  placement,
  values,
  onChange,
}: {
  placement: 1 | 2 | 3;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const t = useTranslations("tournaments");

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">
        {t(`prizePlacement.${placement}`)}
      </label>
      <p className="text-xs text-muted">{t("prizePlacementHint")}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {values.map((value, index) => (
          <input
            key={`${placement}-${index}`}
            value={value}
            onChange={(e) => {
              const next = [...values];
              next[index] = e.target.value;
              onChange(next);
            }}
            placeholder={t("prizeCodePlaceholder", { n: index + 1 })}
          />
        ))}
      </div>
    </div>
  );
}

export default function CreateTournamentPage() {
  const t = useTranslations("tournaments");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "TEAM" as "SOLO" | "TEAM",
    format: "DOUBLE_ELIMINATION" as const,
    maxTeams: "8",
    maxPlayers: "8",
    startDate: "",
    endDate: "",
    prizeCodes: buildInitialPrizeForm(),
    prizeCode1stSolo: "",
    prizeCode2ndSolo: "",
    prizeCode3rdSolo: "",
    roundSeriesLength: 1,
    semiSeriesLength: 1,
    finalSeriesLength: 1,
  });

  function buildPrizePayload() {
    if (form.type === "TEAM") {
      const prizeCodes: { placement: number; code: string }[] = [];
      for (const placement of PRIZE_PLACEMENTS) {
        const codes = form.prizeCodes[String(placement) as "1" | "2" | "3"]
          .map((code) => code.trim())
          .filter(Boolean);
        for (const code of codes) {
          prizeCodes.push({ placement, code });
        }
      }
      return prizeCodes;
    }

    return [
      { placement: 1, code: form.prizeCode1stSolo.trim() },
      { placement: 2, code: form.prizeCode2ndSolo.trim() },
      { placement: 3, code: form.prizeCode3rdSolo.trim() },
    ].filter((row) => row.code.length > 0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload: Record<string, unknown> = {
      title: form.title,
      description: form.description,
      type: form.type,
      format: form.format,
      roundSeriesLength: form.roundSeriesLength,
      semiSeriesLength: form.semiSeriesLength,
      finalSeriesLength: form.finalSeriesLength,
    };

    if (form.type === "TEAM") {
      const maxTeams = parseInt(form.maxTeams, 10);
      if (!isValidTournamentCapacity(maxTeams)) {
        setError(t("invalidCapacity", { min: MIN_TOURNAMENT_CAPACITY }));
        setLoading(false);
        return;
      }
      payload.maxTeams = maxTeams;

      for (const placement of PRIZE_PLACEMENTS) {
        const codes = form.prizeCodes[String(placement) as "1" | "2" | "3"]
          .map((code) => code.trim())
          .filter(Boolean);
        if (codes.length > 0 && codes.length !== PRIZE_CODES_PER_TEAM) {
          setError(t("prizeCodesPerPlacement", { count: PRIZE_CODES_PER_TEAM }));
          setLoading(false);
          return;
        }
      }
    } else {
      const maxPlayers = parseInt(form.maxPlayers, 10);
      if (!isValidTournamentCapacity(maxPlayers)) {
        setError(t("invalidCapacity", { min: MIN_TOURNAMENT_CAPACITY }));
        setLoading(false);
        return;
      }
      payload.maxPlayers = maxPlayers;
    }

    if (form.startDate) {
      payload.startDate = new Date(form.startDate).toISOString();
    }
    if (form.endDate) {
      payload.endDate = new Date(form.endDate).toISOString();
    }

    const prizeCodes = buildPrizePayload();
    if (prizeCodes.length > 0) {
      payload.prizeCodes = prizeCodes;
    }

    const res = await fetch("/api/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const tournament = await res.json();
      router.push(`/tournaments/${tournament.id}`);
    } else {
      const data = await res.json();
      setError(data.details || data.error || t("createError"));
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">{t("create")}</h1>

      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t("titleLabel")}</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            minLength={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t("descriptionLabel")}</label>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
            minLength={3}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("type")}</label>
            <select
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as "SOLO" | "TEAM" })
              }
            >
              <option value="SOLO">{t("solo")}</option>
              <option value="TEAM">{t("team")}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("format")}</label>
            <select
              value={form.format}
              onChange={(e) =>
                setForm({
                  ...form,
                  format: e.target.value as typeof form.format,
                })
              }
            >
              <option value="SINGLE_ELIMINATION">
                {t("formats.SINGLE_ELIMINATION")}
              </option>
              <option value="DOUBLE_ELIMINATION">
                {t("formats.DOUBLE_ELIMINATION")}
              </option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            {t("seriesConfigTitle")}
          </h2>
          <p className="text-xs text-muted">{t("seriesConfigHint")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("roundSeriesLength")}
              </label>
              <select
                value={form.roundSeriesLength}
                onChange={(e) =>
                  setForm({
                    ...form,
                    roundSeriesLength: Number(e.target.value),
                  })
                }
              >
                {SERIES_LENGTH_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {t("seriesOption", { format: `BO${n}` })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("semiSeriesLength")}
              </label>
              <select
                value={form.semiSeriesLength}
                onChange={(e) =>
                  setForm({
                    ...form,
                    semiSeriesLength: Number(e.target.value),
                  })
                }
              >
                {SERIES_LENGTH_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {t("seriesOption", { format: `BO${n}` })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("finalSeriesLength")}
              </label>
              <select
                value={form.finalSeriesLength}
                onChange={(e) =>
                  setForm({
                    ...form,
                    finalSeriesLength: Number(e.target.value),
                  })
                }
              >
                {SERIES_LENGTH_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {t("seriesOption", { format: `BO${n}` })}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {form.type === "TEAM" ? (
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("maxTeams")} <span className="text-danger">*</span>
              </label>
              <select
                value={form.maxTeams}
                onChange={(e) => setForm({ ...form, maxTeams: e.target.value })}
                required
              >
                {TOURNAMENT_CAPACITY_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted mt-1">{t("maxTeamsHint")}</p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("maxPlayers")} <span className="text-danger">*</span>
              </label>
              <select
                value={form.maxPlayers}
                onChange={(e) =>
                  setForm({ ...form, maxPlayers: e.target.value })
                }
                required
              >
                {TOURNAMENT_CAPACITY_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted mt-1">{t("maxPlayersHint")}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">{t("startDate")}</label>
            <input
              type="datetime-local"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </div>
        </div>

        <div className="border-t border-card-border pt-4 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{t("prizeCodesTitle")}</h2>
            <p className="text-sm text-muted mt-1">
              {form.type === "TEAM" ? t("prizeCodesHintTeam") : t("prizeCodesHint")}
            </p>
          </div>

          {form.type === "TEAM" ? (
            <div className="space-y-5">
              {PRIZE_PLACEMENTS.map((placement) => (
                <PrizeCodeFields
                  key={placement}
                  placement={placement}
                  values={form.prizeCodes[String(placement) as "1" | "2" | "3"]}
                  onChange={(next) =>
                    setForm({
                      ...form,
                      prizeCodes: {
                        ...form.prizeCodes,
                        [String(placement)]: next,
                      },
                    })
                  }
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("prizePlacement.1")}
                </label>
                <input
                  value={form.prizeCode1stSolo}
                  onChange={(e) =>
                    setForm({ ...form, prizeCode1stSolo: e.target.value })
                  }
                  placeholder="WQC5 XN32 4K3M JRY3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("prizePlacement.2")}
                </label>
                <input
                  value={form.prizeCode2ndSolo}
                  onChange={(e) =>
                    setForm({ ...form, prizeCode2ndSolo: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("prizePlacement.3")}
                </label>
                <input
                  value={form.prizeCode3rdSolo}
                  onChange={(e) =>
                    setForm({ ...form, prizeCode3rdSolo: e.target.value })
                  }
                />
              </div>
            </div>
          )}
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? "..." : t("create")}
        </button>
      </form>
    </div>
  );
}
