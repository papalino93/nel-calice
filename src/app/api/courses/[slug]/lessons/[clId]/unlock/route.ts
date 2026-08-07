import { NextResponse } from "next/server";
import { isDenied, requireEnrollment } from "@/lib/guard";
import { unlockWithCode } from "@/lib/unlock";

/** Sblocca una lezione con il codice della serata. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; clId: string }> },
) {
  const { slug, clId } = await params;

  const ctx = await requireEnrollment(slug);
  if (isDenied(ctx)) return ctx.response;

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : null;
  if (!code) {
    return NextResponse.json({ error: "codice mancante" }, { status: 400 });
  }

  const outcome = await unlockWithCode(ctx.enrollment, clId, code);

  if (outcome.ok) return NextResponse.json({ unlocked: true });

  const status = { not_found: 404, wrong_code: 403, rate_limited: 429 }[
    outcome.reason
  ];
  const message = {
    not_found: "Lezione inesistente.",
    wrong_code: "Codice non valido.",
    rate_limited: "Troppi tentativi. Riprova fra qualche minuto.",
  }[outcome.reason];

  return NextResponse.json({ unlocked: false, error: message }, { status });
}
