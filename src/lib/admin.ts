import { AttemptStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { codeLookup, decryptCode, encryptCode, normalizeCode } from "./codes";
import { clampToCourseTotal, computeBudgets, describeLessonScoring } from "./scoring";

// Operazioni del relatore. Sono qui e non nelle route per un motivo preciso:
// ognuna deve essere chiamata solo dopo `requireAdmin()`, e tenerle insieme
// rende evidente che formano un unico blocco protetto.
//
// È l'unico posto dell'applicazione dove i codici vengono decifrati.

export type AdminCourseDetail = {
  slug: string;
  titleIt: string;
  titleEn: string;
  subtitleIt: string | null;
  subtitleEn: string | null;
  status: string;
  enrollmentOpen: boolean;
  /** In chiaro: il relatore deve dirlo a voce. Solo per lui. */
  enrollmentCode: string | null;
  lessonTimerMinutes: number;
  examTimerMinutes: number;
  enrolledCount: number;
  lessons: {
    courseLessonId: string;
    lessonId: number;
    position: number;
    titleIt: string;
    titleEn: string;
    isExam: boolean;
    globallyUnlocked: boolean;
    unlockCode: string | null;
    questionCount: number;
    /** "8 domande · 8 punti (1 a domanda)" — §2.4, sempre esplicito. */
    scoring: string;
  }[];
};

export async function courseDetail(
  slug: string,
): Promise<AdminCourseDetail | null> {
  const course = await prisma.course.findUnique({
    where: { slug },
    select: {
      slug: true,
      titleIt: true,
      titleEn: true,
      subtitleIt: true,
      subtitleEn: true,
      status: true,
      enrollmentOpen: true,
      enrollmentCodeEncrypted: true,
      lessonTimerMinutes: true,
      examTimerMinutes: true,
      _count: { select: { enrollments: true } },
      lessons: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          lessonId: true,
          position: true,
          isExam: true,
          globallyUnlocked: true,
          unlockCodeEncrypted: true,
          lesson: {
            select: {
              titleIt: true,
              titleEn: true,
              _count: { select: { questions: true } },
            },
          },
        },
      },
    },
  });
  if (!course) return null;

  const budgets = computeBudgets(
    course.lessons.map((cl) => ({
      id: cl.id,
      isExam: cl.isExam,
      questionCount: cl.lesson._count.questions,
    })),
  );
  const budgetById = new Map(budgets.map((b) => [b.lessonId, b]));

  return {
    slug: course.slug,
    titleIt: course.titleIt,
    titleEn: course.titleEn,
    subtitleIt: course.subtitleIt,
    subtitleEn: course.subtitleEn,
    status: course.status,
    enrollmentOpen: course.enrollmentOpen,
    enrollmentCode: decryptCode(course.enrollmentCodeEncrypted),
    lessonTimerMinutes: course.lessonTimerMinutes,
    examTimerMinutes: course.examTimerMinutes,
    enrolledCount: course._count.enrollments,
    lessons: course.lessons.map((cl) => {
      const budget = budgetById.get(cl.id);
      return {
        courseLessonId: cl.id,
        lessonId: cl.lessonId,
        position: cl.position,
        titleIt: cl.lesson.titleIt,
        titleEn: cl.lesson.titleEn,
        isExam: cl.isExam,
        globallyUnlocked: cl.globallyUnlocked,
        unlockCode: decryptCode(cl.unlockCodeEncrypted),
        questionCount: cl.lesson._count.questions,
        scoring: budget ? describeLessonScoring(budget) : "",
      };
    }),
  };
}

/**
 * Il corso e il primo numero di serata libero.
 * Il numero è il primo libero: aggiungere in fondo non tocca le altre.
 */
async function courseWithNextPosition(slug: string) {
  const course = await prisma.course.findUnique({
    where: { slug },
    select: { id: true, lessons: { select: { position: true } } },
  });
  if (!course) return null;

  return {
    id: course.id,
    nextPosition:
      course.lessons.reduce((max, l) => Math.max(max, l.position), 0) + 1,
  };
}

