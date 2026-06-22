import { getTranslations } from "next-intl/server";
import type { PodiumEntry } from "@/lib/tournament-results";

interface TournamentPodiumProps {
  champion: PodiumEntry;
  runnerUp?: PodiumEntry | null;
  thirdPlace?: PodiumEntry | null;
}

function PodiumSlot({
  entry,
  placement,
  label,
  medal,
}: {
  entry: PodiumEntry;
  placement: 1 | 2 | 3;
  label: string;
  medal: string;
}) {
  return (
    <div className={`tournament-podium-slot tournament-podium-slot--${placement}`}>
      <div className="tournament-podium-slot-body">
        <span className="tournament-podium-medal" aria-hidden>
          {medal}
        </span>
        <p className="tournament-podium-slot-label">{label}</p>
        <p className="tournament-podium-slot-name">{entry.name}</p>
        {entry.tag && (
          <span className="tournament-podium-slot-tag">[{entry.tag}]</span>
        )}
      </div>
      <div className="tournament-podium-pedestal" aria-hidden />
    </div>
  );
}

export async function TournamentPodium({
  champion,
  runnerUp,
  thirdPlace,
}: TournamentPodiumProps) {
  const t = await getTranslations("tournaments");

  return (
    <section className="tournament-podium" aria-label={t("tournamentResultsTitle")}>
      <div className="tournament-podium-glow" aria-hidden />
      <div className="tournament-podium-sparkles" aria-hidden />

      <header className="tournament-podium-header">
        <span className="tournament-podium-eyebrow">{t("tournamentResultsTitle")}</span>
        <h2 className="tournament-podium-title">{t("tournamentWinnerLabel")}</h2>
      </header>

      <div className="tournament-podium-stage">
        {runnerUp ? (
          <PodiumSlot
            entry={runnerUp}
            placement={2}
            label={t("prizePlacement.2")}
            medal="🥈"
          />
        ) : (
          <div className="tournament-podium-slot tournament-podium-slot--empty" />
        )}

        <PodiumSlot
          entry={champion}
          placement={1}
          label={t("tournamentWinnerLabel")}
          medal="🏆"
        />

        {thirdPlace ? (
          <PodiumSlot
            entry={thirdPlace}
            placement={3}
            label={t("prizePlacement.3")}
            medal="🥉"
          />
        ) : (
          <div className="tournament-podium-slot tournament-podium-slot--empty" />
        )}
      </div>
    </section>
  );
}
