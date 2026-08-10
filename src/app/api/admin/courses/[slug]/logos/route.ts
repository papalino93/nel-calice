import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { addCourseLogoImage, addCourseLogoText } from "@/lib/admin";

/**
 * Registra un riquadro dell'attestato: un'immagine appena caricata sullo
 * store (`pathname`), oppure un testo al suo posto (`text`) — mai entrambi,
 * lo stesso vincolo che il database impone alla riga.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const body = await request.json().catch(() => null);
  const pathname = typeof body?.pathname === "string" ? body.pathname : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (!pathname && !text) {
    return NextResponse.json(
      { error: "Serve il file caricato, o un testo." },
      { status: 400 },
    );
  }
  if (pathname && text) {
    return NextResponse.json(
      { error: "Un riquadro è un'immagine o un testo, non entrambi." },
      { status: 400 },
    );
  }

  try {
    const slug = (await params).slug;
    const logo = pathname
      ? await addCourseLogoImage(slug, `blob:${pathname}`)
      : await addCourseLogoText(slug, text);
    if (!logo) {
      return NextResponse.json({ error: "corso inesistente" }, { status: 404 });
    }
    return NextResponse.json({ id: logo.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "salvataggio fallito" },
      { status: 400 },
    );
  }
}