/** Aggiunge una lezione del catalogo a un corso. */
export async function addLessonToCourse(
  slug: string,
  lessonId: number,
  code: string,
) {
  const course = await courseWithNextPosition(slug);
  if (!course) return null;

  return prisma.courseLesson.create({
    data: {
      courseId: course.id,
      lessonId,
      position: course.nextPosition,
      unlockCodeEncrypted: encryptCode(code),
      unlockCodeLookup: codeLookup(code),
    },
  });
}

/**
 * Scrive una lezione nuova e la mette subito in questo corso, senza passare
 * dal catalogo: è il gesto che il relatore fa più spesso, e farlo in due
 * schermate diverse costringeva a uscire e rientrare.
 *
 * La lezione nasce comunque nel catalogo — non è una lezione "privata" del
 * corso — e resta quindi riusabile da un'altra edizione, con le sue domande
 * e le sue dispense.
 *
 * Le due scritture stanno in una transazione perché un codice già usato
 * nella stessa edizione non lasci in catalogo una lezione che nessuno ha
 * chiesto: o entrambe, o nessuna.
 */
export async function createLessonInCourse(
  slug: string,
  input: { titleIt: string; titleEn: string },
  code: string,
) {
  const course = await courseWithNextPosition(slug);
  if (!course) return null;

  return prisma.$transaction(async (tx) => {
    const lesson = await tx.lesson.create({ data: input });

    await tx.courseLesson.create({
      data: {
        courseId: course.id,
        lessonId: lesson.id,
        position: course.nextPosition,
        unlockCodeEncrypted: encryptCode(code),
        unlockCodeLookup: codeLookup(code),
      },
    });

    return lesson;
  });
}

/**
 * Toglie una lezione da un corso. Non la cancella dal catalogo: resta
 * disponibile per gli altri corsi, con le sue domande e le sue dispense.
 *
 * I numeri delle lezioni rimaste NON scorrono: togliere la 4 fa sparire il
 * numero 4, e la 5 resta la 5. È la stessa garanzia chiesta al §3.7b, qui
 * applicata al corso invece che al catalogo.
 */
export async function removeLessonFromCourse(courseLessonId: string) {
  return prisma.courseLesson.delete({ where: { id: courseLessonId } });
}

export type CourseLessonPatch = {
  unlockCode?: string;
  globallyUnlocked?: boolean;
  isExam?: boolean;
  position?: number;
};

export async function updateCourseLesson(
  courseLessonId: string,
  patch: CourseLessonPatch,
) {
  const current = await prisma.courseLesson.findUnique({
    where: { id: courseLessonId },
    select: { courseId: true },
  });
  if (!current) return null;

  // Un corso ha al più una prova finale: promuoverne una retrocede l'altra.
  if (patch.isExam === true) {
    await prisma.courseLesson.updateMany({
      where: { courseId: current.courseId, isExam: true },
      data: { isExam: false },
    });
  }

  return prisma.courseLesson.update({
    where: { id: courseLessonId },
    data: {
      ...(patch.unlockCode !== undefined
        ? {
            unlockCodeEncrypted: encryptCode(patch.unlockCode),
            unlockCodeLookup: codeLookup(patch.unlockCode),
          }
        : {}),
      ...(patch.globallyUnlocked !== undefined
        ? { globallyUnlocked: patch.globallyUnlocked }
        : {}),
      ...(patch.isExam !== undefined ? { isExam: patch.isExam } : {}),
      ...(patch.position !== undefined ? { position: patch.position } : {}),
    },
  });
}

export type CoursePatch = {
  titleIt?: string;
  titleEn?: string;
  subtitleIt?: string | null;
  subtitleEn?: string | null;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  enrollmentOpen?: boolean;
  enrollmentCode?: string;
  lessonTimerMinutes?: number;
  examTimerMinutes?: number;
};

function slugify(titleIt: string): string {
  return (
    titleIt
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // toglie gli accenti (NFD li isola)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "corso"
  );
}

