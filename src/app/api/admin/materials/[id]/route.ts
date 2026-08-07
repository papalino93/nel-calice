import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { deleteMaterial } from "@/lib/materials";

/** Elimina la dispensa e il suo file dallo store. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const removed = await deleteMaterial((await params).id);
  if (!removed) {
    return NextResponse.json({ error: "dispensa inesistente" }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
