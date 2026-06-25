import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  exchangeDiscordCode,
  fetchDiscordUser,
  verifyDiscordLinkState,
} from "@/lib/discord";
import { routing } from "@/i18n/routing";

function dashboardRedirect(
  baseUrl: string,
  locale: string,
  status: string
) {
  const safeLocale = routing.locales.includes(locale as "en" | "fr")
    ? locale
    : routing.defaultLocale;
  const url = new URL(`/${safeLocale}/dashboard`, baseUrl);
  url.searchParams.set("discord", status);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const { searchParams } = request.nextUrl;

  const error = searchParams.get("error");
  if (error) {
    return dashboardRedirect(baseUrl, routing.defaultLocale, "denied");
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) {
    return dashboardRedirect(baseUrl, routing.defaultLocale, "error");
  }

  const verified = verifyDiscordLinkState(state);
  if (!verified) {
    return dashboardRedirect(baseUrl, routing.defaultLocale, "error");
  }

  const { userId, locale } = verified;

  try {
    const accessToken = await exchangeDiscordCode(code);
    const discordUser = await fetchDiscordUser(accessToken);

    const existing = await prisma.user.findUnique({
      where: { discordId: discordUser.id },
      select: { id: true },
    });

    if (existing && existing.id !== userId) {
      return dashboardRedirect(baseUrl, locale, "already_linked");
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        discordId: discordUser.id,
        discordUsername: discordUser.username,
      },
    });

    return dashboardRedirect(baseUrl, locale, "linked");
  } catch (err) {
    console.error("[GET /api/discord/callback]", err);
    return dashboardRedirect(baseUrl, locale, "error");
  }
}
