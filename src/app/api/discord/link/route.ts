import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  buildDiscordAuthorizeUrl,
  createDiscordLinkState,
  isDiscordConfigured,
} from "@/lib/discord";
import { routing } from "@/i18n/routing";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isDiscordConfigured()) {
    return NextResponse.json({ error: "Discord not configured" }, { status: 503 });
  }

  const localeParam = request.nextUrl.searchParams.get("locale");
  const locale = routing.locales.includes(localeParam as "en" | "fr")
    ? (localeParam as "en" | "fr")
    : routing.defaultLocale;

  const state = createDiscordLinkState(session.user.id, locale);
  const url = buildDiscordAuthorizeUrl(state);

  return NextResponse.redirect(url);
}
