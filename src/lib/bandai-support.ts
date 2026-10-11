export const BANDAI_SUPPORT_TERMS_URL =
  "https://dbg-squadra.bn-ent.net/en-us/pdf/support_rules.pdf";

/** Official notice. Must stay in English on every locale. */
export const BANDAI_OFFICIAL_NOTICE =
  "This tournament is held with the support of the Tournament Support Program for DRAGON BALL GEKISHIN SQUADRA, operated by Bandai Namco Entertainment Inc.";

export type BandaiSupportStatusValue =
  | "NONE"
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export function requiresBandaiConsent(status: string) {
  return status === "PENDING" || status === "APPROVED";
}

/** Organizers may only report that an application was sent, or withdraw it. */
export function organizerCanSetBandaiStatus(from: string, to: string) {
  return (
    (from === "NONE" && to === "PENDING") ||
    (from === "PENDING" && to === "NONE")
  );
}

export function isAdminBandaiDecision(status: string) {
  return status === "APPROVED" || status === "REJECTED";
}

export type BandaiConsentInput = {
  adultConfirmed?: unknown;
  rulesAccepted?: unknown;
};

export function assertBandaiConsentInput(
  status: string,
  input: BandaiConsentInput
): { ok: true } | { ok: false; error: "adult_confirmation_required" | "rules_acceptance_required" } {
  if (!requiresBandaiConsent(status)) return { ok: true };
  if (input.adultConfirmed !== true) {
    return { ok: false, error: "adult_confirmation_required" };
  }
  if (input.rulesAccepted !== true) {
    return { ok: false, error: "rules_acceptance_required" };
  }
  return { ok: true };
}

export function consentIsComplete(consent: {
  isAdultConfirmed: boolean;
  rulesAccepted: boolean;
} | null) {
  return !!consent?.isAdultConfirmed && !!consent?.rulesAccepted;
}
