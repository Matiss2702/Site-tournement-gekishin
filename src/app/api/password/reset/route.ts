import { NextRequest, NextResponse } from "next/server";
import { resetPassword } from "@/lib/password-reset";
import { resetPasswordSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  const parsed = resetPasswordSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const result = await resetPassword(parsed.data.token, parsed.data.password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
