import { NextRequest, NextResponse } from "next/server";

/** @deprecated Use /api/tournaments/[id]/drafts or /matches/[matchId]/draft */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const matchId = request.nextUrl.searchParams.get("matchId");
  if (!matchId) {
    return NextResponse.json(
      { error: "matchId query parameter required" },
      { status: 400 }
    );
  }

  const url = new URL(
    `/api/tournaments/${id}/matches/${matchId}/draft`,
    request.url
  );
  const res = await fetch(url);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
