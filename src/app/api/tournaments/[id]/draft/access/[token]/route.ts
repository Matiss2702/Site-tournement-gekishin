import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { draftActionSchema } from "@/lib/validations";
import { resolveDraftAccess } from "@/lib/draft-access";
import { executeDraftAction, getDraftPayload } from "@/lib/draft-actions";
import { findDraftConfigByToken } from "@/lib/draft-matches";
import { ensureMatchDraftTokens } from "@/lib/draft-tokens";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; token: string }> }
) {
  const { id: tournamentId, token } = await params;

  const config = await findDraftConfigByToken(tournamentId, token);
  if (!config?.matchId) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  await ensureMatchDraftTokens(config.matchId);
  const payload = await getDraftPayload(config.matchId);

  const access = resolveDraftAccess(config, token);
  if (!access) {
    return NextResponse.json({ error: "Invalid access link" }, { status: 404 });
  }

  return NextResponse.json({
    ...payload,
    access,
    matchId: config.matchId,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; token: string }> }
) {
  const { id: tournamentId, token } = await params;
  const body = await request.json();
  const parsed = draftActionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const config = await findDraftConfigByToken(tournamentId, token);
  if (!config?.matchId) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  const access = resolveDraftAccess(config, token);
  if (!access) {
    return NextResponse.json({ error: "Invalid access link" }, { status: 404 });
  }

  if (access.mode === "spectator") {
    return NextResponse.json({ error: "Read-only access" }, { status: 403 });
  }

  if (access.mode === "captain") {
    const session = await auth();

    const result = await executeDraftAction(config.matchId, {
      action: parsed.data.action,
      phase: parsed.data.phase,
      heroName: parsed.data.heroName!,
      teamId: access.teamId,
      actorId: session?.user?.id,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.action, { status: 201 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
