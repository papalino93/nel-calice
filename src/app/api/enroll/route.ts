import { NextResponse } from "next/server";
import { isDenied, requireUser } from "@/lib/guard";
import { enrollWithCodeOnly } from "@/lib/enrollment";

/**
 * Iscrizione partendo dal solo codice, senza sapere a quale corso appartiene.
 *
 * È la via d'ingresso principale: il corsista digita quello che ha sentito in
 * aula e finisce nel corso giusto, anche se non ha mai ricevuto un link.
 * Funziona perché i codici d'iscrizione sono unici su tutti i corsi — un
 * vincolo imposto dal database, non una speranza.
 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (isDenied(user)) return user.response;

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : null;
  if (!code) {
    return NextResponse.json({ error: "codice mancante" }, { status: 400 });
  }

  const outcome = await enrollWithCodeOnly(user.id, code);

  if (outcome.ok) {
    return NextResponse.json({ enrolled: true, slug: outcome.courseSlug });
  }

  const status = {
    not_found: 404,
    closed: 403,
    wrong_code: 403,
    rate_limited: 429,
  }[outcome.reason];

  const message = {
    not_found: "Codice non valido.",
    closed: "Le iscrizioni a questo corso sono chiuse.",
    wrong_code: "Codice non valido.",
    rate_limited: "Troppi tentativi. Riprova fra qualche minuto.",
  }[outcome.reason];

  return NextResponse.json({ enrolled: false, error: message }, { status });
}
