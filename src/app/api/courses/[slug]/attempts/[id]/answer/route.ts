import { NextResponse } from "next/server";
import { isDenied, requireEnrollment } from "@/lib/guard";
import { recordAnswer } from "@/lib/quiz";

/**
 * Registra una risposta mentre il quiz è in corso.
 * Salvare man mano è ciò che rende il timer applicabile: dopo la scadenza
 * questa route rifiuta, e alla consegna il server corregge quello che aveva
 * già in mano.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;

  const ctx = await requireEnrollment(slug);
  if (isDenied(ctx)) return ctx.response;

  const body = await request.json().catch(() => null);
  const questionId = Number(body?.questionId);
  const selectedOptionId =
    body?.selectedOptionId === null ? null : Number(body?.selectedOptionId);

  if (!Number.isInteger(questionId)) {
    return NextResponse.json({ error: "domanda non valida" }, { status: 400 });
  }
  if (selectedOptionId !== null && !Number.isInteger(selectedOptionId)) {
    return NextResponse.json({ error: "opzione non valida" }, { status: 400 });
  }

  const outcome = await recordAnswer(
    id,
    ctx.enrollment,
    questionId,
    selectedOptionId,
  );

  if (outcome.ok) return NextResponse.json({ saved: true });

  const status = {
    not_found: 404,
    expired: 409,
    closed: 409,
    bad_option: 400,
  }[outcome.reason];

  const message = {
    not_found: "Tentativo inesistente.",
    expired: "Tempo scaduto.",
    closed: "Questo quiz è già stato consegnato.",
    bad_option: "Risposta non valida per questa domanda.",
  }[outcome.reason];

  return NextResponse.json({ saved: false, error: message }, { status });
}
