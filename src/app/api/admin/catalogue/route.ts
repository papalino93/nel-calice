import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { catalogue, createLesson } from "@/lib/admin";

/** Le lezioni del catalogo, con quante domande hanno e in quanti corsi sono. */
export async function GET() {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  return NextResponse.json({ lessons: await catalogue() });
}

/** Crea una lezione nel catalogo. Non appartiene a nessun corso finché non
    la si aggiunge esplicitamente a uno. */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const body = await request.json().catch(() => null);
  const titleIt = typeof body?.titleIt === "string" ? body.titleIt.trim() : "";
  if (!titleIt) {
    return NextResponse.json({ error: "Serve almeno il titolo." }, { status: 400 });
  }

  const lesson = await createLesson({
    titleIt,
    titleEn: typeof body?.titleEn === "string" && body.titleEn.trim() ? body.titleEn.trim() : titleIt,
    subtitleIt: body?.subtitleIt || null,
    subtitleEn: body?.subtitleEn || null,
  });

  return NextResponse.json({ id: lesson.id });
}
