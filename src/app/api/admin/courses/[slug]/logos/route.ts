import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { addCourseLogoImage, addCourseLogoText } from "@/lib/admin";

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/**
 * Registra un riquadro dell'attestato: un'immagine passata inline, oppure
 * un testo al suo posto (`text`) — mai entrambi,
 * lo stesso vincolo che il database impone alla riga.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content : "";
  const contentType =
    typeof body?.contentType === "string" ? body.contentType : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (!content && !text) {
    return NextResponse.json(
      { error: "Serve il file caricato, o un testo." },
      { status: 400 },
    );
  }
  if (content && text) {
    return NextResponse.json(
      { error: "Un riquadro è un'immagine o un testo, non entrambi." },
      { status: 400 },
    );
  }
  if (content && !ALLOWED_IMAGE_TYPES.includes(contentType)) {
    return NextResponse.json(
      { error: "Tipo di file non ammesso: solo PNG, JPEG o WebP." },
      { status: 400 },
    );
  }

  try {
    const slug = (await params).slug;
    const bytes = content ? Buffer.from(content, "base64") : null;
    if (bytes && (bytes.byteLength === 0 || bytes.byteLength > MAX_LOGO_BYTES)) {
      return NextResponse.json(
        { error: "Il logo deve essere un file non vuoto di massimo 2MB." },
        { status: 400 },
      );
    }
    const logo = bytes
      ? await addCourseLogoImage(slug, bytes, contentType)
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
