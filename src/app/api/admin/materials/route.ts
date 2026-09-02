import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { createMaterial, createMaterialWithContent } from "@/lib/materials";

/**
 * Registra una dispensa: o già caricata sullo store Blob (o un link video),
 * o con il file passato qui in base64 — perché lo store Blob è sospeso per
 * limite del piano Hobby (§STATO.md) e i materiali salvati nel database non
 * hanno bisogno di quel passaggio a parte.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const body = await request.json().catch(() => null);
  const titleIt = typeof body?.titleIt === "string" ? body.titleIt.trim() : "";
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const contentBase64 =
    typeof body?.content === "string" ? body.content : "";
  const contentType =
    typeof body?.contentType === "string" ? body.contentType : "";

  if (!titleIt || (!url && !contentBase64)) {
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

  const common = {
    lessonId: hasLesson ? Number(body.lessonId) : null,
    courseId: hasCourse ? body.courseId : null,
    type: body?.type ?? "PDF",
    titleIt,
    titleEn: body?.titleEn ?? null,
    notes: body?.notes ?? null,
  } as const;

  try {
    if (contentBase64) {
      if (!contentType) {
        return NextResponse.json(
          { error: "Manca il tipo del file." },
          { status: 400 },
        );
      }
      await createMaterialWithContent({
        ...common,
        content: Buffer.from(contentBase64, "base64"),
        contentType,
      });
    } else {
      await createMaterial({ ...common, url });
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Non è stato possibile salvare la dispensa.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ created: true });
}
