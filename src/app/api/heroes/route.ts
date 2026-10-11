import { NextResponse } from "next/server";
import { listHeroes } from "@/lib/hero-repository";

export async function GET() {
  try {
    const heroes = await listHeroes();
    if (heroes.length > 0) {
      return NextResponse.json(heroes);
    }
  } catch (error) {
    console.error("[GET /api/heroes]", error);
  }

  return NextResponse.json(
    { error: "Heroes unavailable. Run prisma seed." },
    { status: 503 }
  );
}
