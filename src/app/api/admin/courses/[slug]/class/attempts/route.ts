import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { resetAttempt } from "@/lib/admin";

/**
 * Azzera il tentativo di un corsista su una lezione, perché possa rifarlo.
 * Solo il relatore: è la via per un click su "inizia" per sbaglio, o un
 * tentativo partito e mai davvero svolto — non un pulsante che il corsista
 * possa premersi da sé.
 */
export async function DELETE(
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

  const reset = await resetAttempt(
    (await params).slug,
    enrollmentId,
    courseLessonId,
  );
  if (!reset) {
    return NextResponse.json(
      { error: "Nessun tentativo da azzerare." },
      { status: 404 },
    );
  }

  return NextResponse.json({ reset: true });
}
