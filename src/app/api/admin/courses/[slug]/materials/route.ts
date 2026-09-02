import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { materialsForCourse, withServingUrls } from "@/lib/materials";

/** Dispense generali di un corso (non legate a una singola serata), viste dal relatore. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const course = await prisma.course.findUnique({
    where: { slug: (await params).slug },
    select: { id: true },
  });
  if (!course) {
    return NextResponse.json({ error: "corso inesistente" }, { status: 404 });
  }

  const materials = await materialsForCourse(course.id);
  return NextResponse.json({
    materials: withServingUrls(materials, "/api/admin/materials").map((m) => ({
      ...m,
      url: m.url.startsWith("/api/admin/materials/") ? `${m.url}/file` : m.url,
    })),
  });
}
