import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { removeCourseLogo, updateCourseLogoSize } from "@/lib/admin";

const SIZES = ["SMALL", "MEDIUM", "LARGE"] as const;

/** Cambia la taglia di un riquadro dell'attestato. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; logoId: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const body = await request.json().catch(() => null);
  const size = body?.size;
  if (!SIZES.includes(size)) {
    return NextResponse.json({ error: "taglia non valida" }, { status: 400 });
  }

  const { slug, logoId } = await params;
  const updated = await updateCourseLogoSize(slug, logoId, size);
  if (!updated) {
    return NextResponse.json({ error: "logo inesistente" }, { status: 404 });
  }
  return NextResponse.json({ saved: true });
}

/** Toglie un logo dall'attestato del corso, e il suo file dallo store. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string; logoId: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const { slug, logoId } = await params;
  const removed = await removeCourseLogo(slug, logoId);
  if (!removed) {
    return NextResponse.json({ error: "logo inesistente" }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
