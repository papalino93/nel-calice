import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { createCourse } from "@/lib/admin";

/**
 * Crea un corso nuovo, vuoto. Nasce sempre "In preparazione": il relatore
 * gli aggiunge le lezioni e lo attiva dal pannello del corso, non da qui.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const body = await request.json().catch(() => null);
  const titleIt = typeof body?.titleIt === "string" ? body.titleIt.trim() : "";
  const titleEn = typeof body?.titleEn === "string" ? body.titleEn.trim() : "";
  const enrollmentCode =
    typeof body?.enrollmentCode === "string" ? body.enrollmentCode.trim() : "";

  if (!titleIt || !enrollmentCode) {
    return NextResponse.json(
      { error: "Servono un titolo e un codice d'iscrizione." },
      { status: 400 },
    );
  }

  try {
    const course = await createCourse({ titleIt, titleEn, enrollmentCode });
    return NextResponse.json({ slug: course.slug });
  } catch {
    // Il vincolo di unicità dice che il codice d'iscrizione è già usato da
    // un altro corso: sono unici su tutti i corsi, non solo entro uno.
    return NextResponse.json(
      { error: "Codice d'iscrizione già usato da un altro corso." },
      { status: 409 },
    );
  }
}
