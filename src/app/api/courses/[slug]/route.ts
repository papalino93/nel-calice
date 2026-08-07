import { NextResponse } from "next/server";
import { isDenied, requireEnrollment } from "@/lib/guard";
import { courseOverview } from "@/lib/course";
import { prisma } from "@/lib/prisma";

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

  // Serve a decidere se mostrare "Torna ai corsi": chi è iscritto a un corso
  // solo verrebbe rimandato qui dalla home, in un anello chiuso.
  const enrolledCount = await prisma.enrollment.count({
    where: { userId: ctx.user.id },
  });

  return NextResponse.json({
    ...overview,
    hasOtherCourses: enrolledCount > 1,
    user: {
      name: ctx.user.name,
      email: ctx.user.email,
      role: ctx.user.role,
    },
  });
}
