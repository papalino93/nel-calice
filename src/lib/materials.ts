import { issueSignedToken, presignUrl } from "@vercel/blob";
import { prisma } from "./prisma";

// Le dispense stanno in uno store Vercel Blob **privato**: il loro indirizzo
// non è raggiungibile da nessuno, nemmeno conoscendolo.
//
// Chi ha diritto a leggerle riceve un link firmato che scade. È ciò che rende
// vera la regola "le dispense di una lezione ereditano il suo blocco"
// (§3.7d): con file pubblici il blocco impedirebbe solo di *scoprire*
// l'indirizzo, e un link girato su WhatsApp resterebbe valido per sempre.
//
// I video non stanno nello store: sono link esterni (YouTube, Vimeo) e
// restano tali.

/** Quanto vive un link firmato. Il tempo di aprire il file, non di girarlo. */
const LINK_TTL_MS = 15 * 60 * 1000;

/** true se l'indirizzo punta al nostro store e non a un video esterno. */
export function isStoredFile(url: string): boolean {
  return url.startsWith("blob:");
}

/** Il pathname dentro lo store, ricavato dall'indirizzo salvato. */
function pathnameOf(url: string): string {
  return url.slice("blob:".length);
}

/**
 * Trasforma gli indirizzi salvati in link utilizzabili.
 * I file dello store diventano link firmati a scadenza; i video esterni
 * restano come sono.
 */
export async function withSignedUrls<
  T extends { url: string; type: string },
>(materials: T[]): Promise<T[]> {
  const stored = materials.filter((m) => isStoredFile(m.url));
  if (stored.length === 0) return materials;

  const validUntil = Date.now() + LINK_TTL_MS;
  // Un solo token per l'intera lista: firmare ogni file separatamente
  // significherebbe una chiamata di rete per dispensa.
  const token = await issueSignedToken({
    pathname: "*",
    operations: ["get"],
    validUntil,
  });

  const signed = new Map<string, string>();
  await Promise.all(
    stored.map(async (m) => {
      const { presignedUrl } = await presignUrl(token, {
        operation: "get",
        pathname: pathnameOf(m.url),
        validUntil,
        access: "private",
      });
      signed.set(m.url, presignedUrl);
    }),
  );

  return materials.map((m) =>
    signed.has(m.url) ? { ...m, url: signed.get(m.url)! } : m,
  );
}

/** Registra una dispensa già caricata sullo store dal browser. */
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

/** Dispense di una lezione del catalogo, per il pannello relatore. */
export async function materialsForLesson(lessonId: number) {
  return prisma.material.findMany({
    where: { lessonId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      titleIt: true,
      titleEn: true,
      url: true,
      notes: true,
      viewCount: true,
      createdAt: true,
    },
  });
}

/** Dispense generali di un corso. */
export async function materialsForCourse(courseId: string) {
  return prisma.material.findMany({
    where: { courseId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      titleIt: true,
      titleEn: true,
      url: true,
      notes: true,
      viewCount: true,
      createdAt: true,
    },
  });
}
