import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { canManageTournament } from "@/lib/tournament-auth";
import { saveTournamentPrizeCodes } from "@/lib/tournament-prize-codes";

const bodySchema = z.object({
  prizeCodes: z.array(
    z.object({
      placement: z.number().int().min(1).max(3),
      code: z.string().trim().min(4).max(120),
    })
  ),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await canManageTournament(id, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const result = await saveTournamentPrizeCodes(id, parsed.data.prizeCodes);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, delivered: result.delivered });
}
