import { NextResponse } from "next/server";
import { isDenied, requireEnrollment } from "@/lib/guard";
import { certificateFor } from "@/lib/certificate";

/**
 * L'attestato di questo iscritto per questo corso, se lo ha ottenuto.
 * I dati vengono composti sul server: il client non può chiedere un
 * attestato con un punteggio o un titolo a piacere.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const ctx = await requireEnrollment((await params).slug);
  if (isDenied(ctx)) return ctx.response;

  const status = await certificateFor(ctx.enrollment, ctx.user.name);
  if (!status) {
    return NextResponse.json({ error: "corso inesistente" }, { status: 404 });
  }
  return NextResponse.json(status);
}
