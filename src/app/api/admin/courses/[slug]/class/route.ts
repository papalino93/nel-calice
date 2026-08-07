import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { classOverview } from "@/lib/admin";

/**
 * Andamento della classe (§7.18): chi ha fatto cosa e quali domande sono
 * andate peggio. I dati c'erano già; mancava solo il modo di guardarli.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const overview = await classOverview((await params).slug);
  if (!overview) {
    return NextResponse.json({ error: "corso inesistente" }, { status: 404 });
  }
  return NextResponse.json(overview);
}
