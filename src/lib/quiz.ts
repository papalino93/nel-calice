import { AttemptStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { computeBudgets, type LessonForScoring } from "./scoring";
import type { EnrollmentRef } from "./enrollment";
import { isLessonUnlockedFor } from "./unlock";

// Tutto ciò che decide un punteggio o una scadenza vive qui, sul server.
// Il client non manda mai punteggi (§7.4) e non conosce mai la risposta
// corretta prima della consegna (§7.3).
//
// Ogni funzione parte dall'iscrizione, mai dall'utente: è l'iscrizione a
// dire di quale corso stiamo parlando, e quindi quali lezioni sono in gioco.

/**
 * Tolleranza sulla scadenza: una risposta partita in tempo può arrivare con
 * qualche istante di ritardo su una connessione lenta (l'uso tipico è da
 * telefono in una sala, §7.16). Senza questo margine verrebbe scartata una
 * risposta legittima; con un margine così stretto non si guadagna nulla ad
 * aspettare apposta.
 */
export const ANSWER_GRACE_MS = 5_000;

// ---------------------------------------------------------------------------
// Funzioni pure — la parte che i test coprono davvero
// ---------------------------------------------------------------------------

export function attemptDeadline(startedAt: Date, minutes: number): Date {
  return new Date(startedAt.getTime() + minutes * 60_000);
}

export function isExpired(expiresAt: Date, now: Date, graceMs = 0): boolean {
  return now.getTime() > expiresAt.getTime() + graceMs;
}

export function secondsRemaining(expiresAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));
}

/** Fisher-Yates: le opzioni vanno mescolate ad ogni domanda (§3.4). */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type GradableQuestion = {
  questionId: number;
  correctOptionId: number;
  points: number;
};

export type GradedAnswer = {
  questionId: number;
  selectedOptionId: number | null;
  isCorrect: boolean;
  pointsAwarded: number;
};

export type Grade = {
  answers: GradedAnswer[];
  score: number;
  maxScore: number;
};

/**
 * Correzione: confronta le risposte salvate con quelle corrette e assegna i
 * punti. Una domanda lasciata in bianco vale zero e non è un errore (§3.5).
 */
export function grade(
  questions: GradableQuestion[],
  given: Map<number, number | null>,
): Grade {
  const answers = questions.map((q) => {
    const selectedOptionId = given.get(q.questionId) ?? null;
    const isCorrect = selectedOptionId === q.correctOptionId;
    return {
      questionId: q.questionId,
      selectedOptionId,
      isCorrect,
      pointsAwarded: isCorrect ? q.points : 0,
    };
  });

  return {
    answers,
    score: answers.reduce((sum, a) => sum + a.pointsAwarded, 0),
    maxScore: questions.reduce((sum, q) => sum + q.points, 0),
  };
}

// ---------------------------------------------------------------------------
// Forma del corso e punti delle domande
// ---------------------------------------------------------------------------

/**
 * Quante lezioni ha questo corso, quali sono d'esame e quante domande hanno.
 * È l'unico ingresso del calcolo punti: i punti dipendono dal corso, non
 * dalla lezione di catalogo (la stessa lezione può valere 8 punti in un
 * corso completo e 100 in un corso tematico).
 */
export async function loadCourseShape(
  courseId: string,
): Promise<LessonForScoring[]> {
  const lessons = await prisma.courseLesson.findMany({
    where: { courseId },
    orderBy: { position: "asc" },
    select: {
      id: true,
      isExam: true,
      lesson: { select: { _count: { select: { questions: true } } } },
    },
  });

  return lessons.map((cl) => ({
    id: cl.id,
    isExam: cl.isExam,
    questionCount: cl.lesson._count.questions,
  }));
}

/** Punti di ogni domanda di una lezione del corso, mappati per id domanda. */
export async function pointsByQuestionId(
  courseId: string,
  courseLessonId: string,
): Promise<Map<number, number>> {
  const shape = await loadCourseShape(courseId);
  const budget = computeBudgets(shape).find((b) => b.lessonId === courseLessonId);

  const courseLesson = await prisma.courseLesson.findUnique({
    where: { id: courseLessonId },
    select: { lessonId: true },
  });
  if (!courseLesson) return new Map();

  const questions = await prisma.question.findMany({
    where: { lessonId: courseLesson.lessonId },
    select: { id: true },
    orderBy: { position: "asc" },
  });

  const map = new Map<number, number>();
  questions.forEach((q, i) => {
    map.set(q.id, budget?.questionPoints[i] ?? 0);
  });
  return map;
}

