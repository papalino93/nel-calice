import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { courseLogoFor } from "@/lib/admin";
import { isDbStored, readStoredFile } from "@/lib/materials";

/** Il logo, per l'anteprima del relatore nel pannello del corso. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; logoId: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const { slug, logoId } = await params;
  const logo = await courseLogoFor(slug, logoId);
  if (!logo || logo.url === null) {
    return NextResponse.json({ error: "logo inesistente" }, { status: 404 });
  }

  if (isDbStored(logo.url)) {
    if (!logo.content) {
      return NextResponse.json({ error: "file inesistente" }, { status: 404 });
    }
    return new NextResponse(logo.content as BodyInit, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": logo.contentType ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  try {
    const file = await readStoredFile(logo.url);
    if (!file) {
      return NextResponse.json({ error: "file inesistente" }, { status: 404 });
    }
    return new NextResponse(file.stream, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": file.blob.contentType ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[logo/file] file Blob non disponibile", error);
    return NextResponse.json(
      { error: "Logo non disponibile: ricaricalo dal pannello del corso." },
      { status: 404 },
    );
  }
}
