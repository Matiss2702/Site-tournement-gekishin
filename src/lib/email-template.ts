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

export function buildPrizeCodeEmail({
  tournamentTitle,
  placementLabel,
  code,
  tournamentLink,
  locale,
}: {
  tournamentTitle: string;
  placementLabel: string;
  code: string;
  tournamentLink: string;
  locale: EmailLocale;
}) {
  const isEn = locale === "en";
  const title = isEn ? "Your prize code" : "Votre code récompense";
  const subject = isEn
    ? `Your prize code — ${tournamentTitle}`
    : `Votre code récompense — ${tournamentTitle}`;

  const bodyHtml = isEn
    ? `
      <p style="margin:0 0 16px;">
        You finished <strong style="color:${BRAND.primaryHover};">${escapeHtml(placementLabel)}</strong>
        in <strong style="color:${BRAND.foreground};">${escapeHtml(tournamentTitle)}</strong>.
      </p>
      <p style="margin:0 0 8px;color:${BRAND.muted};">Your personal code:</p>
      <p style="margin:0;padding:14px 16px;background:${BRAND.background};border:1px solid ${BRAND.cardBorder};border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:18px;font-weight:700;letter-spacing:0.04em;color:${BRAND.accent};">
        ${escapeHtml(code)}
      </p>
    `
    : `
      <p style="margin:0 0 16px;">
        Vous avez obtenu la <strong style="color:${BRAND.primaryHover};">${escapeHtml(placementLabel)}</strong>
        dans <strong style="color:${BRAND.foreground};">${escapeHtml(tournamentTitle)}</strong>.
      </p>
      <p style="margin:0 0 8px;color:${BRAND.muted};">Votre code personnel :</p>
      <p style="margin:0;padding:14px 16px;background:${BRAND.background};border:1px solid ${BRAND.cardBorder};border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:18px;font-weight:700;letter-spacing:0.04em;color:${BRAND.accent};">
        ${escapeHtml(code)}
      </p>
    `;

  const htmlContent = buildEmailLayout({
    locale,
    title,
    preheader: code,
    bodyHtml,
    ctaLabel: isEn ? "View tournament" : "Voir le tournoi",
    ctaHref: tournamentLink,
    linkFallback: tournamentLink,
  });

  return { subject, htmlContent };
}

export function buildPasswordResetEmail({
  resetLink,
  username,
  locale,
}: {
  resetLink: string;
  username: string;
  locale: EmailLocale;
}) {
  const isEn = locale === "en";
  const title = isEn ? "Reset your password" : "Réinitialisez votre mot de passe";
  const subject = isEn
    ? "Reset your Gekishin password"
    : "Réinitialisation de votre mot de passe Gekishin";

  const bodyHtml = isEn
    ? `
      <p style="margin:0 0 16px;">Hi <strong>${escapeHtml(username)}</strong>,</p>
      <p style="margin:0 0 16px;">We received a request to reset the password of your Gekishin account. Click the button below to choose a new one.</p>
      <p style="margin:0;color:${BRAND.muted};">This link expires in 1 hour and can only be used once. If you did not ask for it, you can ignore this email: your password will not change.</p>
    `
    : `
      <p style="margin:0 0 16px;">Bonjour <strong>${escapeHtml(username)}</strong>,</p>
      <p style="margin:0 0 16px;">Nous avons reçu une demande de réinitialisation du mot de passe de votre compte Gekishin. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.</p>
      <p style="margin:0;color:${BRAND.muted};">Ce lien expire dans 1 heure et ne fonctionne qu'une fois. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe ne changera pas.</p>
    `;

  const htmlContent = buildEmailLayout({
    locale,
    title,
    preheader: isEn
      ? "Choose a new password for your Gekishin account"
      : "Choisissez un nouveau mot de passe pour votre compte Gekishin",
    bodyHtml,
    ctaLabel: isEn ? "Reset my password" : "Réinitialiser mon mot de passe",
    ctaHref: resetLink,
    linkFallback: resetLink,
  });

  return { subject, htmlContent };
}
