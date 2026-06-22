import { BrevoClient } from "@getbrevo/brevo";
import {
  buildTeamInviteEmail,
  buildTournamentInviteEmail,
} from "@/lib/email-template";

function getBrevoClient() {
  return new BrevoClient({
    apiKey: process.env.BREVO_API_KEY || "",
  });
}

interface SendEmailParams {
  to: string;
  subject: string;
  htmlContent: string;
}

export async function sendEmail({ to, subject, htmlContent }: SendEmailParams) {
  if (!process.env.BREVO_API_KEY) {
    console.warn("[Brevo] API key not configured, skipping email to:", to);
    return { success: false, reason: "no_api_key" };
  }

  try {
    const client = getBrevoClient();
    await client.transactionalEmails.sendTransacEmail({
      to: [{ email: to }],
      subject,
      htmlContent,
      sender: {
        email: process.env.BREVO_SENDER_EMAIL || "noreply@gekishin.com",
        name: process.env.BREVO_SENDER_NAME || "Gekishin",
      },
    });
    return { success: true };
  } catch (error) {
    console.error("[Brevo] Failed to send email:", error);
    return { success: false, reason: "send_failed" };
  }
}

export async function sendTeamInviteEmail(
  to: string,
  teamName: string,
  inviterName: string,
  inviteLink: string,
  locale: "en" | "fr" = "en",
  isNewUser = false
) {
  const { subject, htmlContent } = buildTeamInviteEmail({
    teamName,
    inviterName,
    inviteLink,
    locale,
    isNewUser,
  });

  return sendEmail({ to, subject, htmlContent });
}

export async function sendTournamentInviteEmail(
  to: string,
  tournamentTitle: string,
  inviteLink: string,
  locale: "en" | "fr" = "en"
) {
  const { subject, htmlContent } = buildTournamentInviteEmail({
    tournamentTitle,
    inviteLink,
    locale,
  });

  return sendEmail({ to, subject, htmlContent });
}
