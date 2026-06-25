import { createHmac, timingSafeEqual } from "crypto";

const DISCORD_API = "https://discord.com/api/v10";

function getDiscordConfig() {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${baseUrl.replace(/\/$/, "")}/api/discord/callback`,
  };
}

export function isDiscordConfigured() {
  return getDiscordConfig() != null && !!process.env.AUTH_SECRET;
}

export function buildDiscordAuthorizeUrl(state: string) {
  const config = getDiscordConfig();
  if (!config) {
    throw new Error("Discord OAuth is not configured");
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "identify",
    state,
    prompt: "consent",
  });

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

export function createDiscordLinkState(userId: string, locale: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");

  const issuedAt = Date.now().toString();
  const payload = `${userId}:${locale}:${issuedAt}`;
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

export function verifyDiscordLinkState(state: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    if (lastColon === -1) return null;

    const payload = decoded.slice(0, lastColon);
    const signature = decoded.slice(lastColon + 1);
    const expected = createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const [userId, locale, issuedAt] = payload.split(":");
    if (!userId || !locale || !issuedAt) return null;

    const ageMs = Date.now() - Number(issuedAt);
    if (!Number.isFinite(ageMs) || ageMs > 10 * 60 * 1000) return null;

    return { userId, locale };
  } catch {
    return null;
  }
}

export async function exchangeDiscordCode(code: string) {
  const config = getDiscordConfig();
  if (!config) {
    throw new Error("Discord OAuth is not configured");
  }

  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error("Discord token exchange failed");
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

export async function fetchDiscordUser(accessToken: string) {
  const response = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Discord user fetch failed");
  }

  const data = (await response.json()) as {
    id: string;
    username: string;
    global_name: string | null;
  };

  return {
    id: data.id,
    username: data.global_name?.trim() || data.username,
  };
}

export function discordProfileUrl(discordId: string) {
  return `https://discord.com/users/${discordId}`;
}
