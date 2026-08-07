import { AttemptStatus, UnlockMethod } from "@prisma/client";
import { prisma } from "./prisma";
import { computeBudgets, examLessonId, type LessonForScoring } from "./scoring";
import { verifyCode } from "./codes";

// Tutto ciò che decide un punteggio o una scadenza vive qui, sul server.
// Il client non manda mai punteggi (difetto §7.4) e non conosce mai la
// risposta corretta prima della consegna (difetto §7.3).

/**
 * Tolleranza sulla scadenza: una risposta partita in tempo può arrivare con
 * qualche istante di ritardo su una connessione lenta (l'uso tipico è da
 * telefono in una sala, §7.16). Senza questo margine verrebbe scartata una
 * risposta legittima; con un margine così stretto non si guadagna nulla ad
 * aspettare apposta.
 */
export const ANSWER_GRACE_MS = 5_000;

/** Tentativi di codice sbagliato tollerati prima del blocco (§7.6). */
export const MAX_FAILED_UNLOCKS = 5;
export const UNLOCK_WINDOW_MS = 10 * 60 * 1000;

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
// Lettura dello stato del corso
// ---------------------------------------------------------------------------

export async function getSettings() {
  return prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
}

/** Forma del corso (quante lezioni, quante domande ciascuna) per i budget. */
export async function loadCourseShape(): Promise<LessonForScoring[]> {
  const lessons = await prisma.lesson.findMany({
    select: { id: true, _count: { select: { questions: true } } },
    orderBy: { id: "asc" },
  });
  return lessons.map((l) => ({ id: l.id, questionCount: l._count.questions }));
}

/**
 * Punti di ogni domanda di una lezione, mappati per id.
 * I punti dipendono dall'intero corso, non dalla singola lezione: per questo
 * si parte sempre dalla forma completa.
 */
export async function pointsByQuestionId(
  lessonId: number,
): Promise<Map<number, number>> {
  const shape = await loadCourseShape();
  const budget = computeBudgets(shape).find((b) => b.lessonId === lessonId);

  const questions = await prisma.question.findMany({
    where: { lessonId },
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
// Sblocco — un'unica fonte di verità, sempre sul server
// ---------------------------------------------------------------------------

export async function isLessonUnlockedFor(
  userId: string,
  lessonId: number,
): Promise<boolean> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { globallyUnlocked: true },
  });
  if (!lesson) return false;
  if (lesson.globallyUnlocked) return true;

  const unlock = await prisma.lessonUnlock.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
    select: { id: true },
  });
  return unlock !== null;
}

export type UnlockOutcome =
  | { ok: true; alreadyUnlocked: boolean }
  | { ok: false; reason: "not_found" | "wrong_code" | "rate_limited" };

/**
 * Verifica il codice sul server e registra lo sblocco. Il codice in chiaro
 * non viene mai restituito, nemmeno al relatore: esiste solo l'hash.
 */
export async function unlockWithCode(
  userId: string,
  lessonId: number,
  code: string,
): Promise<UnlockOutcome> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { unlockCodeHash: true },
  });
  if (!lesson) return { ok: false, reason: "not_found" };

  if (await isLessonUnlockedFor(userId, lessonId)) {
    return { ok: true, alreadyUnlocked: true };
  }

  const recentFailures = await prisma.unlockAttempt.count({
    where: {
      userId,
      lessonId,
      succeeded: false,
      createdAt: { gte: new Date(Date.now() - UNLOCK_WINDOW_MS) },
    },
  });
  if (recentFailures >= MAX_FAILED_UNLOCKS) {
    return { ok: false, reason: "rate_limited" };
  }

  const succeeded = verifyCode(code, lesson.unlockCodeHash);
  await prisma.unlockAttempt.create({
    data: { userId, lessonId, succeeded },
  });

  if (!succeeded) return { ok: false, reason: "wrong_code" };

  await prisma.lessonUnlock.create({
    data: { userId, lessonId, method: UnlockMethod.CODE },
  });
  return { ok: true, alreadyUnlocked: false };
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
 * non azzera il timer (difetto §7.5, dove la scadenza viveva in memoria nel
 * browser e bastava ricaricare).
 */
