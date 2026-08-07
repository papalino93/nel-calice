import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { unlockWithCode } from "@/lib/quiz";

/**
 * Sblocca una lezione con il codice detto a voce dal relatore.
 * Il codice viaggia solo in questa direzione: il client lo manda, il server
 * risponde sì o no. I codici non vengono mai restituiti a nessuno.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  }

  const lessonId = Number((await params).id);
  if (!Number.isInteger(lessonId)) {
    return NextResponse.json({ error: "lezione non valida" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : null;
  if (!code) {
    return NextResponse.json({ error: "codice mancante" }, { status: 400 });
  }

  const outcome = await unlockWithCode(user.id, lessonId, code);

  if (outcome.ok) {
    return NextResponse.json({ unlocked: true });
  }

  const status = {
    not_found: 404,
    wrong_code: 403,
    rate_limited: 429,
  }[outcome.reason];

  const message = {
    not_found: "Lezione inesistente.",
    wrong_code: "Codice non valido.",
    rate_limited: "Troppi tentativi. Riprova fra qualche minuto.",
  }[outcome.reason];

  return NextResponse.json({ unlocked: false, error: message }, { status });
}
