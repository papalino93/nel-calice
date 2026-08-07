import { AttemptStatus } from "@prisma/client";
import { prisma } from "./prisma";
import {
  TOTAL_COURSE_POINTS,
  computeBudgets,
  meritTitle,
  percentage,
} from "./scoring";
import type { EnrollmentRef } from "./enrollment";

/**
 * Stato di una lezione dal punto di vista di un iscritto (§3.2).
 * Lo stato è sempre calcolato qui: il client non decide se una lezione è
 * sbloccata, la riceve già decisa (§7.2, §7.9).
 */
export type LessonStatus = "bloccata" | "daFare" | "fatto" | "vuoto";

export type LessonCard = {
  /** Id della lezione *dentro questo corso*, non quello di catalogo. */
  courseLessonId: string;
  /** Il numero mostrato, che vale solo dentro questo corso. */
  position: number;
  titleIt: string;
  titleEn: string;
  subtitleIt: string | null;
  subtitleEn: string | null;
  isExam: boolean;
  status: LessonStatus;
  /** Punti in palio per questa lezione in questo corso. */
  points: number;
  score: number | null;
  maxScore: number | null;
  attemptId: string | null;
  inProgress: boolean;
};

export type CourseOverview = {
  course: {
    slug: string;
    titleIt: string;
    titleEn: string;
    subtitleIt: string | null;
    subtitleEn: string | null;
  };
  lessons: LessonCard[];
  totalScore: number;
  totalPoints: number;
  meritTitle: string;
  examDone: boolean;
};

/** Tutto ciò che serve alla dashboard di un corso, in una lettura sola. */
export async function courseOverview(
  enrollment: EnrollmentRef,
): Promise<CourseOverview | null> {
  const course = await prisma.course.findUnique({
    where: { id: enrollment.courseId },
    select: {
      slug: true,
      titleIt: true,
      titleEn: true,
      subtitleIt: true,
      subtitleEn: true,
      lessons: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          position: true,
          isExam: true,
          globallyUnlocked: true,
          lesson: {
            select: {
              titleIt: true,
              titleEn: true,
              subtitleIt: true,
              subtitleEn: true,
              _count: { select: { questions: true } },
            },
          },
        },
      },
    },
  });
  if (!course) return null;

  const [unlocks, attempts] = await Promise.all([
    prisma.lessonUnlock.findMany({
      where: { enrollmentId: enrollment.id },
      select: { courseLessonId: true },
    }),
    prisma.quizAttempt.findMany({
      where: { enrollmentId: enrollment.id },
    }),
  ]);

  const unlockedIds = new Set(unlocks.map((u) => u.courseLessonId));
  const attemptByLesson = new Map(attempts.map((a) => [a.courseLessonId, a]));

  const budgets = computeBudgets(
    course.lessons.map((cl) => ({
      id: cl.id,
      isExam: cl.isExam,
      questionCount: cl.lesson._count.questions,
    })),
  );
  const budgetById = new Map(budgets.map((b) => [b.lessonId, b]));

  const cards: LessonCard[] = course.lessons.map((cl) => {
    const budget = budgetById.get(cl.id);
    const attempt = attemptByLesson.get(cl.id);
    const unlocked = cl.globallyUnlocked || unlockedIds.has(cl.id);
    const done = attempt && attempt.status !== AttemptStatus.IN_PROGRESS;

    let status: LessonStatus;
    if (cl.lesson._count.questions === 0) status = "vuoto";
    else if (done) status = "fatto";
    else if (!unlocked) status = "bloccata";
    else status = "daFare";

    return {
      courseLessonId: cl.id,
      position: cl.position,
      titleIt: cl.lesson.titleIt,
      titleEn: cl.lesson.titleEn,
      subtitleIt: cl.lesson.subtitleIt,
      subtitleEn: cl.lesson.subtitleEn,
      isExam: cl.isExam,
      status,
      points: budget?.budget ?? 0,
      score: done ? (attempt.score ?? 0) : null,
      maxScore: done ? (attempt.maxScore ?? 0) : null,
      attemptId: attempt?.id ?? null,
      inProgress: attempt?.status === AttemptStatus.IN_PROGRESS,
    };
  });

  const totalScore = cards.reduce((sum, c) => sum + (c.score ?? 0), 0);
  const exam = cards.find((c) => c.isExam);

  return {
    course: {
      slug: course.slug,
      titleIt: course.titleIt,
      titleEn: course.titleEn,
      subtitleIt: course.subtitleIt,
      subtitleEn: course.subtitleEn,
    },
    lessons: cards,
    totalScore,
    totalPoints: TOTAL_COURSE_POINTS,
    meritTitle: meritTitle(percentage(totalScore, TOTAL_COURSE_POINTS)),
    // Un corso senza prova finale non ha un "esame fatto": l'attestato in
    // quel caso dipende dall'aver completato le lezioni, non da un esame.
    examDone: exam ? exam.status === "fatto" : false,
  };
}
