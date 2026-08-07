import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { readStoredFile } from "@/lib/materials";

/** La stessa dispensa, ma per il relatore: nessun vincolo di sblocco. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const material = await prisma.material.findUnique({
    where: { id: (await params).id },
    select: { url: true },
  });
  if (!material) {
    return NextResponse.json({ error: "dispensa inesistente" }, { status: 404 });
  }

  const file = await readStoredFile(material.url);
  if (!file) {
    return NextResponse.json({ error: "file inesistente" }, { status: 404 });
  }

  return new NextResponse(file.stream, {
    headers: {
      "Cache-Control": "private, no-cache",
      "Content-Type": file.blob.contentType ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
