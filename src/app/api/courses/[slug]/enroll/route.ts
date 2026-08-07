import { NextResponse } from "next/server";
import { isDenied, requireUser } from "@/lib/guard";
import { enrollWithCode } from "@/lib/enrollment";

/**
 * Iscrizione a un corso con il codice comunicato dal relatore.
 * Il codice viaggia solo in entrata: la risposta dice sì o no, mai qual era.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await requireUser();
  if (isDenied(user)) return user.response;

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : null;
  if (!code) {
    return NextResponse.json({ error: "codice mancante" }, { status: 400 });
  }

  const outcome = await enrollWithCode(user.id, (await params).slug, code);

  if (outcome.ok) {
    return NextResponse.json({ enrolled: true });
  }

  const status = {
    not_found: 404,
    closed: 403,
    wrong_code: 403,
    rate_limited: 429,
  }[outcome.reason];

  const message = {
    not_found: "Corso inesistente.",
    closed: "Le iscrizioni a questo corso sono chiuse.",
    wrong_code: "Codice non valido.",
    rate_limited: "Troppi tentativi. Riprova fra qualche minuto.",
  }[outcome.reason];

  return NextResponse.json({ enrolled: false, error: message }, { status });
}
