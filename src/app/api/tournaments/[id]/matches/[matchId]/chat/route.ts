import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createMatchChatMessage,
  getMatchChatAccess,
  listMatchChatMessages,
  sanitizeChatBody,
} from "@/lib/match-chat";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: tournamentId, matchId } = await params;
  const access = await getMatchChatAccess(matchId, session.user.id);
  if (!access.ok) {
    const status = access.error === "forbidden" ? 403 : 400;
    return NextResponse.json({ error: access.error }, { status });
  }

  if (access.match.tournamentId !== tournamentId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const messages = await listMatchChatMessages(matchId);

  return NextResponse.json({
    messages,
    myTeamId: access.teamId,
    team1: access.match.team1,
    team2: access.match.team2,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: tournamentId, matchId } = await params;
  const access = await getMatchChatAccess(matchId, session.user.id);
  if (!access.ok) {
    const status = access.error === "forbidden" ? 403 : 400;
    return NextResponse.json({ error: access.error }, { status });
  }

  if (access.match.tournamentId !== tournamentId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const text = sanitizeChatBody(typeof body.body === "string" ? body.body : "");
  if (!text) {
    return NextResponse.json({ error: "empty_message" }, { status: 400 });
  }

  const message = await createMatchChatMessage({
    matchId,
    userId: session.user.id,
    teamId: access.teamId,
    body: text,
  });

  return NextResponse.json(message, { status: 201 });
}
