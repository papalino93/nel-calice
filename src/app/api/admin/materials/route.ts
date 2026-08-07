import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { createMaterial } from "@/lib/materials";

/** Registra una dispensa già caricata sullo store (o un video esterno). */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const body = await request.json().catch(() => null);
  const titleIt = typeof body?.titleIt === "string" ? body.titleIt.trim() : "";
  const url = typeof body?.url === "string" ? body.url.trim() : "";

  if (!titleIt || !url) {
    return NextResponse.json(
      { error: "Servono un titolo e un file (o un link video)." },
      { status: 400 },
    );
  }

  // Esattamente uno fra lezione e corso: è la stessa regola che il vincolo
  // CHECK impone sul database, controllata qui per dare un messaggio chiaro.
  const hasLesson = Number.isInteger(Number(body?.lessonId));
  const hasCourse = typeof body?.courseId === "string" && body.courseId;
  if (hasLesson === Boolean(hasCourse)) {
    return NextResponse.json(
      { error: "La dispensa va legata a una lezione oppure a un corso." },
      { status: 400 },
    );
  }

  await createMaterial({
    lessonId: hasLesson ? Number(body.lessonId) : null,
    courseId: hasCourse ? body.courseId : null,
    type: body?.type ?? "PDF",
    titleIt,
    titleEn: body?.titleEn ?? null,
    url,
    notes: body?.notes ?? null,
  });

  return NextResponse.json({ created: true });
}
