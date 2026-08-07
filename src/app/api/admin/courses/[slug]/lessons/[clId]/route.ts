import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { removeLessonFromCourse, updateCourseLesson } from "@/lib/admin";

/** Cambia codice, sblocco globale, ruolo di prova finale o numero. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clId: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "dati non validi" }, { status: 400 });
  }

  try {
    const updated = await updateCourseLesson((await params).clId, body);
    if (!updated) {
      return NextResponse.json({ error: "lezione inesistente" }, { status: 404 });
    }
  } catch {
    return NextResponse.json(
      { error: "Codice o numero già usati in questo corso." },
      { status: 409 },
    );
  }

  return NextResponse.json({ saved: true });
}

/**
 * Toglie la lezione dal corso.
 *
 * La lezione resta nel catalogo con le sue domande e dispense: qui sparisce
 * solo la sua presenza in questa edizione. Se qualche corsista l'aveva già
 * svolta, i suoi tentativi se ne vanno con essa — per questo il pannello
 * chiede conferma quando ci sono iscritti.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ clId: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  await removeLessonFromCourse((await params).clId);
  return NextResponse.json({ removed: true });
}
