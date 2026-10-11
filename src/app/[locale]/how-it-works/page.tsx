import { getTranslations } from "next-intl/server";
import { HowItWorksGuide } from "@/components/HowItWorksGuide";

export default async function HowItWorksPage() {
  const t = await getTranslations("howItWorks");

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-3 text-muted text-lg max-w-2xl">{t("subtitle")}</p>
      </header>
      <HowItWorksGuide />
    </div>
  );
}
