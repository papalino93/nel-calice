import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { materialsForLesson, withServingUrls } from "@/lib/materials";

/** Dispense di una lezione del catalogo, viste dal relatore. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const lessonId = Number((await params).lessonId);
  if (!Number.isInteger(lessonId)) {
    return NextResponse.json({ error: "lezione non valida" }, { status: 400 });
  }

  const materials = await materialsForLesson(lessonId);
  return NextResponse.json({
    materials: withServingUrls(materials, "/api/admin/materials").map((m) => ({
      ...m,
      url: m.url.startsWith("/api/admin/materials/") ? `${m.url}/file` : m.url,
    })),
  });
}
