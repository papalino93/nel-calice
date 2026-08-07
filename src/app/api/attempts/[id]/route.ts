import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { abandonAttempt, attemptView, reviewView } from "@/lib/quiz";

/**
 * Stato del tentativo. Serve al refresh: restituisce la stessa scadenza
 * salvata all'avvio, non una nuova (difetto §7.5).
 * Se il tentativo è già chiuso, restituisce la revisione con le soluzioni.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  }

  const attemptId = (await params).id;

  const inProgress = await attemptView(attemptId, user.id);
  if (inProgress) {
    return NextResponse.json({ status: "in_corso", ...inProgress });
  }

  const review = await reviewView(attemptId, user.id);
  if (review) {
    return NextResponse.json({ status: "concluso", ...review });
  }

  return NextResponse.json({ error: "tentativo inesistente" }, { status: 404 });
}

/** Abbandona il tentativo in corso (§3.4, pulsante "Esci"). */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  }

  const abandoned = await abandonAttempt((await params).id, user.id);
  if (!abandoned) {
    return NextResponse.json(
      { error: "nessun tentativo da abbandonare" },
      { status: 404 },
    );
  }
  return NextResponse.json({ abandoned: true });
}
