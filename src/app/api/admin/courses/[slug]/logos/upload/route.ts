import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { issuePutPermission } from "@/lib/blobUpload";

/**
 * Firma un indirizzo su cui il browser può scrivere un logo per l'attestato.
 *
 * Stesso store delle dispense, vincoli diversi: qui sono immagini piccole,
 * pensate per starci fianco a fianco su una riga dell'attestato, non file da
 * decine di megabyte. Niente PDF né slide — questo non è materiale
 * didattico, è un marchio.
 */

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const { slug } = await params;
  const body = await request.json().catch(() => null);
  const contentType =
    typeof body?.contentType === "string" ? body.contentType : "";

  if (!ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json(
      { error: "Tipo di file non ammesso: solo PNG, JPEG o WebP." },
      { status: 400 },
    );
  }

  const unico = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const pathname = `loghi/${slug}/${unico}`;

  try {
    const presignedUrl = await issuePutPermission({
      pathname,
      contentType,
      maxBytes: MAX_BYTES,
    });
    return NextResponse.json({ presignedUrl, pathname });
  } catch (error) {
    console.error("[loghi/upload]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "firma fallita" },
      { status: 400 },
    );
  }
}
