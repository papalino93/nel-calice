import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { courseOverview } from "@/lib/course";
import { prisma } from "@/lib/prisma";

/**
 * Dettaglio di una lezione: il riquadro del quiz e le sue dispense, insieme
 * nella stessa pagina (§3.3, requisito esplicito: non in sezioni separate).
 *
 * I materiali legati a una lezione ereditano il blocco di quella lezione
 * (§3.7d): se è ancora chiusa, non escono dal server.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "non autenticato" }, { status: 401 });
  }

  const lessonId = Number((await params).id);
  if (!Number.isInteger(lessonId)) {
    return NextResponse.json({ error: "lezione non valida" }, { status: 400 });
  }

  const overview = await courseOverview(user.id);
  const lesson = overview.lessons.find((l) => l.id === lessonId);
  if (!lesson) {
    return NextResponse.json({ error: "lezione inesistente" }, { status: 404 });
  }

  if (lesson.status === "bloccata") {
    return NextResponse.json({ error: "lezione bloccata" }, { status: 403 });
  }

  const materials = await prisma.material.findMany({
    where: { lessonId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      titleIt: true,
      titleEn: true,
      url: true,
      notes: true,
    },
  });

  return NextResponse.json({ lesson, materials });
}
