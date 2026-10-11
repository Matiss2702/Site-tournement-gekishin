import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { sendPasswordResetEmail } from "./brevo";

const TOKEN_TTL_MS = 60 * 60 * 1000;
/** Ignore repeated requests for the same account within this window. */
const RESEND_COOLDOWN_MS = 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Emails a one-time reset link if the address belongs to an active account.
 * Callers must answer the same way whatever happens here, so the endpoint
 * never reveals which emails are registered.
 */
export async function requestPasswordReset(email: string, locale: "en" | "fr") {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, username: true, isBanned: true },
  });
  if (!user || user.isBanned) return;

  const recent = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
    },
  });
  if (recent) return;

  const token = randomBytes(32).toString("hex");

  // Only the latest link stays valid.
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    }),
  ]);

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const resetLink = `${baseUrl}/${locale}/reset-password?token=${token}`;

  const result = await sendPasswordResetEmail(
    user.email,
    user.username,
    resetLink,
    locale
  );
  if (!result.success && process.env.NODE_ENV !== "production") {
    // Without Brevo configured, print the link so the flow stays testable locally.
    console.info("[password-reset] email not sent, reset link:", resetLink);
  }
}

export async function resetPassword(token: string, newPassword: string) {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { ok: false as const, error: "invalid_token" as const };
  }

  const password = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { password } }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { userId: record.userId, id: { not: record.id } },
    }),
  ]);

  return { ok: true as const };
}
