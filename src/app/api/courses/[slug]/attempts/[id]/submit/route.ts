import { NextResponse } from "next/server";
import { isDenied, requireEnrollment } from "@/lib/guard";
import { finalizeAttempt, reviewView } from "@/lib/quiz";

/**
 * Consegna il quiz. Il punteggio viene calcolato qui, dalle risposte già
 * salvate e dalle soluzioni che stanno solo sul server (§7.4: nell'app
 * attuale il punteggio arriva dal browser e nessuno lo verifica).
 *
 * Il client non manda risposte in questa chiamata: manda solo la volontà di
 * chiudere. Se il tempo è scaduto, la chiusura avviene lo stesso e il
 * risultato è marcato come "tempo scaduto" (§3.4).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;

  const ctx = await requireEnrollment(slug);
  if (isDenied(ctx)) return ctx.response;

  const attempt = await finalizeAttempt(id, ctx.enrollment);
  if (!attempt) {
    return NextResponse.json({ error: "tentativo inesistente" }, { status: 404 });
  }

  return NextResponse.json(await reviewView(id, ctx.enrollment));
}
