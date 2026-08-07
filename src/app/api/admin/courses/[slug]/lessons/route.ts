import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { addLessonToCourse, createLessonInCourse } from "@/lib/admin";

/**
 * Aggiunge una serata al corso, nei due modi in cui il relatore ci arriva:
 * pescando dal catalogo una lezione che esiste già (`lessonId`), oppure
 * scrivendone una nuova sul posto (`titleIt`). Nel secondo caso la lezione
 * nasce in catalogo e resta riusabile altrove.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const titleIt = typeof body?.titleIt === "string" ? body.titleIt.trim() : "";
  const titleEn = typeof body?.titleEn === "string" ? body.titleEn.trim() : "";
  const hasLessonId = body?.lessonId !== undefined && body?.lessonId !== null;
  const lessonId = Number(body?.lessonId);

  if (!code) {
    return NextResponse.json(
      { error: "Serve un codice per la serata." },
      { status: 400 },
    );
  }

  if (!hasLessonId && !titleIt) {
    return NextResponse.json(
      { error: "Serve una lezione del catalogo, o il titolo di una nuova." },
      { status: 400 },
    );
  }

  if (hasLessonId && !Number.isInteger(lessonId)) {
    return NextResponse.json(
      { error: "Serve una lezione e un codice per la serata." },
      { status: 400 },
    );
  }

  const { slug } = await params;

  try {
    const added = hasLessonId
      ? await addLessonToCourse(slug, lessonId, code)
      : await createLessonInCourse(
          slug,
          { titleIt, titleEn: titleEn || titleIt },
          code,
        );

    if (!added) {
      return NextResponse.json({ error: "corso inesistente" }, { status: 404 });
    }
  } catch {
    // Il vincolo di unicità dice che la lezione è già nel corso, o che il
    // codice è già usato da un'altra serata dello stesso corso.
    return NextResponse.json(
      { error: "Lezione già presente, o codice già usato in questo corso." },
      { status: 409 },
    );
  }

  return NextResponse.json({ added: true });
}
