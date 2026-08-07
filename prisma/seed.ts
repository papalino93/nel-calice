import { PrismaClient } from "@prisma/client";
import { codeLookup, encryptCode } from "../src/lib/codes";

const prisma = new PrismaClient();

// Popola il database con un catalogo di lezioni e DUE corsi che ne pescano
// in modo diverso. Serve a non partire da un database vuoto, ma soprattutto
// a rendere evidente la struttura: le lezioni esistono una volta sola, i
// corsi decidono quali usare, in che ordine e con quali codici.
//
// Tutto è modificabile dal pannello relatore (§2.5): questi sono valori di
// partenza, non contenuti definitivi.

const catalogo = [
  {
    key: "sensi",
    titleIt: "I Sensi e la Fisiologia della Degustazione",
    titleEn: "The Senses and How Tasting Works",
    subtitleIt: "I contrasti nel calice",
    subtitleEn: "Contrasts in the glass",
  },
  {
    key: "bianchi",
    titleIt: "Bianchi, Rosati e il Legno",
    titleEn: "Whites, Rosés and Oak",
    subtitleIt: "L'evoluzione e la vinificazione",
    subtitleEn: "Ageing and winemaking",
  },
  {
    key: "rossi",
    titleIt: "I Grandi Rossi e l'Invecchiamento",
    titleEn: "Great Reds and Ageing",
    subtitleIt: "Il corpo e il tannino",
    subtitleEn: "Body and tannin",
  },
  {
    key: "bollicine",
    titleIt: "Le Bollicine e la Rifermentazione",
    titleEn: "Sparkling Wines and Refermentation",
    subtitleIt: "I metodi e il perlage",
    subtitleEn: "Methods and perlage",
  },
  {
    key: "dolci",
    titleIt: "Vini Dolci, Passiti e Liquorosi",
    titleEn: "Sweet, Raisin and Fortified Wines",
    subtitleIt: "Le dolcezze e la fortificazione",
    subtitleEn: "Sweetness and fortification",
  },
  {
    key: "esame",
    titleIt: "Il Grande Esame Finale",
    titleEn: "The Final Test",
    subtitleIt: "Food pairing e prova conclusiva",
    subtitleEn: "Food pairing and closing test",
  },
] as const;

type CatalogKey = (typeof catalogo)[number]["key"];

/** Domande d'esempio, per avere subito un quiz provabile. */
const domande: Partial<
  Record<
    CatalogKey,
    {
      textIt: string;
      textEn: string;
      options: { textIt: string; textEn: string; isCorrect: boolean }[];
    }[]
  >
> = {
  sensi: [
    {
      textIt: "L'ordine corretto dell'analisi sensoriale del vino è:",
      textEn: "The correct order of sensory analysis is:",
      options: [
        { textIt: "Visivo, olfattivo, gustativo", textEn: "Sight, smell, taste", isCorrect: true },
        { textIt: "Olfattivo, visivo, gustativo", textEn: "Smell, sight, taste", isCorrect: false },
        { textIt: "Gustativo, olfattivo, visivo", textEn: "Taste, smell, sight", isCorrect: false },
      ],
    },
    {
      textIt: "Gli «archetti» che si formano sul calice indicano soprattutto:",
      textEn: "The «legs» on the glass mainly indicate:",
      options: [
        { textIt: "Alcol e sostanze morbide", textEn: "Alcohol and glycerol", isCorrect: true },
        { textIt: "L'età del vino", textEn: "The wine's age", isCorrect: false },
        { textIt: "La quantità di solfiti", textEn: "Sulphite content", isCorrect: false },
      ],
    },
    {
      textIt: "Il tannino provoca in bocca una sensazione:",
      textEn: "Tannin produces a mouth sensation of:",
      options: [
        { textIt: "Di astringenza", textEn: "Astringency", isCorrect: true },
        { textIt: "Di dolcezza", textEn: "Sweetness", isCorrect: false },
        { textIt: "Di effervescenza", textEn: "Fizziness", isCorrect: false },
      ],
    },
    {
      textIt: "Che cosa trasforma gli zuccheri dell'uva in alcol?",
      textEn: "What turns grape sugars into alcohol?",
      options: [
        { textIt: "I lieviti", textEn: "Yeasts", isCorrect: true },
        { textIt: "Il freddo", textEn: "Cold", isCorrect: false },
        { textIt: "Il legno della botte", textEn: "The barrel wood", isCorrect: false },
      ],
    },
  ],
  bollicine: [
    {
      textIt: "Nel Metodo Classico la seconda fermentazione avviene:",
      textEn: "In the traditional method, the second fermentation happens:",
      options: [
        { textIt: "In bottiglia", textEn: "In the bottle", isCorrect: true },
        { textIt: "In autoclave", textEn: "In a pressurised tank", isCorrect: false },
        { textIt: "In botte aperta", textEn: "In an open barrel", isCorrect: false },
      ],
    },
    {
      textIt: "Il «perlage» è:",
      textEn: "«Perlage» refers to:",
      options: [
        { textIt: "L'insieme delle bollicine", textEn: "The stream of bubbles", isCorrect: true },
        { textIt: "Il colore del vino", textEn: "The wine's colour", isCorrect: false },
        { textIt: "Il deposito sul fondo", textEn: "The sediment", isCorrect: false },
      ],
    },
    {
      textIt: "Il residuo zuccherino più basso in uno spumante si chiama:",
      textEn: "The driest sparkling wine category is:",
      options: [
        { textIt: "Pas Dosé (o Dosaggio Zero)", textEn: "Pas Dosé (Zero Dosage)", isCorrect: true },
        { textIt: "Demi-Sec", textEn: "Demi-Sec", isCorrect: false },
        { textIt: "Dolce", textEn: "Doux", isCorrect: false },
      ],
    },
  ],
};

