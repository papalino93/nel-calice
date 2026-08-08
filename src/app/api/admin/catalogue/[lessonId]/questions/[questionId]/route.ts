import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import {
  deleteQuestion,
  questionHasAnswers,
  saveQuestion,
  type QuestionInput,
} from "@/lib/admin";

/**
 * Sostituisce testo e opzioni di una domanda.
 *
 * Le opzioni vengono ricreate, quindi cambiano id. Se qualcuno ha già
 * risposto a questa domanda, i suoi punti resterebbero registrati su
 * un'opzione che non esiste più: in quel caso la modifica si rifiuta e si
 * suggerisce di crearne una nuova. I risultati già consegnati non si
 * riscrivono a posteriori.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ lessonId: string; questionId: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const { lessonId, questionId } = await params;
  const id = Number(questionId);

  if (await questionHasAnswers(id)) {
    return NextResponse.json(
      {
        error:
          "Qualcuno ha già risposto a questa domanda: modificarla falserebbe i punteggi già assegnati. Creane una nuova.",
      },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => null)) as QuestionInput | null;
  if (!body?.textIt || !Array.isArray(body.options)) {
    return NextResponse.json({ error: "dati non validi" }, { status: 400 });
  }

  const result = await saveQuestion(Number(lessonId), id, {
    textIt: body.textIt,
    textEn: body.textEn || body.textIt,
    explanationIt: body.explanationIt || null,
    explanationEn: body.explanationEn || null,
    options: body.options,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "Servono almeno due opzioni e una sola risposta corretta." },
      { status: 400 },
    );
  }
  return NextResponse.json({ saved: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ questionId: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const id = Number((await params).questionId);

  if (await questionHasAnswers(id)) {
    return NextResponse.json(
      {
        error:
          "Qualcuno ha già risposto a questa domanda: cancellarla cancellerebbe anche le sue risposte.",
      },
      { status: 409 },
    );
  }

  await deleteQuestion(id);
  return NextResponse.json({ deleted: true });
}
