import { prisma } from "./prisma";

// Le dispense stanno in uno store Vercel Blob **privato**: il loro indirizzo
// reale non è raggiungibile da nessuno, nemmeno conoscendolo.
//
// I file non vengono serviti con link firmati a scadenza, ma da una route
// dell'app che autentica e poi li trasmette. La differenza conta: con un
// link firmato il controllo avviene una volta sola, al momento di emetterlo,
// e per tutta la durata del link chiunque lo abbia può scaricarlo. Passando
// dalla route, **ogni singola lettura** ripassa dal controllo — e un
// indirizzo copiato e girato non serve a nulla senza la sessione di chi ha
// diritto a vederlo.
//
// È così che la regola "le dispense di una lezione ereditano il suo blocco"
// (§3.7d) diventa vera e non solo apparente.
//
// I video non stanno nello store: sono link esterni (YouTube, Vimeo) e
// restano tali.

/** true se l'indirizzo punta al nostro store e non a un video esterno. */
export function isStoredFile(url: string): boolean {
  return url.startsWith("blob:");
}

/** Il percorso dentro lo store, ricavato dall'indirizzo salvato. */
export function pathnameOf(url: string): string {
  return url.slice("blob:".length);
}

/**
 * Sostituisce gli indirizzi interni con quelli della route che serve i file.
 * I video esterni restano come sono.
 */
export function withServingUrls<T extends { id: string; url: string }>(
  materials: T[],
  basePath: string,
): T[] {
  return materials.map((m) =>
    isStoredFile(m.url) ? { ...m, url: `${basePath}/${m.id}` } : m,
  );
}

export async function createMaterial(input: {
  lessonId?: number | null;
  courseId?: string | null;
  type: "PDF" | "SLIDE" | "IMAGE" | "VIDEO" | "SCROLL";
  titleIt: string;
  titleEn?: string | null;
  url: string;
  notes?: string | null;
}) {
  return prisma.material.create({
    data: {
      lessonId: input.lessonId ?? null,
      courseId: input.courseId ?? null,
      type: input.type,
      titleIt: input.titleIt,
      titleEn: input.titleEn || null,
      url: input.url,
      notes: input.notes || null,
    },
  });
}

export async function deleteMaterial(id: string) {
  const material = await prisma.material.findUnique({
    where: { id },
    select: { url: true },
  });
  if (!material) return false;

  // Il file va tolto anche dallo store, altrimenti resterebbe a occupare
  // spazio per sempre senza che nessuno sappia più a cosa serviva.
  if (isStoredFile(material.url)) {
    const { del } = await import("@vercel/blob");
    await del(pathnameOf(material.url)).catch(() => {
      // Se il file non c'è più, la riga va comunque rimossa.
    });
  }

  await prisma.material.delete({ where: { id } });
  return true;
}

/**
 * Legge il file dallo store e lo restituisce pronto da trasmettere.
 * Da chiamare **solo dopo** aver verificato che chi chiede ha diritto.
 */
export async function readStoredFile(url: string) {
  if (!isStoredFile(url)) return null;
  const { get } = await import("@vercel/blob");
  return get(pathnameOf(url), { access: "private" });
}

const MATERIAL_FIELDS = {
  id: true,
  type: true,
  titleIt: true,
  titleEn: true,
  url: true,
  notes: true,
  viewCount: true,
  createdAt: true,
} as const;

export async function materialsForLesson(lessonId: number) {
  return prisma.material.findMany({
    where: { lessonId },
    orderBy: { createdAt: "asc" },
    select: MATERIAL_FIELDS,
  });
}

export async function materialsForCourse(courseId: string) {
  return prisma.material.findMany({
    where: { courseId },
    orderBy: { createdAt: "asc" },
    select: MATERIAL_FIELDS,
  });
}
