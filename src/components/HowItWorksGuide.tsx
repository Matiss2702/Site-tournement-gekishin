"use client";

import { useLocale, useTranslations } from "next-intl";

function GuideVideo({
  src,
  title,
  missingHint,
}: {
  src: string;
  title: string;
  missingHint: string;
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-card-border bg-black/40">
      <video
        className="w-full aspect-video bg-black"
        controls
        playsInline
        preload="metadata"
        title={title}
      >
        <source src={src} type="video/mp4" />
      </video>
      <p className="px-4 py-3 text-xs text-muted border-t border-card-border">
        {missingHint}
      </p>
    </div>
  );
}

export function HowItWorksGuide() {
  const t = useTranslations("howItWorks");
  const locale = useLocale();
  const videoSrc = (name: string) => `/videos/${name}.${locale}.mp4`;

  const creatorSteps = [
    t("creatorStep1"),
    t("creatorStep2"),
    t("creatorStep3"),
    t("creatorStep4"),
    t("creatorStep5"),
    t("creatorStep6"),
  ];

  const playerSteps = [
    t("playerStep1"),
    t("playerStep2"),
    t("playerStep3"),
    t("playerStep4"),
    t("playerStep5"),
    t("playerStep6"),
    t("playerStep7"),
  ];

  return (
    <div className="space-y-14">
      <section className="space-y-5">
        <div>
          <p className="text-sm uppercase tracking-wider text-sky-400 font-semibold">
            {t("creatorBadge")}
          </p>
          <h2 className="text-2xl font-semibold mt-1">{t("creatorTitle")}</h2>
          <p className="text-muted mt-2">{t("creatorIntro")}</p>
        </div>
        <GuideVideo
          src={videoSrc("create-tournament")}
          title={t("creatorTitle")}
          missingHint={t("videoHintCreator")}
        />
        <ol className="space-y-3 list-decimal list-inside text-sm leading-relaxed">
          {creatorSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="space-y-5">
        <div>
          <p className="text-sm uppercase tracking-wider text-amber-400 font-semibold">
            {t("playerBadge")}
          </p>
          <h2 className="text-2xl font-semibold mt-1">{t("playerTitle")}</h2>
          <p className="text-muted mt-2">{t("playerIntro")}</p>
        </div>
        <GuideVideo
          src={videoSrc("join-tournament")}
          title={t("playerTitle")}
          missingHint={t("videoHintPlayer")}
        />
        <ol className="space-y-3 list-decimal list-inside text-sm leading-relaxed">
          {playerSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="rounded-xl border border-card-border bg-card/40 p-5 space-y-3">
        <h2 className="text-xl font-semibold">{t("draftRulesTitle")}</h2>
        <ul className="space-y-2 text-sm text-muted leading-relaxed list-disc list-inside">
          <li>{t("draftRuleBan")}</li>
          <li>{t("draftRuleTimer")}</li>
          <li>{t("draftRuleAuto")}</li>
          <li>{t("draftRuleShuffle")}</li>
          <li>{t("draftRulePick")}</li>
        </ul>
      </section>
    </div>
  );
}
