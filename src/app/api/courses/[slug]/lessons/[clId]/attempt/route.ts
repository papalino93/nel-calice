import { NextResponse } from "next/server";
import { isDenied, requireEnrollment } from "@/lib/guard";
import { attemptView, startAttempt } from "@/lib/quiz";

/**
 * Avvia il quiz di una lezione, o riprende quello già in corso.
 * La scadenza viene decisa qui e salvata: il client la riceve, ma non la
 * stabilisce e non può spostarla (§7.5).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string; clId: string }> },
) {
  const { slug, clId } = await params;

  const ctx = await requireEnrollment(slug);
  if (isDenied(ctx)) return ctx.response;

  const outcome = await startAttempt(ctx.enrollment, clId);

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

    return NextResponse.json({ error: outcome.reason, message }, { status });
  }

  const view = await attemptView(outcome.attemptId, ctx.enrollment);

  // `attemptView` risponde `null` se il tentativo non è più in corso: può
  // succedere riprendendone uno a un soffio dalla scadenza, che un'altra
  // richiesta chiude nel frattempo. Prima si serializzava quel `null`
  // (`{...null}` è `{}`) con un 200: il client riceveva un corpo senza
  // domande né tempo, e si schiantava disegnando la prima domanda. È un
  // conflitto, e va detto come tale — il quiz è chiuso, c'è un risultato.
  if (!view) {
    return NextResponse.json({ error: "already_done" }, { status: 409 });
  }

  return NextResponse.json({ ...view, resumed: outcome.resumed });
}
