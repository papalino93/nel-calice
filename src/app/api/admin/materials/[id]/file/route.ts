import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { loadMaterialBytes } from "@/lib/materials";

/** La stessa dispensa, ma per il relatore: nessun vincolo di sblocco. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const material = await prisma.material.findUnique({
    where: { id: (await params).id },
    select: { url: true, content: true, contentType: true },
  });
  if (!material) {
    return NextResponse.json({ error: "dispensa inesistente" }, { status: 404 });
  }

  const file = await loadMaterialBytes(material);
  if (!file) {
    return NextResponse.json({ error: "file inesistente" }, { status: 404 });
  }

  return new NextResponse(file.bytes as BodyInit, {
    headers: {
      "Cache-Control": "private, no-cache",
      "Content-Type": file.contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
