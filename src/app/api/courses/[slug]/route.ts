import { NextResponse } from "next/server";
import { isDenied, requireEnrollment } from "@/lib/guard";
import { courseOverview } from "@/lib/course";

/**
 * Dashboard di un corso: le sue lezioni con lo stato di questo iscritto.
 * Non contiene né i codici di sblocco né le domande (§7.2, §7.3).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const ctx = await requireEnrollment((await params).slug);
  if (isDenied(ctx)) return ctx.response;

  const overview = await courseOverview(ctx.enrollment);
  if (!overview) {
    return NextResponse.json({ error: "corso inesistente" }, { status: 404 });
  }

  return NextResponse.json({
    ...overview,
    user: {
      name: ctx.user.name,
      email: ctx.user.email,
      role: ctx.user.role,
    },
  });
}
