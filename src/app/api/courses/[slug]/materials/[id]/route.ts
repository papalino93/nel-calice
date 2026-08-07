import { NextResponse } from "next/server";
import { isDenied, requireEnrollment } from "@/lib/guard";
import { courseOverview } from "@/lib/course";
import { prisma } from "@/lib/prisma";
import { readStoredFile } from "@/lib/materials";

/**
 * Serve una dispensa a un iscritto.
 *
 * Il controllo avviene ad **ogni** lettura, non una volta sola: chi non è
 * iscritto, o ha la lezione ancora bloccata, non riceve il file. Copiare
 * questo indirizzo e girarlo non serve a nulla senza la propria sessione —
 * ed è ciò che rende vero il §3.7d.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;

  const ctx = await requireEnrollment(slug);
  if (isDenied(ctx)) return ctx.response;

  const material = await prisma.material.findUnique({
    where: { id },
    select: { url: true, lessonId: true, courseId: true },
  });
  if (!material) {
    return NextResponse.json({ error: "dispensa inesistente" }, { status: 404 });
  }

  // Deve appartenere a questo corso, direttamente o tramite una sua lezione.
  const overview = await courseOverview(ctx.enrollment);
  if (!overview) {
    return NextResponse.json({ error: "corso inesistente" }, { status: 404 });
  }

  if (material.courseId && material.courseId !== ctx.enrollment.courseId) {
    return NextResponse.json({ error: "non disponibile" }, { status: 403 });
  }

  if (material.lessonId !== null) {
    // La dispensa segue il blocco della lezione a cui appartiene.
    const courseLesson = await prisma.courseLesson.findFirst({
      where: { courseId: ctx.enrollment.courseId, lessonId: material.lessonId },
      select: { id: true },
    });
    const card = overview.lessons.find(
      (l) => l.courseLessonId === courseLesson?.id,
    );
    if (!card || card.status === "bloccata") {
      return NextResponse.json({ error: "non disponibile" }, { status: 403 });
    }
  }

  const file = await readStoredFile(material.url);
  if (!file) {
    return NextResponse.json({ error: "file inesistente" }, { status: 404 });
  }

  // Contatore visualizzazioni: non deve far fallire la lettura se va storto.
  void prisma.material
    .update({ where: { id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});

  return new NextResponse(file.stream, {
    headers: {
      "Cache-Control": "private, no-cache",
      "Content-Type": file.blob.contentType ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
