// Regola centrale del corso: il punteggio totale è SEMPRE esattamente 100,
// qualunque sia il numero di lezioni o di domande (vincolo non negoziabile
// §2.4). Da qui discende tutto il resto.
//
// Niente di ciò che sta in questo file viene salvato sul database: i punti
// di una domanda sono una funzione pura di (quante lezioni ci sono, quante
// domande ha ciascuna). Salvarli significherebbe doverli ricalcolare e
// riscrivere ad ogni modifica del relatore, con il rischio che la somma
// smetta di fare 100 senza che nessuno se ne accorga.
//
// L'unica eccezione è `QuizAttempt.maxScore`, che fotografa il massimo al
// momento della consegna: i tentativi già chiusi devono restare coerenti
// con se stessi anche se il relatore aggiunge domande dopo.

export const TOTAL_COURSE_POINTS = 100;

/**
 * Riporta il punteggio di un tentativo già chiuso al budget di OGGI per
 * quella lezione, mantenendo la percentuale con cui fu consegnato.
 *
 * `QuizAttempt.score`/`maxScore` restano quello che erano alla consegna —
 * non li si tocca mai, un tentativo chiuso deve restare coerente con se
 * stesso (vedi sopra). Ma se nel frattempo il relatore ha allargato il
 * corso, il *peso* di quel tentativo nel totale dev'essere quello di oggi:
 * altrimenti le carte delle singole lezioni continuano a mostrare il budget
 * di allora, e la loro somma supera visibilmente il "Totale" mostrato
 * accanto — un'incoerenza che chiunque sommi a mente le colonne nota subito.
 *
 * Con questa funzione la somma dei punteggi rescalati non può mai superare
 * 100, per costruzione: ogni lezione pesa oggi non più del proprio budget
 * attuale, e i budget attuali sommano sempre esattamente a 100
 * (`computeBudgets`/`distributeEvenly` sono una partizione esatta).
 */
export function rescaleToCurrentBudget(
  score: number,
  maxScoreAtSubmission: number,
  currentBudget: number,
): number {
  if (maxScoreAtSubmission <= 0) return 0;
  return Math.round((score / maxScoreAtSubmission) * currentBudget);
}

/**
 * Riporta a 100 una somma di punteggi. Con `rescaleToCurrentBudget` usato
 * ovunque non dovrebbe più servire — resta come rete di sicurezza contro un
 * arrotondamento che, sommato su molte lezioni, la faccia sforare di un
 * punto o due.
 */
export function clampToCourseTotal(totalScore: number): number {
  return Math.min(totalScore, TOTAL_COURSE_POINTS);
}

/** Quota dell'esame finale quando esistono anche lezioni normali con domande. */
export const EXAM_SHARE = 60;

/** Quota divisa fra le lezioni normali quando l'esame ha domande. */
export const LESSONS_SHARE = TOTAL_COURSE_POINTS - EXAM_SHARE;

/**
 * Ripartisce un intero su `count` voci senza mai produrre decimali né
 * perdere punti per arrotondamento: le prime `total % count` voci ricevono
 * un punto in più delle altre, e la somma è esatta per costruzione.
 *
 * distributeEvenly(40, 5) → [8, 8, 8, 8, 8]
 * distributeEvenly(40, 6) → [7, 7, 7, 7, 6, 6]   (somma 40, non 39 né 42)
 */
export function distributeEvenly(total: number, count: number): number[] {
  if (count <= 0) return [];
  if (total <= 0) return new Array(count).fill(0);

  const base = Math.floor(total / count);
  const remainder = total % count;

  return Array.from({ length: count }, (_, i) =>
    i < remainder ? base + 1 : base,
  );
}

/**
 * Una lezione così come pesa dentro un corso.
 *
 * `id` è l'id della CourseLesson (la lezione *in questo corso*), non quello
 * della lezione di catalogo: gli stessi contenuti in due corsi hanno due
 * budget indipendenti.
 *
 * `isExam` è un dato esplicito, non più dedotto dall'id più alto come
 * nell'app attuale. Con un catalogo condiviso quella regola non avrebbe
 * senso, e un corso tematico può legittimamente non avere alcun esame.
 */
export type LessonForScoring = {
  id: string;
  isExam: boolean;
  questionCount: number;
};

export type LessonBudget = {
  lessonId: string;
  isExam: boolean;
  questionCount: number;
  /** Punti totali della lezione (0 se non ha domande). */
  budget: number;
  /** Punti di ciascuna domanda, in ordine di posizione. Somma = budget. */
  questionPoints: number[];
};

/**
 * Assegna a ogni lezione il suo budget di punti e ripartisce quel budget
 * fra le sue domande.
 *
 * Le lezioni **senza domande non ricevono punti**: sono le lezioni "in
 * arrivo", che il corsista non può ancora fare. Dargli comunque una quota
 * renderebbe i 100 punti irraggiungibili, rompendo la promessa fatta al
 * corsista e al relatore.
 *
 * Di conseguenza, quando l'esame non ha ancora domande i 100 punti vanno
 * tutti alle lezioni normali; e quando non ci sono lezioni normali con
 * domande, l'esame vale da solo 100.
 *
 * Un corso può anche non avere alcun esame (es. un corso tematico su una
 * sola serata): in quel caso i 100 punti si dividono fra le sue lezioni.
 */
