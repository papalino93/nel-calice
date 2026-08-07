import { NextResponse } from "next/server";
import { isDenied, requireEnrollment } from "@/lib/guard";
import { courseOverview } from "@/lib/course";
import { prisma } from "@/lib/prisma";

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
  if (lesson.status === "bloccata") {
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

  return NextResponse.json({ lesson, materials });
}
