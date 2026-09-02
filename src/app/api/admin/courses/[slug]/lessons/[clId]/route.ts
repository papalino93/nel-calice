import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { removeLessonFromCourse, updateCourseLesson } from "@/lib/admin";
import { isBlankCode } from "@/lib/codes";

/** Cambia codice, sblocco globale, ruolo di prova finale o numero. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; clId: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "dati non validi" }, { status: 400 });
  }

  const { slug, clId } = await params;

  // Un codice di soli spazi diventa il codice vuoto, che poi qualunque
  // stringa di spazi sblocca: va rifiutato con un messaggio, non salvato.
  if (body.unlockCode !== undefined && isBlankCode(body.unlockCode)) {
    return NextResponse.json(
      { error: "Il codice della serata non può essere vuoto." },
      { status: 400 },
    );
  }

  try {
    const updated = await updateCourseLesson(slug, clId, body);
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
  { params }: { params: Promise<{ slug: string; clId: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  // Lo slug del percorso non era usato: la cancellazione andava per solo id,
  // quindi un id appartenente a un altro corso portava via in cascata i
  // tentativi e gli sblocchi di quella classe. Ora la riga si tocca solo se
  // è davvero di questo corso.
  const { slug, clId } = await params;
  const removed = await removeLessonFromCourse(slug, clId);
  if (!removed) {
    return NextResponse.json(
      { error: "Questa lezione non fa parte di questo corso." },
      { status: 404 },
    );
  }

  return NextResponse.json({ removed: true });
}
