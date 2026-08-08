import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { issuePutPermission } from "@/lib/blobUpload";

/** Firma un indirizzo su cui il browser può scrivere una dispensa, e basta. */

const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

const MAX_BYTES = 50 * 1024 * 1024;

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const body = await request.json().catch(() => null);
  const pathname = typeof body?.pathname === "string" ? body.pathname : "";
  const contentType =
    typeof body?.contentType === "string" ? body.contentType : "";

  if (!pathname || !ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json(
      { error: "Tipo di file non ammesso." },
      { status: 400 },
    );
  }

  try {
    const presignedUrl = await issuePutPermission({
      pathname,
      contentType,
      maxBytes: MAX_BYTES,
    });
    return NextResponse.json({ presignedUrl });
  } catch (error) {
    console.error("[materiali/upload]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "firma fallita" },
      { status: 400 },
    );
  }
}
