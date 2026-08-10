import { saveQuestion, type QuestionInput } from "../src/lib/admin";
import { prisma } from "../src/lib/prisma";

// Importa in blocco domande nel catalogo, passando dalla stessa funzione
// validata usata dal pannello relatore (`saveQuestion`): stessa garanzia di
// "esattamente una risposta corretta", stessa numerazione automatica delle
// posizioni. Non scrive SQL a mano e non duplica quella logica.
//
// Uso: tsx scripts/import-questions.ts scripts/data/<file>.json
//
// Il file JSON è un array di { lessonId, questions: QuestionInput[] }.
// Serve PRISMA_NEON_HTTP=1 quando lanciato da una rete che non raggiunge
// Postgres in TCP diretto (vedi src/lib/prisma.ts).

type LessonImport = {
  lessonId: number;
  questions: QuestionInput[];
};

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Uso: tsx scripts/import-questions.ts <file.json>");
    process.exit(1);
  }

  const data: LessonImport[] = JSON.parse(
    await (await import("node:fs/promises")).readFile(path, "utf8"),
  );

  for (const { lessonId, questions } of data) {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { titleIt: true },
    });
    if (!lesson) {
      console.error(`Lezione ${lessonId} inesistente, salto.`);
      continue;
    }

    let created = 0;
    for (const q of questions) {
      const result = await saveQuestion(lessonId, null, q);
      if (result.ok) created++;
      else console.error(`  domanda scartata (${result.reason}): ${q.textIt}`);
    }
    console.log(`${lesson.titleIt}: +${created} domande`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
