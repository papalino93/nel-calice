import { Prisma } from "@prisma/client";
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
  } catch (error) {
    // Due cause distinte dietro lo stesso vincolo di unicità: il codice
    // d'iscrizione già usato (il caso comune, unico su tutti i corsi) o —
    // solo se due creazioni con lo stesso titolo partono nello stesso
    // istante — lo slug che nel frattempo è stato preso da un'altra. Senza
    // distinguerle si rischiava di dire "codice già usato" quando il codice
    // c'entrava zero.
    const onSlug =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      (error.meta?.target as string[] | undefined)?.includes("slug");

    return NextResponse.json(
      {
        error: onSlug
          ? "Un corso con questo titolo è stato appena creato da un'altra richiesta. Riprova."
          : "Codice d'iscrizione già usato da un altro corso.",
      },
      { status: 409 },
    );
  }
}
