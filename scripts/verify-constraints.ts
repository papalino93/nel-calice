import { PrismaClient } from "@prisma/client";
import { codeLookup, encryptCode } from "../src/lib/codes";

const prisma = new PrismaClient();

function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  OK " : "FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

/** Esegue qualcosa che DEVE fallire; vero se il database l'ha respinta. */
async function rejected(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

async function main() {
  const user = await prisma.user.create({
    data: { googleId: "test-1", email: "test@example.com", name: "Prova" },
  });
  const other = await prisma.user.create({
    data: { googleId: "test-2", email: "test2@example.com", name: "Prova 2" },
  });

  const lesson = await prisma.lesson.create({
    data: { titleIt: "Bollicine", titleEn: "Bubbles" },
  });
  const lesson2 = await prisma.lesson.create({
    data: { titleIt: "Tannini", titleEn: "Tannins" },
  });

  const courseA = await prisma.course.create({
    data: {
      slug: "corso-a",
      titleIt: "Corso A",
      titleEn: "Course A",
      enrollmentCodeEncrypted: encryptCode("ALFA"),
      enrollmentCodeLookup: codeLookup("ALFA"),
    },
  });
  const courseB = await prisma.course.create({
    data: {
      slug: "corso-b",
      titleIt: "Corso B",
      titleEn: "Course B",
      enrollmentCodeEncrypted: encryptCode("BETA"),
      enrollmentCodeLookup: codeLookup("BETA"),
    },
  });

  console.log("\n— Riuso del catalogo —");
  const clA = await prisma.courseLesson.create({
    data: {
      courseId: courseA.id,
      lessonId: lesson.id,
      position: 1,
      unlockCodeEncrypted: encryptCode("ARCHETTI"),
      unlockCodeLookup: codeLookup("ARCHETTI"),
    },
  });
  const clB = await prisma.courseLesson.create({
    data: {
      courseId: courseB.id,
      lessonId: lesson.id,
      position: 3,
      unlockCodeEncrypted: encryptCode("BARRIQUE"),
      unlockCodeLookup: codeLookup("BARRIQUE"),
      isExam: true,
    },
  });
  check("la stessa lezione sta in due corsi", clA.lessonId === clB.lessonId);
  check("con numeri diversi", clA.position === 1 && clB.position === 3);

  check(
    "una lezione non può comparire due volte nello stesso corso",
    await rejected(() =>
      prisma.courseLesson.create({
        data: {
          courseId: courseA.id,
          lessonId: lesson.id,
          position: 9,
          unlockCodeEncrypted: encryptCode("X"),
      unlockCodeLookup: codeLookup("X"),
        },
      }),
    ),
  );

  check(
    "due lezioni non possono avere lo stesso numero nello stesso corso",
    await rejected(() =>
      prisma.courseLesson.create({
        data: {
          courseId: courseA.id,
          lessonId: lesson2.id,
          position: 1,
          unlockCodeEncrypted: encryptCode("Y"),
      unlockCodeLookup: codeLookup("Y"),
        },
      }),
    ),
  );

  check(
    "una lezione usata da un corso non si cancella dal catalogo",
    await rejected(() => prisma.lesson.delete({ where: { id: lesson.id } })),
  );

  console.log("\n— Unicità dei codici —");
  check(
    "due corsi non possono avere lo stesso codice d'iscrizione",
    await rejected(() =>
      prisma.course.create({
        data: {
          slug: "corso-c",
          titleIt: "Corso C",
          titleEn: "Course C",
          enrollmentCodeEncrypted: encryptCode("ALFA"),
          enrollmentCodeLookup: codeLookup("ALFA"),
        },
      }),
    ),
  );

  check(
    "due serate dello stesso corso non possono avere lo stesso codice",
    await rejected(() =>
      prisma.courseLesson.create({
        data: {
          courseId: courseA.id,
          lessonId: lesson2.id,
          position: 7,
          unlockCodeEncrypted: encryptCode("ARCHETTI"),
          unlockCodeLookup: codeLookup("ARCHETTI"),
        },
      }),
    ),
  );

  // Corsi diversi possono invece riusare lo stesso codice serata: non c'è
  // ambiguità, perché lo sblocco parte sempre da un'iscrizione a un corso.
  const riuso = await prisma.courseLesson.create({
    data: {
      courseId: courseB.id,
      lessonId: lesson2.id,
      position: 5,
      unlockCodeEncrypted: encryptCode("ARCHETTI"),
      unlockCodeLookup: codeLookup("ARCHETTI"),
    },
  });
  check("ma corsi diversi sì, senza ambiguità", !!riuso.id);

  check(
    "il codice d'iscrizione ritrova il suo corso da solo",
    (
      await prisma.course.findUnique({
        where: { enrollmentCodeLookup: codeLookup("alfa") },
        select: { slug: true },
      })
    )?.slug === "corso-a",
    "cercato in minuscolo, trovato lo stesso",
  );

  console.log("\n— Iscrizioni —");
  const enrA = await prisma.enrollment.create({
    data: { userId: user.id, courseId: courseA.id },
  });
  const enrB = await prisma.enrollment.create({
    data: { userId: user.id, courseId: courseB.id },
  });
  check("la stessa persona può iscriversi a due corsi", enrA.id !== enrB.id);

  check(
    "ma non due volte allo stesso corso",
    await rejected(() =>
      prisma.enrollment.create({
        data: { userId: user.id, courseId: courseA.id },
      }),
    ),
  );

  console.log("\n— L'invariante che conta: niente incroci fra corsi —");
  const goodAttempt = await prisma.quizAttempt.create({
    data: {
      courseId: courseA.id,
      enrollmentId: enrA.id,
      courseLessonId: clA.id,
      expiresAt: new Date(Date.now() + 900_000),
    },
  });
  check("tentativo coerente accettato", !!goodAttempt.id);

  check(
    "iscrizione del corso A + lezione del corso B → RIFIUTATO",
    await rejected(() =>
      prisma.quizAttempt.create({
        data: {
          courseId: courseA.id,
          enrollmentId: enrA.id,
          courseLessonId: clB.id, // lezione di un ALTRO corso
          expiresAt: new Date(Date.now() + 900_000),
        },
      }),
    ),
  );

  check(
    "courseId dichiarato che non combacia → RIFIUTATO",
    await rejected(() =>
      prisma.quizAttempt.create({
        data: {
          courseId: courseB.id, // dice B…
          enrollmentId: enrA.id, // …ma l'iscrizione è di A
          courseLessonId: clB.id,
          expiresAt: new Date(Date.now() + 900_000),
        },
      }),
    ),
  );

  check(
    "stesso vincolo sugli sblocchi → RIFIUTATO",
    await rejected(() =>
      prisma.lessonUnlock.create({
        data: {
          courseId: courseA.id,
          enrollmentId: enrA.id,
          courseLessonId: clB.id,
          method: "CODE",
        },
      }),
    ),
  );

  check(
    "una lezione si svolge una volta sola per iscrizione",
    await rejected(() =>
      prisma.quizAttempt.create({
        data: {
          courseId: courseA.id,
          enrollmentId: enrA.id,
          courseLessonId: clA.id,
          expiresAt: new Date(Date.now() + 900_000),
        },
      }),
    ),
  );

  console.log("\n— Dispense —");
  const m1 = await prisma.material.create({
    data: { lessonId: lesson.id, type: "PDF", titleIt: "Dispensa", url: "https://e.x/a.pdf" },
  });
  check("dispensa legata a una lezione", m1.lessonId === lesson.id);

  const m2 = await prisma.material.create({
    data: { courseId: courseA.id, type: "PDF", titleIt: "Generale", url: "https://e.x/b.pdf" },
  });
  check("dispensa generale di un corso", m2.courseId === courseA.id);

  check(
    "legata a entrambi → RIFIUTATA dal vincolo CHECK",
    await rejected(() =>
      prisma.material.create({
        data: {
          lessonId: lesson.id,
          courseId: courseA.id,
          type: "PDF",
          titleIt: "Ambigua",
          url: "https://e.x/c.pdf",
        },
      }),
    ),
  );

  check(
    "legata a nessuno dei due → RIFIUTATA dal vincolo CHECK",
    await rejected(() =>
      prisma.material.create({
        data: { type: "PDF", titleIt: "Orfana", url: "https://e.x/d.pdf" },
      }),
    ),
  );

  console.log("\n— Progressi indipendenti fra corsi —");
  const attemptB = await prisma.quizAttempt.create({
    data: {
      courseId: courseB.id,
      enrollmentId: enrB.id,
      courseLessonId: clB.id,
      expiresAt: new Date(Date.now() + 900_000),
      status: "SUBMITTED",
      score: 40,
      maxScore: 100,
    },
  });
  check(
    "la stessa lezione, seguita in due corsi, dà due percorsi separati",
    goodAttempt.id !== attemptB.id && goodAttempt.score === null,
    "corso A ancora in corso, corso B chiuso a 40/100",
  );

  console.log("\n— Cancellazione di un corso —");
  const lessonsBefore = await prisma.lesson.count();
  await prisma.course.deleteMany({
    where: { id: { in: [courseA.id, courseB.id] } },
  });

  check(
    "cancellare un corso non tocca il catalogo",
    (await prisma.lesson.count()) === lessonsBefore,
    `${lessonsBefore} lezioni prima e dopo`,
  );
  check(
    "ma porta via le sue iscrizioni e i suoi tentativi",
    (await prisma.enrollment.count({ where: { userId: user.id } })) === 0 &&
      (await prisma.quizAttempt.count({
        where: { enrollmentId: { in: [enrA.id, enrB.id] } },
      })) === 0,
  );

  // Le lezioni di prova ora sono libere: nessun corso le usa più.
  await prisma.lesson.deleteMany({
    where: { id: { in: [lesson.id, lesson2.id] } },
  });
  await prisma.user.deleteMany({ where: { id: { in: [user.id, other.id] } } });
  console.log("Dati di prova rimossi; il catalogo del seed resta intatto.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
