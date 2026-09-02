import { Prisma, UnlockMethod } from "@prisma/client";
import { prisma } from "./prisma";
import { verifyCode } from "./codes";
import type { EnrollmentRef } from "./enrollment";

// Lo sblocco di una lezione ha un'unica fonte di verità: o esiste una riga
// LessonUnlock per questa iscrizione, o la lezione è aperta a tutto il corso
// da `CourseLesson.globallyUnlocked`. Nessuno stato nel browser (§7.9, dove
// tre meccanismi diversi si sovrapponevano).

/** Errori di codice tollerati prima del blocco temporaneo (§7.6). */
export const MAX_FAILED_UNLOCKS = 5;
export const UNLOCK_WINDOW_MS = 10 * 60 * 1000;

export async function isLessonUnlockedFor(
  enrollment: EnrollmentRef,
  courseLessonId: string,
): Promise<boolean> {
  const courseLesson = await prisma.courseLesson.findFirst({
    where: { id: courseLessonId, courseId: enrollment.courseId },
    select: { globallyUnlocked: true },
  });
  if (!courseLesson) return false;
  if (courseLesson.globallyUnlocked) return true;

  const unlock = await prisma.lessonUnlock.findUnique({
    where: {
      enrollmentId_courseLessonId: {
        enrollmentId: enrollment.id,
        courseLessonId,
      },
    },
    select: { id: true },
  });
  return unlock !== null;
}

export type UnlockOutcome =
  | { ok: true; alreadyUnlocked: boolean }
  | { ok: false; reason: "not_found" | "wrong_code" | "rate_limited" };

/**
 * Verifica il codice della serata e registra lo sblocco.
 *
 * La lezione viene cercata *dentro il corso dell'iscrizione*: un codice
 * indovinato per un'altra edizione non apre nulla qui.
 */
export async function unlockWithCode(
  enrollment: EnrollmentRef,
  courseLessonId: string,
  code: string,
): Promise<UnlockOutcome> {
  const courseLesson = await prisma.courseLesson.findFirst({
    where: { id: courseLessonId, courseId: enrollment.courseId },
    select: { unlockCodeEncrypted: true },
  });
  if (!courseLesson) return { ok: false, reason: "not_found" };

  if (await isLessonUnlockedFor(enrollment, courseLessonId)) {
    return { ok: true, alreadyUnlocked: true };
  }

  const recentFailures = await prisma.unlockAttempt.count({
    where: {
      enrollmentId: enrollment.id,
      courseLessonId,
      succeeded: false,
      createdAt: { gte: new Date(Date.now() - UNLOCK_WINDOW_MS) },
    },
  });
  if (recentFailures >= MAX_FAILED_UNLOCKS) {
    return { ok: false, reason: "rate_limited" };
  }

  const succeeded = verifyCode(code, courseLesson.unlockCodeEncrypted);
  await prisma.unlockAttempt.create({
    data: {
      courseId: enrollment.courseId,
      enrollmentId: enrollment.id,
      courseLessonId,
      succeeded,
    },
  });

  if (!succeeded) return { ok: false, reason: "wrong_code" };

  // Due invii quasi simultanei del codice giusto possono superare entrambi
  // il controllo `isLessonUnlockedFor` qui sopra: il vincolo di unicità sul
  // database ferma il secondo `create`, che altrimenti risponderebbe con un
  // 500 generico a uno sblocco in realtà riuscito.
  try {
    await prisma.lessonUnlock.create({
      data: {
        courseId: enrollment.courseId,
        enrollmentId: enrollment.id,
        courseLessonId,
        method: UnlockMethod.CODE,
      },
    });
    return { ok: true, alreadyUnlocked: false };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: true, alreadyUnlocked: true };
    }
    throw error;
  }
}
