import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { lessonWithQuestions, updateLesson } from "@/lib/admin";

/** Una lezione del catalogo con tutte le sue domande e opzioni. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const lessonId = Number((await params).lessonId);
  if (!Number.isInteger(lessonId)) {
    return NextResponse.json({ error: "lezione non valida" }, { status: 400 });
  }

  const lesson = await lessonWithQuestions(lessonId);
  if (!lesson) {
    return NextResponse.json({ error: "lezione inesistente" }, { status: 404 });
  }
  return NextResponse.json(lesson);
}

/** Titoli e note della lezione. Le modifiche valgono per tutti i corsi che
    la usano — è contenuto condiviso, ed è il punto della separazione. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "dati non validi" }, { status: 400 });
  }

  await updateLesson(Number((await params).lessonId), body);
  return NextResponse.json({ saved: true });
}
