import { NextResponse } from "next/server";
import { isDenied, requireEnrollment } from "@/lib/guard";
import { materialsForCourse, withServingUrls } from "@/lib/materials";

/**
 * Dispense generali del corso — non legate a nessuna serata, quindi visibili
 * a ogni iscritto appena entra, senza sblocco.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const ctx = await requireEnrollment(slug);
  if (isDenied(ctx)) return ctx.response;

  const materials = await materialsForCourse(ctx.enrollment.courseId);
  return NextResponse.json({
    materials: withServingUrls(materials, `/api/courses/${slug}/materials`),
  });
}
