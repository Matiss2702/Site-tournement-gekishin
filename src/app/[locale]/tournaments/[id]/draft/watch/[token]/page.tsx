import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { findDraftConfigByToken } from "@/lib/draft-matches";
import { DraftBoard } from "@/components/DraftBoard";

export default async function DraftWatchPage({
  params,
}: {
  params: Promise<{ locale: string; id: string; token: string }>;
}) {
  const { id, token } = await params;
  const t = await getTranslations("draft");

  const config = await findDraftConfigByToken(id, token);
  if (!config?.matchId || config.spectatorToken !== token) notFound();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2 italic tracking-tight">
        {t("spectatorView")}
      </h1>
      <p className="text-muted mb-8">
        {config.team1?.name} {t("vs")} {config.team2?.name}
      </p>
      <DraftBoard
        tournamentId={id}
        matchId={config.matchId}
        mode="spectator"
        accessToken={token}
      />
    </div>
  );
}