/**
 * Crea un corso nuovo, vuoto: nessuna lezione ancora dentro, si aggiungono
 * dal pannello del corso appena creato — dal catalogo o scrivendole sul
 * posto, come già si fa per le singole serate.
 *
 * Lo slug è derivato dal titolo e reso unico da soli, perché il relatore non
 * deve inventarsi un indirizzo: se «Corso di Avvicinamento al Vino» esiste
 * già, la seconda edizione diventa `corso-di-avvicinamento-al-vino-2`.
 */
export async function createCourse(input: {
  titleIt: string;
  titleEn?: string;
  enrollmentCode: string;
}) {
  const base = slugify(input.titleIt);
  let slug = base;
  for (let n = 2; await prisma.course.findUnique({ where: { slug } }); n++) {
    slug = `${base}-${n}`;
  }

  return prisma.course.create({
    data: {
      slug,
      titleIt: input.titleIt,
      titleEn: input.titleEn?.trim() || input.titleIt,
      status: "DRAFT",
      enrollmentCodeEncrypted: encryptCode(input.enrollmentCode),
      enrollmentCodeLookup: codeLookup(input.enrollmentCode),
    },
  });
}

export async function updateCourse(slug: string, patch: CoursePatch) {
  return prisma.course.update({
    where: { slug },
    data: {
      ...(patch.titleIt !== undefined ? { titleIt: patch.titleIt } : {}),
      ...(patch.titleEn !== undefined ? { titleEn: patch.titleEn } : {}),
      ...(patch.subtitleIt !== undefined
        ? { subtitleIt: patch.subtitleIt }
        : {}),
      ...(patch.subtitleEn !== undefined
        ? { subtitleEn: patch.subtitleEn }
        : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.enrollmentOpen !== undefined
        ? { enrollmentOpen: patch.enrollmentOpen }
        : {}),
      ...(patch.enrollmentCode !== undefined
        ? {
            enrollmentCodeEncrypted: encryptCode(patch.enrollmentCode),
            enrollmentCodeLookup: codeLookup(patch.enrollmentCode),
          }
        : {}),
      ...(patch.lessonTimerMinutes !== undefined
        ? { lessonTimerMinutes: Math.max(1, patch.lessonTimerMinutes) }
        : {}),
      ...(patch.examTimerMinutes !== undefined
        ? { examTimerMinutes: Math.max(1, patch.examTimerMinutes) }
        : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// Catalogo
// ---------------------------------------------------------------------------

export async function catalogue() {
  const lessons = await prisma.lesson.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      titleIt: true,
      titleEn: true,
      subtitleIt: true,
      subtitleEn: true,
      _count: { select: { questions: true, usedIn: true, materials: true } },
    },
  });

  return lessons.map((l) => ({
    id: l.id,
    titleIt: l.titleIt,
    titleEn: l.titleEn,
    subtitleIt: l.subtitleIt,
    subtitleEn: l.subtitleEn,
    questionCount: l._count.questions,
    materialCount: l._count.materials,
    /** In quanti corsi è usata: se >0 non è cancellabile. */
    usedInCourses: l._count.usedIn,
  }));
}

export async function lessonWithQuestions(lessonId: number) {
  return prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      titleIt: true,
      titleEn: true,
      subtitleIt: true,
      subtitleEn: true,
      notes: true,
      questions: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          textIt: true,
          textEn: true,
          position: true,
          options: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              textIt: true,
              textEn: true,
              position: true,
              isCorrect: true,
            },
          },
        },
      },
    },
  });
}

export type QuestionInput = {
  textIt: string;
  textEn: string;
  options: { textIt: string; textEn: string; isCorrect: boolean }[];
};

/**
 * Salva una domanda con le sue opzioni, sostituendole in blocco.
 *
 * Sostituire invece di aggiornare pezzo per pezzo evita di dover
 * riconciliare opzioni aggiunte, tolte e riordinate — e le opzioni non hanno
 * una vita propria da preservare. Le risposte già date puntano all'opzione
 * per id, quindi la sostituzione è ammessa solo finché la domanda non è mai
 * stata usata in un tentativo: il controllo è nel chiamante.
 */
