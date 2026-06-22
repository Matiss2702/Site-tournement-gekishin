import { NextRequest, NextResponse } from "next/server";
import { getDraftPayload } from "@/lib/draft-actions";
import { ensureMatchDraftTokens } from "@/lib/draft-tokens";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  try {
    const { matchId } = await params;
    await ensureMatchDraftTokens(matchId);
    const payload = await getDraftPayload(matchId);
    if (!payload.config) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[GET match draft]", error);
    return NextResponse.json(
      { error: "Failed to load draft" },
      { status: 500 }
    );
  }
}
