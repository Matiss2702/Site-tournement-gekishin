import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const t = await getTranslations("home");
  const session = await auth();

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/5" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6">
            {t("hero")}
          </h1>
          <p className="text-lg text-muted mb-10">{t("subtitle")}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {session ? (
              <Link href="/dashboard" className="btn btn-primary text-lg px-8 py-3">
                {t("getStarted")}
              </Link>
            ) : (
              <Link href="/register" className="btn btn-primary text-lg px-8 py-3">
                {t("getStarted")}
              </Link>
            )}
            <Link href="/tournaments" className="btn btn-secondary text-lg px-8 py-3">
              {t("browseTournaments")}
            </Link>
          </div>
        </div>

        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard
            title="Solo & Team"
            description="Create tournaments for individual players or full teams with flexible formats."
          />
          <FeatureCard
            title="Draft System"
            description="Full pick & ban draft with role bans for Tank, Support, and DPS."
          />
          <FeatureCard
            title="Organizer Tools"
            description="Score management, role bans, notifications, and team invitations via email."
          />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="card text-center">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted text-sm">{description}</p>
    </div>
  );
}