// ---------------------------------------------------------------------------
// Ciclo di vita di un tentativo
// ---------------------------------------------------------------------------

export type StartOutcome =
  | { ok: true; attemptId: string; expiresAt: Date; resumed: boolean }
  | { ok: false; reason: "locked" | "not_found" | "empty" | "already_done" };

/**
 * Avvia un tentativo, o riprende quello già in corso.
 *
 * Riprendere è il punto centrale: la scadenza è scritta sul database
 * all'avvio, quindi un refresh della pagina ritrova lo stesso `expiresAt` e
 * non azzera il timer (§7.5, dove la scadenza viveva in memoria nel browser
 * e bastava ricaricare).
 */
export async function startAttempt(
  enrollment: EnrollmentRef,
  courseLessonId: string,
): Promise<StartOutcome> {
  const courseLesson = await prisma.courseLesson.findFirst({
    where: { id: courseLessonId, courseId: enrollment.courseId },
    select: {
      id: true,
      isExam: true,
      lesson: { select: { _count: { select: { questions: true } } } },
      course: {
        select: { lessonTimerMinutes: true, examTimerMinutes: true },
      },
    },
  });
  if (!courseLesson) return { ok: false, reason: "not_found" };
  if (courseLesson.lesson._count.questions === 0) {
    return { ok: false, reason: "empty" };
  }

  if (!(await isLessonUnlockedFor(enrollment, courseLessonId))) {
    return { ok: false, reason: "locked" };
  }

  const existing = await prisma.quizAttempt.findUnique({
    where: {
      enrollmentId_courseLessonId: {
        enrollmentId: enrollment.id,
        courseLessonId,
      },
    },
  });

  if (existing) {
    if (existing.status !== AttemptStatus.IN_PROGRESS) {
      return { ok: false, reason: "already_done" };
    }
    if (!isExpired(existing.expiresAt, new Date())) {
      return {
        ok: true,
        attemptId: existing.id,
        expiresAt: existing.expiresAt,
        resumed: true,
      };
    }
    // Il tempo è scaduto mentre l'utente era altrove: si chiude e si corregge
    // con quello che aveva già risposto.
    await finalizeAttempt(existing.id, enrollment, { timedOut: true });
    return { ok: false, reason: "already_done" };
  }

  // Le durate sono del corso, non globali: un corso serale da due lezioni
  // può volere tempi diversi da uno lungo.
  const minutes = courseLesson.isExam
    ? courseLesson.course.examTimerMinutes
    : courseLesson.course.lessonTimerMinutes;

  const startedAt = new Date();
  const attempt = await prisma.quizAttempt.create({
    data: {
      courseId: enrollment.courseId,
      enrollmentId: enrollment.id,
      courseLessonId,
      startedAt,
      expiresAt: attemptDeadline(startedAt, minutes),
    },
  });

  return {
    ok: true,
    attemptId: attempt.id,
    expiresAt: attempt.expiresAt,
    resumed: false,
  };
}

export type AnswerOutcome =
  | { ok: true }
  | { ok: false; reason: "not_found" | "expired" | "closed" | "bad_option" };

/**
 * Registra una risposta mentre il quiz è in corso.
 *
 * Salvare man mano — invece che tutto insieme alla consegna — è ciò che rende
 * il timer davvero applicabile: allo scadere del tempo il server ha già in
 * mano le risposte date entro il termine, e quelle inviate dopo vengono
 * semplicemente rifiutate. Non c'è finestra in cui convenga aspettare.
 */
