import { NextResponse } from "next/server";
import { isDenied, requireEnrollment } from "@/lib/guard";
import { courseOverview } from "@/lib/course";
import { prisma } from "@/lib/prisma";
import { withServingUrls } from "@/lib/materials";

/**
 * Dettaglio di una lezione: il riquadro del quiz e le sue dispense, insieme
 * nella stessa pagina (§3.3, requisito esplicito).
 *
 * Le dispense di una lezione ereditano il suo blocco: finché la lezione è
 * chiusa non escono dal server (§3.7d).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; clId: string }> },
) {
  const { slug, clId } = await params;

  const ctx = await requireEnrollment(slug);
  if (isDenied(ctx)) return ctx.response;

  const overview = await courseOverview(ctx.enrollment);
  const lesson = overview?.lessons.find((l) => l.courseLessonId === clId);
  if (!lesson) {
    return NextResponse.json({ error: "lezione inesistente" }, { status: 404 });
  }
  // Si guarda lo sblocco, non lo stato: una lezione ancora priva di domande
  // vale "vuoto" pur restando chiusa, e dedurre il permesso dallo stato la
  // lasciava leggere — dispense comprese — a chi non aveva mai sentito il
  // codice della serata.
  if (!lesson.unlocked) {
    return NextResponse.json({ error: "lezione bloccata" }, { status: 403 });
  }

  const courseLesson = await prisma.courseLesson.findUnique({
    where: { id: clId },
    select: { lessonId: true },
  });

  // Dispense della lezione (dal catalogo) più quelle generali del corso.
  const materials = await prisma.material.findMany({
    where: {
      OR: [
        { lessonId: courseLesson?.lessonId },
        { courseId: ctx.enrollment.courseId },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      titleIt: true,
      titleEn: true,
      url: true,
      notes: true,
      lessonId: true,
    },
  });

  // Gli indirizzi interni non sono utilizzabili dal browser: si esce con
  // quelli della route che serve i file, dove ogni lettura ripassa dal
  // controllo di iscrizione e sblocco.
  return NextResponse.json({
    lesson,
    materials: withServingUrls(materials, `/api/courses/${slug}/materials`),
  });
}