export async function saveQuestion(
  lessonId: number,
  questionId: number | null,
  input: QuestionInput,
) {
  // Esattamente una risposta corretta: nessun vincolo SQL sa esprimerlo,
  // quindi è qui che va garantito. Senza, una domanda potrebbe risultare
  // impossibile da azzeccare — o averne due giuste.
  const correctCount = input.options.filter((o) => o.isCorrect).length;
  if (input.options.length < 2 || correctCount !== 1) {
    return { ok: false as const, reason: "invalid" as const };
  }

  if (questionId === null) {
    const last = await prisma.question.findFirst({
      where: { lessonId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const created = await prisma.question.create({
      data: {
        lessonId,
        textIt: input.textIt,
        textEn: input.textEn,
        position: (last?.position ?? -1) + 1,
        options: {
          create: input.options.map((o, i) => ({ ...o, position: i })),
        },
      },
    });
    return { ok: true as const, questionId: created.id };
  }

  await prisma.$transaction([
    prisma.option.deleteMany({ where: { questionId } }),
    prisma.question.update({
      where: { id: questionId },
      data: {
        textIt: input.textIt,
        textEn: input.textEn,
        options: {
          create: input.options.map((o, i) => ({ ...o, position: i })),
        },
      },
    }),
  ]);
  return { ok: true as const, questionId };
}

/** Vero se qualcuno ha già risposto a questa domanda in un tentativo. */
export async function questionHasAnswers(questionId: number) {
  return (
    (await prisma.attemptAnswer.count({ where: { questionId } })) > 0
  );
}

export async function deleteQuestion(questionId: number) {
  return prisma.question.delete({ where: { id: questionId } });
}

export async function createLesson(input: {
  titleIt: string;
  titleEn: string;
  subtitleIt?: string | null;
  subtitleEn?: string | null;
}) {
  return prisma.lesson.create({ data: input });
}

export async function updateLesson(
  lessonId: number,
  input: {
    titleIt?: string;
    titleEn?: string;
    subtitleIt?: string | null;
    subtitleEn?: string | null;
    notes?: string | null;
  },
) {
  return prisma.lesson.update({ where: { id: lessonId }, data: input });
}

// ---------------------------------------------------------------------------
// Andamento della classe (§7.18 — informazione che i dati già contengono)
// ---------------------------------------------------------------------------

export type ClassOverview = {
  totalPoints: number;
  students: {
    enrollmentId: string;
    name: string;
    email: string;
    enrolledAt: string;
    totalScore: number;
    doneCount: number;
    /**
     * Per lezione, indicizzato per courseLessonId. `null` significa che non
     * esiste alcun tentativo — non c'è niente da azzerare. Un tentativo
     * aperto (`inProgress: true`, senza punteggio) è quello che nasce da un
     * click su "inizia" per sbaglio: senza questo campo restava indistinguibile
     * da "non ancora iniziato", e il relatore non aveva modo di accorgersene.
     */
    byLesson: Record<
      string,
      | { inProgress: true; score: null; maxScore: null }
      | { inProgress: false; score: number; maxScore: number }
      | null
    >;
  }[];
  lessons: {
    courseLessonId: string;
    position: number;
    titleIt: string;
    isExam: boolean;
  }[];
  /**
   * Percentuale di risposte corrette per domanda, sull'intera classe.
   * È il dato che dice al relatore quali argomenti non sono passati.
   */
  questions: {
    questionId: number;
    courseLessonId: string;
    textIt: string;
    answered: number;
    correct: number;
    correctRate: number;
  }[];
};

export async function classOverview(
  slug: string,
): Promise<ClassOverview | null> {
  const course = await prisma.course.findUnique({
    where: { slug },
    select: {
      id: true,
      lessons: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          position: true,
          isExam: true,
          lessonId: true,
          lesson: { select: { titleIt: true } },
        },
      },
      enrollments: {
        orderBy: { enrolledAt: "asc" },
        select: {
          id: true,
          enrolledAt: true,
          user: { select: { name: true, email: true } },
          attempts: {
            select: {
              courseLessonId: true,
              status: true,
              score: true,
              maxScore: true,
            },
          },
        },
      },
    },
  });
  if (!course) return null;

  const students = course.enrollments.map((e) => {
    const byLesson: ClassOverview["students"][number]["byLesson"] = {};
    let totalScore = 0;
    let doneCount = 0;

    for (const cl of course.lessons) {
      const attempt = e.attempts.find((a) => a.courseLessonId === cl.id);
      if (!attempt) {
        byLesson[cl.id] = null;
      } else if (attempt.status === AttemptStatus.IN_PROGRESS) {
        byLesson[cl.id] = { inProgress: true, score: null, maxScore: null };
      } else {
        byLesson[cl.id] = {
          inProgress: false,
          score: attempt.score ?? 0,
          maxScore: attempt.maxScore ?? 0,
        };
        totalScore += attempt.score ?? 0;
        doneCount += 1;
      }
    }

    return {
      enrollmentId: e.id,
      name: e.user.name,
      email: e.user.email,
      enrolledAt: e.enrolledAt.toISOString(),
      // Stessa cautela di courseOverview: un corso allargato dopo che
      // qualcuno ha già finito può sommare oltre il massimo attuale.
      totalScore: clampToCourseTotal(totalScore),
      doneCount,
      byLesson,
    };
  });

  // Medie per domanda: si contano solo le risposte di tentativi conclusi.
  const answers = await prisma.attemptAnswer.findMany({
    where: {
      attempt: {
        courseId: course.id,
        status: { not: AttemptStatus.IN_PROGRESS },
      },
    },
    select: {
      questionId: true,
      isCorrect: true,
      attempt: { select: { courseLessonId: true } },
      question: { select: { textIt: true } },
    },
  });

  const stats = new Map<
    number,
    { courseLessonId: string; textIt: string; answered: number; correct: number }
  >();
  for (const a of answers) {
    const entry = stats.get(a.questionId) ?? {
      courseLessonId: a.attempt.courseLessonId,
      textIt: a.question.textIt,
      answered: 0,
      correct: 0,
    };
    entry.answered += 1;
    if (a.isCorrect) entry.correct += 1;
    stats.set(a.questionId, entry);
  }

  return {
    totalPoints: 100,
    students,
    lessons: course.lessons.map((cl) => ({
      courseLessonId: cl.id,
      position: cl.position,
      titleIt: cl.lesson.titleIt,
      isExam: cl.isExam,
    })),
    questions: [...stats.entries()]
      .map(([questionId, s]) => ({
        questionId,
        courseLessonId: s.courseLessonId,
        textIt: s.textIt,
        answered: s.answered,
        correct: s.correct,
        correctRate: s.answered > 0 ? (s.correct / s.answered) * 100 : 0,
      }))
      // Le domande andate peggio in cima: sono quelle su cui tornare.
      .sort((a, b) => a.correctRate - b.correctRate),
  };
}

/**
 * Azzera il tentativo di un corsista su una lezione, così può rifarlo.
 *
 * Il corsista non ha modo di farlo da solo — il vincolo che impedisce due
 * tentativi sulla stessa lezione (§3.4) è voluto e resta per lui — ma
 * capitano casi in cui serve il relatore: un click su "inizia" per sbaglio,
 * un tentativo partito e mai davvero svolto. È lui a decidere quando vale la
 * pena, non l'app da sola.
 *
 * Cancella solo il tentativo: lo sblocco della serata resta quello che era,
 * così il corsista può ripartire senza dover richiedere anche quello.
 *
 * `courseId` nel filtro non è ridondante: senza, un `enrollmentId` o un
 * `courseLessonId` scambiato per errore azzererebbe il tentativo sbagliato
 * in tutt'altro corso.
 */
export async function resetAttempt(
  slug: string,
  enrollmentId: string,
  courseLessonId: string,
): Promise<boolean> {
  const course = await prisma.course.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!course) return false;

  const { count } = await prisma.quizAttempt.deleteMany({
    where: { courseId: course.id, enrollmentId, courseLessonId },
  });
  return count > 0;
}

/** Sblocco o riblocco immediato di una lezione per tutti gli iscritti. */
export async function setGlobalUnlock(
  courseLessonId: string,
  unlocked: boolean,
) {
  return prisma.courseLesson.update({
    where: { id: courseLessonId },
    data: { globallyUnlocked: unlocked },
  });
}

export { normalizeCode };
