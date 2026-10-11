import { NextRequest, NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/password-reset";
import { forgotPasswordSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const parsed = forgotPasswordSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  try {
    await requestPasswordReset(parsed.data.email, parsed.data.locale);
  } catch (error) {
    console.error("[POST /api/password/forgot]", error);
  }

  // Same answer whether or not the account exists.
  return NextResponse.json({ ok: true });
}
