import type { CertificateData } from "@/components/Certificate";
import { courseOverview } from "./course";
import type { EnrollmentRef } from "./enrollment";
import { readStoredFile } from "./materials";
import { TOTAL_COURSE_POINTS, meritSubtitle, meritTitle, percentage } from "./scoring";

// Quando si ottiene l'attestato.
//
// Regola unica: quando l'iscritto ha svolto **tutte le lezioni del corso**,
// comprese quelle che il relatore non ha ancora scritto. È deliberato: un
// corso a metà — tre serate su sei ancora senza domande — non deve produrre
// un attestato «di tutto il corso» dopo la prima sera. L'attestato arriva
// alla fine dell'ultima lezione, non prima, e se una lezione manca ancora di
// domande semplicemente non si può finire il corso finché non viene scritta.

export type CertificateStatus =
  | { earned: true; data: CertificateData }
  | { earned: false; done: number; required: number };

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * Legge i loghi dallo store e li trasforma in `data:` URI.
 *
 * Non basterebbe un indirizzo qualunque: l'attestato si converte in PNG
 * ricalcando l'SVG su un `<canvas>` (src/lib/svgToPng.ts), e un'immagine
 * esterna referenziata lì dentro "sporca" il canvas — il browser rifiuta poi
 * di esportarlo, anche se l'immagine viene dallo stesso sito. Incorporare i
 * byte direttamente nell'SVG toglie il problema alla radice: non è più una
 * richiesta di rete al momento dell'esportazione, è già lì.
 *
 * Un logo che non si legge più (file rimosso a mano dallo store) viene
 * saltato in silenzio: meglio un attestato con un logo in meno che nessun
 * attestato.
 */
async function resolveLogos(urls: string[]): Promise<string[]> {
  const files = await Promise.all(urls.map((url) => readStoredFile(url)));

  const dataUris: string[] = [];
  for (const file of files) {
    if (!file) continue;
    const bytes = Buffer.from(await new Response(file.stream).arrayBuffer());
    const contentType = file.blob.contentType || "image/png";
    dataUris.push(`data:${contentType};base64,${bytes.toString("base64")}`);
  }
  return dataUris;
}

export async function certificateFor(
  enrollment: EnrollmentRef,
  studentName: string,
): Promise<CertificateStatus | null> {
  const overview = await courseOverview(enrollment);
  if (!overview) return null;

  const required = overview.lessons;
  const done = required.filter((l) => l.status === "fatto");

  if (required.length === 0 || done.length < required.length) {
    return { earned: false, done: done.length, required: required.length };
  }

  const title = meritTitle(
    percentage(overview.totalScore, TOTAL_COURSE_POINTS),
  );

  return {
    earned: true,
    data: {
      name: studentName,
      courseTitle: overview.course.titleIt,
      meritTitle: title,
      meritSubtitle: meritSubtitle(title),
      location: overview.course.location,
      date: formatDate(new Date()),
      issuer: overview.course.certificateIssuer,
      logos: await resolveLogos(overview.course.logoUrls),
    },
  };
}

/** Dati d'esempio per l'anteprima del relatore (§3.7a). */
export async function sampleCertificate(
  courseTitle: string,
  issuer: string | null,
  logoUrls: string[],
): Promise<CertificateData> {
  const title = meritTitle(96);
  return {
    name: "Nome Cognome",
    courseTitle,
    meritTitle: title,
    meritSubtitle: meritSubtitle(title),
    location: null,
    date: formatDate(new Date()),
    issuer,
    logos: await resolveLogos(logoUrls),
  };
}
