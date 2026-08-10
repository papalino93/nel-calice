import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { removeCourseLogo } from "@/lib/admin";

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
