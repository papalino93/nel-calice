import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { saveQuestion, type QuestionInput } from "@/lib/admin";

/** Crea una domanda con le sue opzioni. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const body = (await request.json().catch(() => null)) as QuestionInput | null;
  if (!body?.textIt || !Array.isArray(body.options)) {
    return NextResponse.json({ error: "dati non validi" }, { status: 400 });
  }

  const result = await saveQuestion(Number((await params).lessonId), null, {
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
  return NextResponse.json({ questionId: result.questionId });
}
