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

/**
 * true se il file vero sta nella colonna `content` invece che su Blob.
 * Nato quando lo store Blob è finito sotto il limite del piano Hobby:
 * per file di poche centinaia di KB come le dispense, il database che già
 * usiamo basta, senza account esterni né costi.
 */
export function isDbStored(url: string): boolean {
  return url === "db:inline";
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
    isStoredFile(m.url) || isDbStored(m.url)
      ? { ...m, url: `${basePath}/${m.id}` }
      : m,
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

/**
 * Come sopra il vincolo di dimensione lato client (§MaterialsSection): qui
 * è la verifica che conta davvero, perché il client non è mai fidato.
 *
 * Il file viaggia in base64 dentro al corpo della richiesta (~+33% di
 * dimensione) più l'overhead JSON — e le funzioni serverless di Vercel
 * rifiutano un corpo oltre 4.5MB prima ancora che questo codice giri, con
 * un errore di piattaforma anziché il messaggio pulito sotto. 2MB grezzi
 * restano comunque sotto i 2.7MB codificati: margine reale, non solo sulla
 * carta.
 */
export const MAX_INLINE_BYTES = 2 * 1024 * 1024;

/**
 * Salva un materiale con il file dentro alla riga stessa, invece che su
 * Blob. Vedi `isDbStored`.
 */
export async function createMaterialWithContent(input: {
  lessonId?: number | null;
  courseId?: string | null;
  type: "PDF" | "SLIDE" | "IMAGE" | "VIDEO" | "SCROLL";
  titleIt: string;
  titleEn?: string | null;
  content: Buffer;
  contentType: string;
  notes?: string | null;
}) {
  if (input.content.byteLength > MAX_INLINE_BYTES) {
    throw new Error(
      `File troppo grande: massimo ${Math.floor(MAX_INLINE_BYTES / 1024 / 1024)}MB.`,
    );
  }
  return prisma.material.create({
    data: {
      lessonId: input.lessonId ?? null,
      courseId: input.courseId ?? null,
      type: input.type,
      titleIt: input.titleIt,
      titleEn: input.titleEn || null,
      url: "db:inline",
      content: Uint8Array.from(input.content),
      contentType: input.contentType,
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

/**
 * Come `readStoredFile`, ma copre anche i materiali salvati nel database:
 * unico punto da cui le route che servono un file leggono, così non devono
 * sapere se quel materiale vive su Blob o in una colonna. Restituisce
 * sempre i byte interi, mai `null` per un materiale che esiste davvero.
 */
export async function loadMaterialBytes(material: {
  url: string;
  content: Uint8Array | null;
  contentType: string | null;
}): Promise<{ contentType: string; bytes: Uint8Array } | null> {
  if (isDbStored(material.url)) {
    if (!material.content) return null;
    return {
      contentType: material.contentType ?? "application/octet-stream",
      bytes: material.content,
    };
  }
  const file = await readStoredFile(material.url);
  if (!file) return null;
  const bytes = new Uint8Array(await new Response(file.stream).arrayBuffer());
  return { contentType: file.blob.contentType ?? "application/octet-stream", bytes };
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
