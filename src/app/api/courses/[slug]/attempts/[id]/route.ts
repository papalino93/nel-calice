import { NextResponse } from "next/server";
import { isDenied, requireEnrollment } from "@/lib/guard";
import { abandonAttempt, attemptView, reviewView } from "@/lib/quiz";

/**
 * Stato del tentativo. Serve al refresh: restituisce la stessa scadenza
 * salvata all'avvio, non una nuova (§7.5).
 * Se il tentativo è già chiuso, restituisce la revisione con le soluzioni.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;

  const ctx = await requireEnrollment(slug);
  if (isDenied(ctx)) return ctx.response;

  const inProgress = await attemptView(id, ctx.enrollment);
  if (inProgress) {
    return NextResponse.json({ status: "in_corso", ...inProgress });
  }

  const review = await reviewView(id, ctx.enrollment);
  if (review) {
    return NextResponse.json({ status: "concluso", ...review });
  }

  return NextResponse.json({ error: "tentativo inesistente" }, { status: 404 });
}

/** Abbandona il tentativo in corso (§3.4, pulsante "Esci"). */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;

  const ctx = await requireEnrollment(slug);
  if (isDenied(ctx)) return ctx.response;

  const abandoned = await abandonAttempt(id, ctx.enrollment);
  if (!abandoned) {
    return NextResponse.json(
      { error: "nessun tentativo da abbandonare" },
      { status: 404 },
    );
  }
  return NextResponse.json({ abandoned: true });
}