export async function startAttempt(
  userId: string,
  lessonId: number,
): Promise<StartOutcome> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, _count: { select: { questions: true } } },
  });
  if (!lesson) return { ok: false, reason: "not_found" };
  if (lesson._count.questions === 0) return { ok: false, reason: "empty" };

  if (!(await isLessonUnlockedFor(userId, lessonId))) {
    return { ok: false, reason: "locked" };
  }

  const existing = await prisma.quizAttempt.findFirst({
    where: { userId, lessonId },
    orderBy: { startedAt: "desc" },
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
    await finalizeAttempt(existing.id, userId, { timedOut: true });
    return { ok: false, reason: "already_done" };
  }

  const settings = await getSettings();
  const shape = await loadCourseShape();
  const isExam = examLessonId(shape) === lessonId;
  const minutes = isExam
    ? settings.examTimerMinutes
    : settings.lessonTimerMinutes;

  const startedAt = new Date();
  const attempt = await prisma.quizAttempt.create({
    data: {
      userId,
      lessonId,
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
  userId: string,
  questionId: number,
  selectedOptionId: number | null,
): Promise<AnswerOutcome> {
  const attempt = await prisma.quizAttempt.findFirst({
    where: { id: attemptId, userId },
    select: { id: true, lessonId: true, status: true, expiresAt: true },
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
    where: { id: questionId, lessonId: attempt.lessonId },
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
 * Chiude il tentativo e ne calcola il punteggio a partire dalle risposte
 * salvate. È l'unico punto in cui `score` viene scritto: il client non ha mai
 * voce in capitolo.
 */
export async function finalizeAttempt(
  attemptId: string,
  userId: string,
  opts: { timedOut?: boolean } = {},
) {
  const attempt = await prisma.quizAttempt.findFirst({
    where: { id: attemptId, userId },
    include: { answers: true },
  });
  if (!attempt) return null;
  if (attempt.status !== AttemptStatus.IN_PROGRESS) return attempt;

  const timedOut = opts.timedOut ?? isExpired(attempt.expiresAt, new Date());

  const questions = await prisma.question.findMany({
    where: { lessonId: attempt.lessonId },
    select: { id: true, options: { select: { id: true, isCorrect: true } } },
    orderBy: { position: "asc" },
  });
  const points = await pointsByQuestionId(attempt.lessonId);

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
  lessonId: number;
  startedAt: string;
  expiresAt: string;
  secondsRemaining: number;
  /** Durata piena del quiz: serve alla barra del timer per sapere a che
      punto colorarsi di rosso, anche riprendendo a metà. */
  totalSeconds: number;
  questions: SafeQuestion[];
};

/**
 * Payload del quiz in corso. È l'unico modo in cui le domande raggiungono il
 * browser, ed è costruito in modo che la risposta corretta non ci sia
 * proprio — non nascosta, non offuscata: assente (difetto §7.3, dove domande
 * e risposte erano tutte nel client e il quiz era ispezionabile in anticipo).
 */
export async function attemptView(
  attemptId: string,
  userId: string,
): Promise<AttemptView | null> {
  const attempt = await prisma.quizAttempt.findFirst({
    where: { id: attemptId, userId, status: AttemptStatus.IN_PROGRESS },
    select: {
      id: true,
      lessonId: true,
      startedAt: true,
      expiresAt: true,
      answers: { select: { questionId: true, selectedOptionId: true } },
    },
  });
  if (!attempt) return null;

  const questions = await prisma.question.findMany({
    where: { lessonId: attempt.lessonId },
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
    lessonId: attempt.lessonId,
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
export async function reviewView(attemptId: string, userId: string) {
  const attempt = await prisma.quizAttempt.findFirst({
    where: { id: attemptId, userId },
    include: { answers: true },
  });
  if (!attempt || attempt.status === AttemptStatus.IN_PROGRESS) return null;

  const questions = await prisma.question.findMany({
    where: { lessonId: attempt.lessonId },
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
    lessonId: attempt.lessonId,
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

/** Abbandona il tentativo in corso (§3.4, pulsante "Esci"). */
export async function abandonAttempt(attemptId: string, userId: string) {
  const { count } = await prisma.quizAttempt.deleteMany({
    where: { id: attemptId, userId, status: AttemptStatus.IN_PROGRESS },
  });
  return count > 0;
}
