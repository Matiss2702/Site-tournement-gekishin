import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getHeroesForApi } from "@/lib/heroes";

export async function GET() {
  try {
    const heroes = await prisma.hero.findMany({
      orderBy: [{ gameRole: "asc" }, { nameEn: "asc" }],
    });

    if (heroes.length > 0) {
      return NextResponse.json(heroes);
    }
  } catch {
    // fall through to static list
  }

  return NextResponse.json(getHeroesForApi());
}
