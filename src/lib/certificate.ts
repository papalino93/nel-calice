import type { CertificateData } from "@/components/Certificate";
import { courseOverview } from "./course";
import type { EnrollmentRef } from "./enrollment";
import { readStoredFile } from "./materials";
import { prisma } from "./prisma";
import { siteHost } from "./site";
import {
  TOTAL_COURSE_POINTS,
  meritSubtitle,
  meritTitle,
  percentage,
  type MeritTitle,
} from "./scoring";
import { formatVerificationCode, verificationCode } from "./verification";

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

function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * Traduzione dei titoli di merito, solo per l'attestato: `scoring.ts` resta
 * la fonte in italiano, usata anche dall'area relatore, che rimane in
 * italiano fisso (§ difetto "promessa bilingue"). L'attestato invece se lo
 * porta a casa il corsista, e lì il commutatore IT/EN deve valere davvero.
 */
const MERIT_EN: Record<MeritTitle, { title: string; subtitle: string }> = {
  "Palato d'Oro": {
    title: "Golden Palate",
    subtitle: "a truly trained nose and palate",
  },
  "Naso Fine": {
    title: "Fine Nose",
    subtitle: "knows what's really in the glass",
  },
  "Bevitore Curioso": {
    title: "Curious Drinker",
    subtitle: "curiosity served, and still plenty to taste",
  },
  "Amico del Calice": {
    title: "Friend of the Glass",
    subtitle: "the best part is you always start here",
  },
};

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

  // La data che conta è quella dell'ultima consegna, non `new Date()`: un
  // corsista che riguarda l'attestato mesi dopo deve vedere sempre la
  // stessa data, e deve essere la stessa che legge chi lo verifica su
  // /verifica/<codice> (src/lib/verification.ts calcola questa data allo
  // stesso modo — le due pagine devono restare d'accordo).
  const last = await prisma.quizAttempt.findFirst({
    where: { enrollmentId: enrollment.id, submittedAt: { not: null } },
    orderBy: { submittedAt: "desc" },
    select: { submittedAt: true },
  });
  const completedOn = last?.submittedAt ?? new Date();

  return {
    earned: true,
    data: {
      name: studentName,
      courseTitleIt: overview.course.titleIt,
      courseTitleEn: overview.course.titleEn,
      meritTitleIt: title,
      meritTitleEn: MERIT_EN[title].title,
      meritSubtitleIt: meritSubtitle(title),
      meritSubtitleEn: MERIT_EN[title].subtitle,
      location: overview.course.location,
      dateIt: formatDate(completedOn, "it-IT"),
      dateEn: formatDate(completedOn, "en-US"),
      issuer: overview.course.certificateIssuer,
      logos: await resolveLogos(overview.course.logoUrls),
      // Ricavato dall'iscrizione, non salvato: vedi src/lib/verification.ts.
      // Vale anche per gli attestati già scaricati prima che esistesse.
      verificationCode: formatVerificationCode(verificationCode(enrollment.id)),
      verificationHost: siteHost(),
    },
  };
}

/** Dati d'esempio per l'anteprima del relatore (§3.7a). */
export async function sampleCertificate(
  courseTitleIt: string,
  courseTitleEn: string,
  issuer: string | null,
  logoUrls: string[],
): Promise<CertificateData> {
  const title = meritTitle(96);
  const now = new Date();
  return {
    name: "Nome Cognome",
    courseTitleIt,
    courseTitleEn,
    meritTitleIt: title,
    meritTitleEn: MERIT_EN[title].title,
    meritSubtitleIt: meritSubtitle(title),
    meritSubtitleEn: MERIT_EN[title].subtitle,
    // Nell'anteprima non c'è un corso reale da cui prendere il luogo: resta
    // vuoto, così il relatore vede l'ingombro senza un dato inventato.
    location: null,
    dateIt: formatDate(now, "it-IT"),
    dateEn: formatDate(now, "en-US"),
    issuer,
    logos: await resolveLogos(logoUrls),
    // Un codice finto, ma della lunghezza giusta: l'anteprima serve a vedere
    // l'ingombro. Cercarlo davvero risponde "non risulta", ed è corretto.
    verificationCode: formatVerificationCode("ESEMPIO000000000"),
    verificationHost: siteHost(),
  };
}