export async function recordAnswer(
  attemptId: string,
  enrollment: EnrollmentRef,
  questionId: number,
  selectedOptionId: number | null,
): Promise<AnswerOutcome> {
  const attempt = await prisma.quizAttempt.findFirst({
    where: { id: attemptId, enrollmentId: enrollment.id },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      courseLesson: { select: { lessonId: true } },
    },
  });
  if (!attempt) return { ok: false, reason: "not_found" };
  if (attempt.status !== AttemptStatus.IN_PROGRESS) {
    return { ok: false, reason: "closed" };
  }
  if (isExpired(attempt.expiresAt, new Date(), ANSWER_GRACE_MS)) {
    return { ok: false, reason: "expired" };
  }

  // La domanda deve appartenere alla lezione del tentativo, e l'opzione a
  // quella domanda: senza questi controlli si potrebbe rispondere a una
  // domanda di un'altra lezione, o inviare l'id di un'opzione qualsiasi.
  const question = await prisma.question.findFirst({
    where: { id: questionId, lessonId: attempt.courseLesson.lessonId },
    select: { id: true },
  });
  if (!question) return { ok: false, reason: "bad_option" };

  if (selectedOptionId !== null) {
    const option = await prisma.option.findFirst({
      where: { id: selectedOptionId, questionId },
      select: { id: true },
    });
    if (!option) return { ok: false, reason: "bad_option" };
  }

  await prisma.attemptAnswer.upsert({
    where: { attemptId_questionId: { attemptId, questionId } },
    create: {
      attemptId,
      questionId,
      selectedOptionId,
      answeredAt: new Date(),
    },
    update: { selectedOptionId, answeredAt: new Date() },
  });

  return { ok: true };
}

/**
 * Chiude il tentativo e ne calcola il punteggio dalle risposte salvate.
 * È l'unico punto in cui `score` viene scritto: il client non ha mai voce
 * in capitolo.
 */
export async function finalizeAttempt(
  attemptId: string,
  enrollment: EnrollmentRef,
  opts: { timedOut?: boolean } = {},
) {
  const attempt = await prisma.quizAttempt.findFirst({
    where: { id: attemptId, enrollmentId: enrollment.id },
    include: {
      answers: true,
      courseLesson: { select: { id: true, lessonId: true } },
    },
  });
  if (!attempt) return null;
  if (attempt.status !== AttemptStatus.IN_PROGRESS) return attempt;

  const timedOut = opts.timedOut ?? isExpired(attempt.expiresAt, new Date());

  const questions = await prisma.question.findMany({
    where: { lessonId: attempt.courseLesson.lessonId },
    select: { id: true, options: { select: { id: true, isCorrect: true } } },
    orderBy: { position: "asc" },
  });
  const points = await pointsByQuestionId(
    enrollment.courseId,
    attempt.courseLesson.id,
  );

  const gradable: GradableQuestion[] = questions.map((q) => ({
    questionId: q.id,
    correctOptionId: q.options.find((o) => o.isCorrect)?.id ?? -1,
    points: points.get(q.id) ?? 0,
  }));

  const given = new Map<number, number | null>(
    attempt.answers.map((a) => [a.questionId, a.selectedOptionId]),
  );
  const result = grade(gradable, given);

  // Una sola transazione: o il tentativo si chiude con tutte le sue risposte
  // corrette e il punteggio scritto, o non cambia nulla.
  await prisma.$transaction([
    ...result.answers.map((a) =>
      prisma.attemptAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId: a.questionId } },
        create: {
          attemptId,
          questionId: a.questionId,
          selectedOptionId: a.selectedOptionId,
          isCorrect: a.isCorrect,
          pointsAwarded: a.pointsAwarded,
        },
        update: {
          isCorrect: a.isCorrect,
          pointsAwarded: a.pointsAwarded,
        },
      }),
    ),
    prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        status: timedOut ? AttemptStatus.EXPIRED : AttemptStatus.SUBMITTED,
        submittedAt: new Date(),
        score: result.score,
        maxScore: result.maxScore,
        timedOut,
      },
    }),
  ]);

  return prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: { answers: true },
  });
}

/** Abbandona il tentativo in corso (§3.4, pulsante "Esci"). */
export async function abandonAttempt(
  attemptId: string,
  enrollment: EnrollmentRef,
) {
  const { count } = await prisma.quizAttempt.deleteMany({
    where: {
      id: attemptId,
      enrollmentId: enrollment.id,
      status: AttemptStatus.IN_PROGRESS,
    },
  });
  return count > 0;
}

// ---------------------------------------------------------------------------
// Cosa vede il client
// ---------------------------------------------------------------------------

