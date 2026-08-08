import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { sampleCertificate } from "@/lib/certificate";
import { prisma } from "@/lib/prisma";

/** Anteprima con dati d'esempio, per controllo prima del corso (§3.7a). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const course = await prisma.course.findUnique({
    where: { slug: (await params).slug },
    select: { titleIt: true },
  });
  if (!course) {
    return NextResponse.json({ error: "corso inesistente" }, { status: 404 });
  }

  return NextResponse.json({ data: sampleCertificate(course.titleIt) });
}
