import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { liveLessonOverview } from "@/lib/admin";

/**
 * Cosa succede in aula proprio ora, su questa lezione (§7.19): chi ha
 * aperto il quiz, a che punto è, quante risposte sono giuste finora. Pensata
 * per essere richiamata a ripetizione (la pagina fa polling) mentre la
 * classe risponde, non solo una volta a fine serata.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; clId: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const { slug, clId } = await params;
  const overview = await liveLessonOverview(slug, clId);
  if (!overview) {
    return NextResponse.json({ error: "lezione inesistente" }, { status: 404 });
  }
  return NextResponse.json(overview);
}
