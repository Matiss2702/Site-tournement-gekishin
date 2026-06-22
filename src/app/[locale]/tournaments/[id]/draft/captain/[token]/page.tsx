import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { findDraftConfigByToken } from "@/lib/draft-matches";
import { DraftBoard } from "@/components/DraftBoard";

export default async function DraftCaptainPage({
  params,
}: {
  params: Promise<{ locale: string; id: string; token: string }>;
}) {
  const { id, token } = await params;
  const t = await getTranslations("draft");

  const config = await findDraftConfigByToken(id, token);
  if (!config?.matchId) notFound();

  const isTeam1 = config.team1Token === token && config.team1Id;
  const isTeam2 = config.team2Token === token && config.team2Id;

  if (!isTeam1 && !isTeam2) notFound();

  const team = isTeam1 ? config.team1 : config.team2;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2 italic tracking-tight">
        {t("captainDraft")}
      </h1>
      <p className="text-muted mb-8">
        {config.tournament?.title ?? ""} — {team?.name}
      </p>
      <DraftBoard
        tournamentId={id}
        matchId={config.matchId}
        mode="captain"
        accessToken={token}
        teamId={team?.id}
        teamName={team?.name}
      />
    </div>
  );
}
