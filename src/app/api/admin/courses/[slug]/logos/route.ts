import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { addCourseLogo } from "@/lib/admin";

/** Registra un logo appena caricato sullo store. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const body = await request.json().catch(() => null);
  const pathname = typeof body?.pathname === "string" ? body.pathname : "";
  if (!pathname) {
    return NextResponse.json({ error: "Serve il file caricato." }, { status: 400 });
  }

  try {
    const logo = await addCourseLogo((await params).slug, `blob:${pathname}`);
    if (!logo) {
      return NextResponse.json({ error: "corso inesistente" }, { status: 404 });
    }
    return NextResponse.json({ id: logo.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "salvataggio fallito" },
      { status: 400 },
    );
  }
}
