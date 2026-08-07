import { AttemptStatus } from "@prisma/client";
import { prisma } from "./prisma";
import {
  TOTAL_COURSE_POINTS,
  computeBudgets,
  meritTitle,
  percentage,
} from "./scoring";

/**
 * Stato di una lezione dal punto di vista di un corsista (§3.2).
 * Lo stato è sempre calcolato qui: il client non decide se una lezione è
 * sbloccata, la riceve già decisa.
 */
export type LessonStatus = "bloccata" | "daFare" | "fatto" | "vuoto";

export type LessonCard = {
  id: number;
  titleIt: string;
  titleEn: string;
  subtitleIt: string | null;
  subtitleEn: string | null;
  isExam: boolean;
  status: LessonStatus;
  /** Punti in palio per questa lezione. */
  points: number;
  /** Punti ottenuti e massimo, presenti solo a lezione conclusa. */
  score: number | null;
  maxScore: number | null;
  attemptId: string | null;
  /** Un tentativo aperto e non ancora consegnato. */
  inProgress: boolean;
};

export type CourseOverview = {
  lessons: LessonCard[];
  totalScore: number;
  totalPoints: number;
  meritTitle: string;
  examDone: boolean;
};

export async function courseOverview(userId: string): Promise<CourseOverview> {
  const [lessons, unlocks, attempts] = await Promise.all([
    prisma.lesson.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        titleIt: true,
        titleEn: true,
        subtitleIt: true,
        subtitleEn: true,
        globallyUnlocked: true,
        _count: { select: { questions: true } },
      },
    }),
    prisma.lessonUnlock.findMany({
      where: { userId },
      select: { lessonId: true },
    }),
    prisma.quizAttempt.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  const unlockedIds = new Set(unlocks.map((u) => u.lessonId));
  const latestAttempt = new Map<number, (typeof attempts)[number]>();
  for (const attempt of attempts) {
    if (!latestAttempt.has(attempt.lessonId)) {
      latestAttempt.set(attempt.lessonId, attempt);
    }
  }

  const budgets = computeBudgets(
    lessons.map((l) => ({ id: l.id, questionCount: l._count.questions })),
  );
  const budgetById = new Map(budgets.map((b) => [b.lessonId, b]));

  const cards: LessonCard[] = lessons.map((lesson) => {
    const budget = budgetById.get(lesson.id);
    const attempt = latestAttempt.get(lesson.id);
    const unlocked = lesson.globallyUnlocked || unlockedIds.has(lesson.id);
    const done = attempt && attempt.status !== AttemptStatus.IN_PROGRESS;

    let status: LessonStatus;
    if (lesson._count.questions === 0) status = "vuoto";
    else if (done) status = "fatto";
    else if (!unlocked) status = "bloccata";
    else status = "daFare";

    return {
      id: lesson.id,
      titleIt: lesson.titleIt,
      titleEn: lesson.titleEn,
      subtitleIt: lesson.subtitleIt,
      subtitleEn: lesson.subtitleEn,
      isExam: budget?.isExam ?? false,
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
    lessons: cards,
    totalScore,
    totalPoints: TOTAL_COURSE_POINTS,
    meritTitle: meritTitle(percentage(totalScore, TOTAL_COURSE_POINTS)),
    examDone: exam?.status === "fatto",
  };
}