export type SafeQuestion = {
  id: number;
  textIt: string;
  textEn: string;
  /** Opzioni già mescolate. `isCorrect` non compare: il client non lo riceve. */
  options: { id: number; textIt: string; textEn: string }[];
  /** Risposta già data, per riprendere il quiz dopo un refresh. */
  selectedOptionId: number | null;
};

export type AttemptView = {
  attemptId: string;
  courseLessonId: string;
  startedAt: string;
  expiresAt: string;
  secondsRemaining: number;
  /** Durata piena del quiz, per sapere quando la barra si fa rossa. */
  totalSeconds: number;
  questions: SafeQuestion[];
};

/**
 * Payload del quiz in corso. È l'unico modo in cui le domande raggiungono il
 * browser, ed è costruito in modo che la risposta corretta non ci sia
 * proprio — non nascosta, non offuscata: assente (§7.3, dove domande e
 * risposte erano tutte nel client e il quiz era ispezionabile in anticipo).
 */
export async function attemptView(
  attemptId: string,
  enrollment: EnrollmentRef,
): Promise<AttemptView | null> {
  const attempt = await prisma.quizAttempt.findFirst({
    where: {
      id: attemptId,
      enrollmentId: enrollment.id,
      status: AttemptStatus.IN_PROGRESS,
    },
    select: {
      id: true,
      courseLessonId: true,
      startedAt: true,
      expiresAt: true,
      courseLesson: { select: { lessonId: true } },
      answers: { select: { questionId: true, selectedOptionId: true } },
    },
  });
  if (!attempt) return null;

  const questions = await prisma.question.findMany({
    where: { lessonId: attempt.courseLesson.lessonId },
    select: {
      id: true,
      textIt: true,
      textEn: true,
      options: {
        select: { id: true, textIt: true, textEn: true },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { position: "asc" },
  });

  const answered = new Map(
    attempt.answers.map((a) => [a.questionId, a.selectedOptionId]),
  );

  return {
    attemptId: attempt.id,
    courseLessonId: attempt.courseLessonId,
    startedAt: attempt.startedAt.toISOString(),
    expiresAt: attempt.expiresAt.toISOString(),
    secondsRemaining: secondsRemaining(attempt.expiresAt, new Date()),
    totalSeconds: Math.round(
      (attempt.expiresAt.getTime() - attempt.startedAt.getTime()) / 1000,
    ),
    questions: questions.map((q) => ({
      id: q.id,
      textIt: q.textIt,
      textEn: q.textEn,
      options: shuffle(q.options),
      selectedOptionId: answered.get(q.id) ?? null,
    })),
  };
}

/**
 * Revisione a quiz concluso (§3.5): qui la risposta corretta può finalmente
 * essere mostrata, perché il punteggio è già stato scritto e non è più
 * modificabile.
 */
export async function reviewView(
  attemptId: string,
  enrollment: EnrollmentRef,
) {
  const attempt = await prisma.quizAttempt.findFirst({
    where: { id: attemptId, enrollmentId: enrollment.id },
    include: {
      answers: true,
      courseLesson: { select: { id: true, lessonId: true } },
    },
  });
  if (!attempt || attempt.status === AttemptStatus.IN_PROGRESS) return null;

  const questions = await prisma.question.findMany({
    where: { lessonId: attempt.courseLesson.lessonId },
    select: {
      id: true,
      textIt: true,
      textEn: true,
      options: {
        select: { id: true, textIt: true, textEn: true, isCorrect: true },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { position: "asc" },
  });

  const byQuestion = new Map(attempt.answers.map((a) => [a.questionId, a]));

  return {
    attemptId: attempt.id,
    courseLessonId: attempt.courseLessonId,
    score: attempt.score ?? 0,
    maxScore: attempt.maxScore ?? 0,
    timedOut: attempt.timedOut,
    questions: questions.map((q) => {
      const answer = byQuestion.get(q.id);
      return {
        id: q.id,
        textIt: q.textIt,
        textEn: q.textEn,
        options: q.options,
        correctOptionId: q.options.find((o) => o.isCorrect)?.id ?? null,
        selectedOptionId: answer?.selectedOptionId ?? null,
        isCorrect: answer?.isCorrect ?? false,
        pointsAwarded: answer?.pointsAwarded ?? 0,
      };
    }),
  };
}
