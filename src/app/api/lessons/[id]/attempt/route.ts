import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { attemptView, startAttempt } from "@/lib/quiz";

/**
 * Avvia il quiz di una lezione, o riprende quello già in corso.
 * La scadenza viene decisa qui e salvata: il client la riceve, ma non la
 * stabilisce e non può spostarla.
 */
export async function POST(
  _request: Request,
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

  const outcome = await startAttempt(user.id, lessonId);

  if (!outcome.ok) {
    const status = {
      locked: 403,
      not_found: 404,
      empty: 409,
      already_done: 409,
    }[outcome.reason];

    const message = {
      locked: "Lezione ancora bloccata.",
      not_found: "Lezione inesistente.",
      empty: "Questa lezione non ha ancora domande.",
      already_done: "Hai già svolto questa lezione.",
    }[outcome.reason];

    return NextResponse.json({ error: message }, { status });
  }

  const view = await attemptView(outcome.attemptId, user.id);
  return NextResponse.json({ ...view, resumed: outcome.resumed });
}