/** Le lezioni di ogni corso, con il codice della serata. */
const corsi = [
  {
    slug: "avvicinamento-2026",
    titleIt: "Corso di Avvicinamento al Vino",
    titleEn: "An Introduction to Wine",
    subtitleIt: "Un percorso lezione dopo lezione, calice dopo calice",
    subtitleEn: "Lesson by lesson, glass by glass",
    enrollmentCode: "CALICE26",
    lessons: [
      { key: "sensi", code: "ARCHETTI" },
      { key: "bianchi", code: "BARRIQUE" },
      { key: "rossi", code: "TANNINO" },
      { key: "bollicine", code: "PERLAGE" },
      { key: "dolci", code: "BOTRYTIS" },
      { key: "esame", code: "SAPIDITA", isExam: true },
    ],
  },
  {
    // Dimostra il punto: stesso catalogo, corso completamente diverso.
    slug: "solo-bollicine",
    titleIt: "Serata sulle Bollicine",
    titleEn: "A Sparkling Evening",
    subtitleIt: "Una sola serata, tutta sulle bollicine",
    subtitleEn: "One evening, all about bubbles",
    enrollmentCode: "SPUMANTE",
    lessonTimerMinutes: 10,
    lessons: [{ key: "bollicine", code: "SBOCCATURA" }],
  },
] as const;

async function main() {
  if ((await prisma.course.count()) > 0) {
    console.log("Ci sono già dei corsi: seed saltato.");
    return;
  }

  console.log("— Catalogo —");
  const lessonIdByKey = new Map<string, number>();
  for (const voce of catalogo) {
    const lesson = await prisma.lesson.create({
      data: {
        titleIt: voce.titleIt,
        titleEn: voce.titleEn,
        subtitleIt: voce.subtitleIt,
        subtitleEn: voce.subtitleEn,
      },
    });
    lessonIdByKey.set(voce.key, lesson.id);

    const suoi = domande[voce.key] ?? [];
    for (const [i, q] of suoi.entries()) {
      await prisma.question.create({
        data: {
          lessonId: lesson.id,
          textIt: q.textIt,
          textEn: q.textEn,
          position: i,
          options: { create: q.options.map((o, j) => ({ ...o, position: j })) },
        },
      });
    }
    console.log(`  ${lesson.titleIt} — ${suoi.length} domande`);
  }

  console.log("\n— Corsi —");
  for (const corso of corsi) {
    const course = await prisma.course.create({
      data: {
        slug: corso.slug,
        titleIt: corso.titleIt,
        titleEn: corso.titleEn,
        subtitleIt: corso.subtitleIt,
        subtitleEn: corso.subtitleEn,
        status: "ACTIVE",
        enrollmentCodeEncrypted: encryptCode(corso.enrollmentCode),
        enrollmentCodeLookup: codeLookup(corso.enrollmentCode),
        ...("lessonTimerMinutes" in corso
          ? { lessonTimerMinutes: corso.lessonTimerMinutes }
          : {}),
      },
    });

    for (const [i, riga] of corso.lessons.entries()) {
      await prisma.courseLesson.create({
        data: {
          courseId: course.id,
          lessonId: lessonIdByKey.get(riga.key)!,
          position: i + 1,
          unlockCodeEncrypted: encryptCode(riga.code),
          unlockCodeLookup: codeLookup(riga.code),
          isExam: "isExam" in riga ? riga.isExam : false,
        },
      });
    }

    console.log(
      `  /corso/${course.slug} — ${corso.lessons.length} lezioni · codice d'iscrizione ${corso.enrollmentCode}`,
    );
  }

  console.log(
    "\nLa lezione sulle bollicine compare in entrambi i corsi: stessa lezione,\n" +
      "numeri, codici e punteggi diversi. È il senso della separazione fra\n" +
      "catalogo e corso.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
