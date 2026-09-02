import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { adminUnlockLesson } from "@/lib/admin";

/**
 * Sblocca una serata per un singolo iscritto che l'ha persa, senza aprirla
 * per tutta la classe. Solo il relatore.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const body = await request.json().catch(() => null);
  const enrollmentId =
    typeof body?.enrollmentId === "string" ? body.enrollmentId : "";
  const courseLessonId =
    typeof body?.courseLessonId === "string" ? body.courseLessonId : "";

  if (!enrollmentId || !courseLessonId) {
    return NextResponse.json(
      { error: "Serve l'iscritto e la lezione." },
      { status: 400 },
    );
  }

  const unlocked = await adminUnlockLesson(
    (await params).slug,
    enrollmentId,
    courseLessonId,
  );
  if (!unlocked) {
    return NextResponse.json(
      { error: "Iscritto o lezione non trovati in questo corso." },
      { status: 404 },
    );
  }

  return NextResponse.json({ unlocked: true });
}
