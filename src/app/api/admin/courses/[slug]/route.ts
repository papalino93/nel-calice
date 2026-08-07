import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { courseDetail, updateCourse } from "@/lib/admin";

/** Dettaglio di un corso per il relatore, codici in chiaro compresi. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const detail = await courseDetail((await params).slug);
  if (!detail) {
    return NextResponse.json({ error: "corso inesistente" }, { status: 404 });
  }
  return NextResponse.json(detail);
}

/** Modifica titoli, stato, iscrizioni, codice e durate dei timer. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "dati non validi" }, { status: 400 });
  }

  try {
    await updateCourse((await params).slug, body);
  } catch {
    // Il caso tipico: un codice d'iscrizione già usato da un altro corso,
    // rifiutato dal vincolo di unicità.
    return NextResponse.json(
      { error: "Codice già usato da un altro corso, o dati non validi." },
      { status: 409 },
    );
  }

  return NextResponse.json({ saved: true });
}
