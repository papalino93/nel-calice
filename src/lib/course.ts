import { AttemptStatus } from "@prisma/client";
import { prisma } from "./prisma";
import {
  TOTAL_COURSE_POINTS,
  clampToCourseTotal,
  computeBudgets,
  meritTitle,
  percentage,
  rescaleToCurrentBudget,
} from "./scoring";
import { finalizeAttempt } from "./quiz";
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
  /**
   * Se la serata è aperta per questo corsista.
   *
   * Sta accanto a `status` e non dentro, perché lo stato risponde alla
   * domanda «cosa vede» e questo alla domanda «cosa può leggere», e le due
   * non coincidono: una lezione ancora senza domande è "vuoto" pur restando
   * chiusa. Chi decide un permesso guardi questo campo, mai lo stato.
   */
  unlocked: boolean;
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
    location: string | null;
    certificateIssuer: string | null;
    /** Solo l'indirizzo interno (o il testo): il byte del logo si legge solo
        se serve davvero costruire un attestato, non a ogni apertura del
        corso (`certificateFor` lo legge a parte, con una query sua). */
    logos: {
      url: string | null;
      text: string | null;
      size: "SMALL" | "MEDIUM" | "LARGE";
    }[];
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
      location: true,
      certificateIssuer: true,
      logos: {
        select: { url: true, text: true, size: true },
        orderBy: { createdAt: "asc" },
      },
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

  // Un tentativo "in corso" ma con l'orario ormai passato non si chiude da
  // sé: prima di questa lettura, nessuno lo aveva ancora toccato, e la
  // dashboard continuava a proporre "Riprendi" su un quiz che, cliccato,
  // sarebbe risultato già scaduto — sorpresa spiacevole. Aprire il corso è
  // già di per sé "toccarlo": lo si chiude qui, con lo stesso conteggio che
  // userebbe la consegna vera, prima ancora di costruire le card.
  const now = new Date();
  type AttemptSummary = {
    id: string;
    status: AttemptStatus;
    score: number | null;
    maxScore: number | null;
  };
  const attemptByLesson = new Map<string, AttemptSummary>();
  for (const a of attempts) {
    if (a.status === AttemptStatus.IN_PROGRESS && a.expiresAt < now) {
      const finalized = await finalizeAttempt(a.id, enrollment, { timedOut: true });
      const source = finalized ?? a;
      attemptByLesson.set(a.courseLessonId, {
        id: source.id,
        status: source.status,
        score: source.score,
        maxScore: source.maxScore,
      });
    } else {
      attemptByLesson.set(a.courseLessonId, {
        id: a.id,
        status: a.status,
        score: a.score,
        maxScore: a.maxScore,
      });
    }
  }

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
      unlocked,
      points: budget?.budget ?? 0,
      // Il punteggio mostrato qui è quello di OGGI, non quello congelato
      // alla consegna: se il corso è cresciuto nel frattempo, il budget di
      // questa lezione può essere cambiato, e mostrare il numero di allora
      // farebbe sommare le carte a più del "Totale" accanto.
      score: done
        ? rescaleToCurrentBudget(
            attempt.score ?? 0,
            attempt.maxScore ?? 0,
            budget?.budget ?? 0,
          )
        : null,
      maxScore: done ? (budget?.budget ?? 0) : null,
      attemptId: attempt?.id ?? null,
      inProgress: attempt?.status === AttemptStatus.IN_PROGRESS,
    };
  });

  // Ogni card è già rescalata al budget di oggi, quindi la somma non
  // dovrebbe mai superare 100: il clamp resta solo come rete contro un
  // arrotondamento indipendente per lezione che, sommato su molte lezioni,
  // la faccia sforare di un punto.
  const totalScore = clampToCourseTotal(
    cards.reduce((sum, c) => sum + (c.score ?? 0), 0),
  );
  const exam = cards.find((c) => c.isExam);

  return {
    course: {
      slug: course.slug,
      titleIt: course.titleIt,
      titleEn: course.titleEn,
      subtitleIt: course.subtitleIt,
      subtitleEn: course.subtitleEn,
      location: course.location,
      certificateIssuer: course.certificateIssuer,
    logos: course.logos.map((l) => ({
      url: l.url,
      text: l.text,
      size: l.size as "SMALL" | "MEDIUM" | "LARGE",
    })),
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
