import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { sampleCertificate } from "@/lib/certificate";
import { prisma } from "@/lib/prisma";

/**
 * Anteprima con dati d'esempio, per controllo prima del corso (§3.7a).
 * Firma e loghi sono invece quelli veri: è il punto in cui il relatore deve
 * vedere esattamente cosa comparirà, non un secondo esempio scollegato.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const course = await prisma.course.findUnique({
    where: { slug: (await params).slug },
    select: {
      titleIt: true,
      titleEn: true,
      certificateIssuer: true,
      logos: { select: { url: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!course) {
    return NextResponse.json({ error: "corso inesistente" }, { status: 404 });
  }

  const data = await sampleCertificate(
    course.titleIt,
    course.titleEn,
    course.certificateIssuer,
    course.logos.map((l) => l.url),
  );
  return NextResponse.json({ data });
}
