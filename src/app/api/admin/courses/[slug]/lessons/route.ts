import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { addLessonToCourse } from "@/lib/admin";

/** Aggiunge al corso una lezione presa dal catalogo. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const body = await request.json().catch(() => null);
  const lessonId = Number(body?.lessonId);
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!Number.isInteger(lessonId) || !code) {
    return NextResponse.json(
      { error: "Serve una lezione e un codice per la serata." },
      { status: 400 },
    );
  }

  try {
    const added = await addLessonToCourse((await params).slug, lessonId, code);
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
