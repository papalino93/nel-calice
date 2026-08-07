import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { finalizeAttempt, reviewView } from "@/lib/quiz";

/**
 * Consegna il quiz. Il punteggio viene calcolato qui, dalle risposte già
 * salvate e dalle soluzioni che stanno solo sul server (difetto §7.4: nell'app
 * attuale il punteggio arriva dal browser e nessuno lo verifica).
 *
 * Il client non manda risposte in questa chiamata: manda solo la volontà di
 * chiudere. Se il tempo è scaduto, la chiusura avviene lo stesso e il
 * risultato è marcato come "tempo scaduto" (§3.4).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  }

  const attemptId = (await params).id;
  const attempt = await finalizeAttempt(attemptId, user.id);
  if (!attempt) {
    return NextResponse.json({ error: "tentativo inesistente" }, { status: 404 });
  }

  const review = await reviewView(attemptId, user.id);
  return NextResponse.json(review);
}
