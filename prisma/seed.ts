import { PrismaClient } from "@prisma/client";
import { hashCode } from "../src/lib/codes";

const prisma = new PrismaClient();

// Struttura di partenza del corso. Titoli, codici e domande sono tutti
// modificabili dal pannello relatore (§2.5): questo seed serve solo a non
// partire da un database vuoto.
//
// I codici sono termini di degustazione non sequenziali, così chi ne conosce
// uno non indovina quello della lezione dopo (§3.8).
const lessons = [
  {
    titleIt: "Il vino e la vite",
    titleEn: "Wine and the vine",
    subtitleIt: "Da dove si comincia",
    subtitleEn: "Where it all starts",
    code: "ARCHETTI",
  },
  {
    titleIt: "L'esame visivo",
    titleEn: "Looking at wine",
    subtitleIt: "Colore, limpidezza, consistenza",
    subtitleEn: "Colour, clarity, texture",
    code: "BARRIQUE",
  },
  {
    titleIt: "L'esame olfattivo",
    titleEn: "Smelling wine",
    subtitleIt: "Riconoscere i profumi",
    subtitleEn: "Recognising aromas",
    code: "TANNINO",
  },
  {
    titleIt: "L'esame gustativo",
    titleEn: "Tasting wine",
    subtitleIt: "Dolcezza, acidità, tannino",
    subtitleEn: "Sweetness, acidity, tannin",
    code: "PERLAGE",
  },
  {
    titleIt: "Vino e cibo",
    titleEn: "Wine and food",
    subtitleIt: "Come si accompagnano",
    subtitleEn: "How they pair",
    code: "BOTRYTIS",
  },
  {
    titleIt: "Prova finale",
    titleEn: "Final test",
    subtitleIt: "Tutto quello che abbiamo assaggiato",
    subtitleEn: "Everything we tasted",
    code: "SAPIDITA",
  },
];

// Qualche domanda d'esempio sulla prima lezione, per avere subito un quiz
// funzionante da provare. Il relatore le sostituirà con le sue.
const sampleQuestions = [
  {
    textIt: "Che cos'è il mosto?",
    textEn: "What is must?",
    options: [
      { textIt: "Il succo d'uva prima della fermentazione", textEn: "Grape juice before fermentation", isCorrect: true },
      { textIt: "Il vino invecchiato in botte", textEn: "Wine aged in barrel", isCorrect: false },
      { textIt: "Il deposito sul fondo della bottiglia", textEn: "The sediment at the bottom", isCorrect: false },
      { textIt: "La buccia dell'acino", textEn: "The grape skin", isCorrect: false },
    ],
  },
  {
    textIt: "Da cosa dipende principalmente il colore di un vino rosso?",
    textEn: "What mainly gives red wine its colour?",
    options: [
      { textIt: "Dalle bucce degli acini", textEn: "The grape skins", isCorrect: true },
      { textIt: "Dalla polpa dell'uva", textEn: "The grape pulp", isCorrect: false },
      { textIt: "Dal tipo di bottiglia", textEn: "The bottle type", isCorrect: false },
      { textIt: "Dalla temperatura di servizio", textEn: "The serving temperature", isCorrect: false },
    ],
  },
  {
    textIt: "Che cosa trasforma gli zuccheri dell'uva in alcol?",
    textEn: "What turns grape sugars into alcohol?",
    options: [
      { textIt: "I lieviti", textEn: "Yeasts", isCorrect: true },
      { textIt: "Il freddo", textEn: "Cold", isCorrect: false },
      { textIt: "La luce del sole", textEn: "Sunlight", isCorrect: false },
      { textIt: "Il legno della botte", textEn: "The barrel wood", isCorrect: false },
    ],
  },
  {
    textIt: "Che cosa indica il termine «vendemmia»?",
    textEn: "What does «harvest» refer to?",
    options: [
      { textIt: "La raccolta dell'uva", textEn: "Picking the grapes", isCorrect: true },
      { textIt: "L'imbottigliamento", textEn: "Bottling", isCorrect: false },
      { textIt: "La potatura invernale", textEn: "Winter pruning", isCorrect: false },
      { textIt: "L'assaggio in cantina", textEn: "Tasting in the cellar", isCorrect: false },
    ],
  },
];

async function main() {
  if ((await prisma.lesson.count()) > 0) {
    console.log("Ci sono già lezioni: seed saltato.");
    return;
  }

  for (const lesson of lessons) {
    const created = await prisma.lesson.create({
      data: {
        titleIt: lesson.titleIt,
        titleEn: lesson.titleEn,
        subtitleIt: lesson.subtitleIt,
        subtitleEn: lesson.subtitleEn,
        unlockCodeHash: hashCode(lesson.code),
      },
    });
    console.log(`Lezione ${created.id}: ${created.titleIt}`);
  }

  const first = await prisma.lesson.findFirstOrThrow({ orderBy: { id: "asc" } });
  for (const [i, q] of sampleQuestions.entries()) {
    await prisma.question.create({
      data: {
        lessonId: first.id,
        textIt: q.textIt,
        textEn: q.textEn,
        position: i,
        options: {
          create: q.options.map((o, j) => ({ ...o, position: j })),
        },
      },
    });
  }
  console.log(`${sampleQuestions.length} domande d'esempio sulla lezione ${first.id}`);

  await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  console.log("Impostazioni timer create (15 min lezione, 45 min esame).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
