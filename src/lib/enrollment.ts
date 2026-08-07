import { CourseStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { codeLookup, verifyCode } from "./codes";

// L'iscrizione è la porta d'ingresso a un corso. Tutto ciò che un corsista
// fa — sblocchi, tentativi, punteggi — appende qui, mai direttamente
// all'utente: è ciò che permette alla stessa persona di seguire due corsi
// senza che i due percorsi si contaminino.

/** Errori di codice tollerati prima del blocco temporaneo (§7.6). */
export const MAX_FAILED_ENROLLMENTS = 5;
export const ENROLLMENT_WINDOW_MS = 10 * 60 * 1000;

export type EnrollmentRef = {
  id: string;
  courseId: string;
};

/** L'iscrizione di questo utente a questo corso, se esiste. */
export async function findEnrollment(
  userId: string,
  courseSlug: string,
): Promise<EnrollmentRef | null> {
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId, course: { slug: courseSlug } },
    select: { id: true, courseId: true },
  });
  return enrollment;
}

export type EnrollOutcome =
  | {
      ok: true;
      enrollment: EnrollmentRef;
      courseSlug: string;
      alreadyEnrolled: boolean;
    }
  | {
      ok: false;
      reason: "not_found" | "closed" | "wrong_code" | "rate_limited";
    };

/**
 * Iscrive un utente partendo dal solo codice, senza sapere di quale corso
 * sia: i codici d'iscrizione sono unici su tutti i corsi (vincolo sul
 * database, vedi `Course.enrollmentCodeLookup`), quindi il codice identifica
 * il corso da sé.
 *
 * È ciò che permette a un corsista di entrare digitando quello che ha
 * sentito in aula, senza dipendere da un link ricevuto per messaggio.
 */
export async function enrollWithCodeOnly(
  userId: string,
  code: string,
): Promise<EnrollOutcome> {
  const course = await prisma.course.findUnique({
    where: { enrollmentCodeLookup: codeLookup(code) },
    select: { slug: true },
  });
  // Codice inesistente: si risponde come per un codice sbagliato, così non
  // si rivela quali codici esistono.
  if (!course) return { ok: false, reason: "wrong_code" };

  return enrollWithCode(userId, course.slug, code);
}

/**
 * Iscrive un utente a un corso noto, verificando il codice sul server.
 * Il codice non viene mai restituito al corsista: viaggia solo in entrata.
 */
export async function enrollWithCode(
  userId: string,
  courseSlug: string,
  code: string,
): Promise<EnrollOutcome> {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    select: {
      id: true,
      slug: true,
      status: true,
      enrollmentOpen: true,
      enrollmentCodeEncrypted: true,
    },
  });
  if (!course || course.status === CourseStatus.DRAFT) {
    // Un corso in preparazione non esiste, per chi non è relatore.
    return { ok: false, reason: "not_found" };
  }

  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
    select: { id: true, courseId: true },
  });
  if (existing) {
    return {
      ok: true,
      enrollment: existing,
      courseSlug: course.slug,
      alreadyEnrolled: true,
    };
  }

  if (!course.enrollmentOpen || course.status === CourseStatus.ARCHIVED) {
    return { ok: false, reason: "closed" };
  }

  const recentFailures = await prisma.enrollmentAttempt.count({
    where: {
      userId,
      courseId: course.id,
      succeeded: false,
      createdAt: { gte: new Date(Date.now() - ENROLLMENT_WINDOW_MS) },
    },
  });
  if (recentFailures >= MAX_FAILED_ENROLLMENTS) {
    return { ok: false, reason: "rate_limited" };
  }

  const succeeded = verifyCode(code, course.enrollmentCodeEncrypted);
  await prisma.enrollmentAttempt.create({
    data: { userId, courseId: course.id, succeeded },
  });

  if (!succeeded) return { ok: false, reason: "wrong_code" };

  const enrollment = await prisma.enrollment.create({
    data: { userId, courseId: course.id },
    select: { id: true, courseId: true },
  });
  return {
    ok: true,
    enrollment,
    courseSlug: course.slug,
    alreadyEnrolled: false,
  };
}

/** I corsi a cui questa persona è iscritta, per l'elenco dopo il login. */
export async function myCourses(userId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId, course: { status: { not: CourseStatus.DRAFT } } },
    orderBy: { enrolledAt: "desc" },
    select: {
      id: true,
      enrolledAt: true,
      course: {
        select: {
          slug: true,
          titleIt: true,
          titleEn: true,
          subtitleIt: true,
          subtitleEn: true,
          status: true,
        },
      },
    },
  });
  return enrollments;
}