export function computeBudgets(lessons: LessonForScoring[]): LessonBudget[] {
  const withFlags = lessons.map((lesson) => ({
    ...lesson,
    hasQuestions: lesson.questionCount > 0,
  }));

  const exam = withFlags.find((l) => l.isExam);
  const scoredNormalLessons = withFlags.filter(
    (l) => !l.isExam && l.hasQuestions,
  );

  const examHasQuestions = exam?.hasQuestions ?? false;

  let examBudget = 0;
  let normalLessonsShare = 0;

  if (examHasQuestions && scoredNormalLessons.length > 0) {
    examBudget = EXAM_SHARE;
    normalLessonsShare = LESSONS_SHARE;
  } else if (examHasQuestions) {
    // Solo l'esame ha domande: vale da solo l'intero corso.
    examBudget = TOTAL_COURSE_POINTS;
  } else {
    // L'esame non è ancora pronto: i 100 punti stanno tutti nelle lezioni.
    normalLessonsShare = TOTAL_COURSE_POINTS;
  }

  const normalBudgets = distributeEvenly(
    normalLessonsShare,
    scoredNormalLessons.length,
  );

  const budgetByLessonId = new Map<string, number>();
  scoredNormalLessons.forEach((lesson, i) => {
    budgetByLessonId.set(lesson.id, normalBudgets[i]);
  });
  if (exam) {
    budgetByLessonId.set(exam.id, examBudget);
  }

  return withFlags.map((lesson) => {
    const budget = budgetByLessonId.get(lesson.id) ?? 0;
    return {
      lessonId: lesson.id,
      isExam: lesson.isExam,
      questionCount: lesson.questionCount,
      budget,
      questionPoints: distributeEvenly(budget, lesson.questionCount),
    };
  });
}

/**
 * Verifica esplicita dell'invariante: la somma di tutti i punti assegnabili
 * è 100 (oppure 0, se il corso non ha ancora nessuna domanda).
 */
export function totalAssignablePoints(lessons: LessonForScoring[]): number {
  return computeBudgets(lessons).reduce((sum, l) => sum + l.budget, 0);
}

/**
 * Riga che il pannello relatore mostra sotto ogni lezione, es.
 * "8 domande · 8 punti (1 a domanda)". Serve a rendere sempre evidente
 * quanto vale ogni domanda (§2.4).
 *
 * `questionPoints` resta la ripartizione intera "sulla carta" (usata anche
 * altrove), ma il voto vero non la somma più domanda per domanda (vedi
 * `grade` in quiz.ts): quando ci sono più domande che punti, dire "1 o 0 a
 * domanda" farebbe credere che alcune non contino mai, il che non è più
 * vero. In quel caso il testo dice come funziona davvero.
 */
export function describeLessonScoring(budget: LessonBudget): string {
  const { questionCount, budget: points, questionPoints } = budget;

  if (questionCount === 0) return "nessuna domanda · 0 punti";

  const plural = questionCount === 1 ? "domanda" : "domande";
  const min = Math.min(...questionPoints);
  const max = Math.max(...questionPoints);

  const detail =
    min === max
      ? `${min} a domanda`
      : min === 0
        ? "proporzionali a quante ne indovini"
        : `${max} o ${min} a domanda`;

  return `${questionCount} ${plural} · ${points} punti (${detail})`;
}

// ---------------------------------------------------------------------------
// Fasce di merito — sempre in percentuale, mai in punti assoluti
// ---------------------------------------------------------------------------
//
// Restano corrette al variare del numero di lezioni e di domande, perché non
// dipendono dal massimo raggiungibile. I titoli sono volutamente informali e
// giocosi: non devono mai suggerire una qualifica professionale (§2.2).

export type MeritTitle =
  | "Palato d'Oro"
  | "Naso Fine"
  | "Bevitore Curioso"
  | "Amico del Calice";

export function percentage(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return (score / maxScore) * 100;
}

export function meritTitle(percent: number): MeritTitle {
  if (percent >= 85) return "Palato d'Oro";
  if (percent >= 70) return "Naso Fine";
  if (percent >= 50) return "Bevitore Curioso";
  return "Amico del Calice";
}

/** Riga sotto il titolo sull'attestato. Volutamente leggera. */
export function meritSubtitle(title: MeritTitle): string {
  return {
    "Palato d'Oro": "un naso e un palato davvero allenati",
    "Naso Fine": "sa riconoscere quello che c'è nel calice",
    "Bevitore Curioso": "curiosità servita, e ancora tanto da assaggiare",
    "Amico del Calice": "il bello è che si comincia sempre da qui",
  }[title];
}

/** Messaggio della schermata risultato, a fasce (§3.5). */
export function resultMessage(percent: number): string {
  if (percent >= 80) return "Notevole! Hai proprio buon naso.";
  if (percent >= 50) return "Bel risultato — il calice è più che mezzo pieno.";
  return "Si riparte dalla prossima sorsata: riguarda le dispense e riprova.";
}
