import { getTranslations } from "next-intl/server";
import { HeroesCatalog } from "@/components/HeroesCatalog";

export default async function HeroesPage() {
  const t = await getTranslations("heroes");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-2">{t("title")}</h1>
      <p className="text-muted mb-8 max-w-2xl">{t("subtitle")}</p>
      <HeroesCatalog />
    </div>
  );
}
