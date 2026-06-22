const BRAND = {
  background: "#0f0f14",
  card: "#1a1a24",
  cardBorder: "#2a2a3a",
  foreground: "#e8e8ed",
  muted: "#71717a",
  primary: "#6366f1",
  primaryHover: "#818cf8",
  accent: "#f59e0b",
} as const;

type EmailLocale = "en" | "fr";

interface EmailLayoutOptions {
  locale: EmailLocale;
  title: string;
  preheader?: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaHref?: string;
  linkFallback?: string;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildEmailLayout({
  locale,
  title,
  preheader,
  bodyHtml,
  ctaLabel,
  ctaHref,
  linkFallback,
}: EmailLayoutOptions) {
  const isEn = locale === "en";
  const footer = isEn
    ? "Gekishin — Competitive tournament platform"
    : "Gekishin — Plateforme de tournois compétitifs";
  const linkHint = isEn
    ? "If the button does not work, copy and paste this link into your browser:"
    : "Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :";

  const ctaBlock =
    ctaLabel && ctaHref
      ? `
        <tr>
          <td align="center" style="padding:28px 32px 8px;text-align:center;">
            <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;">
              <tr>
                <td align="center" style="border-radius:8px;background:${BRAND.primary};">
                  <a href="${escapeHtml(ctaHref)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                    ${escapeHtml(ctaLabel)}
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `
      : "";

  const fallbackBlock =
    linkFallback && ctaHref
      ? `
        <tr>
          <td align="center" style="padding:20px 32px 32px;border-top:1px solid ${BRAND.cardBorder};text-align:center;">
            <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:${BRAND.muted};">
              ${linkHint}
            </p>
            <p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND.primaryHover};word-break:break-all;">
              <a href="${escapeHtml(ctaHref)}" style="color:${BRAND.primaryHover};text-decoration:underline;">
                ${escapeHtml(linkFallback)}
              </a>
            </p>
          </td>
        </tr>
      `
      : "";

  const hiddenPreheader = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.background};color:${BRAND.foreground};font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    ${hiddenPreheader}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.background};padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <span style="font-size:26px;font-weight:800;letter-spacing:-0.02em;color:${BRAND.primaryHover};">Gekishin</span>
              </td>
            </tr>
            <tr>
              <td style="background:${BRAND.card};border:1px solid ${BRAND.cardBorder};border-radius:12px;overflow:hidden;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="height:4px;background:linear-gradient(90deg, ${BRAND.primary} 0%, ${BRAND.primaryHover} 50%, ${BRAND.accent} 100%);font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="padding:32px 32px 24px;">
                      <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;font-weight:700;color:${BRAND.foreground};">
                        ${escapeHtml(title)}
                      </h1>
                      <div style="font-size:15px;line-height:1.7;color:${BRAND.foreground};">
                        ${bodyHtml}
                      </div>
                    </td>
                  </tr>
                  ${ctaBlock}
                  ${fallbackBlock}
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 8px 0;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:${BRAND.muted};">
                  ${footer}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildTeamInviteEmail({
  teamName,
  inviterName,
  inviteLink,
  locale,
  isNewUser,
}: {
  teamName: string;
  inviterName: string;
  inviteLink: string;
  locale: EmailLocale;
  isNewUser: boolean;
}) {
  const isEn = locale === "en";
  const title = isEn ? "Team invitation" : "Invitation d'équipe";
  const subject = isEn
    ? `You've been invited to join ${teamName}`
    : `Vous avez été invité à rejoindre ${teamName}`;

  const bodyHtml = isEn
    ? `
      <p style="margin:0 0 16px;">
        <strong style="color:${BRAND.foreground};">${escapeHtml(inviterName)}</strong>
        has invited you to join
        <strong style="color:${BRAND.primaryHover};">${escapeHtml(teamName)}</strong>.
      </p>
      ${
        isNewUser
          ? `<p style="margin:0 0 16px;color:${BRAND.muted};">Create your Gekishin account with this email address and you will automatically join the team.</p>`
          : ""
      }
    `
    : `
      <p style="margin:0 0 16px;">
        <strong style="color:${BRAND.foreground};">${escapeHtml(inviterName)}</strong>
        vous a invité à rejoindre l'équipe
        <strong style="color:${BRAND.primaryHover};">${escapeHtml(teamName)}</strong>.
      </p>
      ${
        isNewUser
          ? `<p style="margin:0 0 16px;color:${BRAND.muted};">Créez votre compte Gekishin avec cette adresse email : vous serez ajouté automatiquement à l'équipe.</p>`
          : ""
      }
    `;

  const htmlContent = buildEmailLayout({
    locale,
    title,
    preheader: isEn
      ? `${inviterName} invited you to ${teamName}`
      : `${inviterName} vous invite à rejoindre ${teamName}`,
    bodyHtml,
    ctaLabel: isEn
      ? isNewUser
        ? "Create account & join"
        : "Accept invitation"
      : isNewUser
        ? "Créer un compte et rejoindre"
        : "Accepter l'invitation",
    ctaHref: inviteLink,
    linkFallback: inviteLink,
  });

  return { subject, htmlContent };
}

export function buildTournamentInviteEmail({
  tournamentTitle,
  inviteLink,
  locale,
}: {
  tournamentTitle: string;
  inviteLink: string;
  locale: EmailLocale;
}) {
  const isEn = locale === "en";
  const title = isEn ? "Tournament invitation" : "Invitation au tournoi";
  const subject = isEn
    ? `Tournament invitation: ${tournamentTitle}`
    : `Invitation au tournoi : ${tournamentTitle}`;

  const bodyHtml = isEn
    ? `<p style="margin:0;">You have been invited to participate in <strong style="color:${BRAND.primaryHover};">${escapeHtml(tournamentTitle)}</strong>.</p>`
    : `<p style="margin:0;">Vous avez été invité à participer à <strong style="color:${BRAND.primaryHover};">${escapeHtml(tournamentTitle)}</strong>.</p>`;

  const htmlContent = buildEmailLayout({
    locale,
    title,
    preheader: tournamentTitle,
    bodyHtml,
    ctaLabel: isEn ? "View tournament" : "Voir le tournoi",
    ctaHref: inviteLink,
    linkFallback: inviteLink,
  });

  return { subject, htmlContent };
}
