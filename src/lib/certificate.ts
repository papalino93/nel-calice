import type { CertificateData, LogoItem, LogoSize } from "@/components/Certificate";
import { courseOverview } from "./course";
import type { EnrollmentRef } from "./enrollment";
import { loadMaterialBytes } from "./materials";
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

export type CourseLogoInput = {
  url: string | null;
  text: string | null;
  size: LogoSize;
  content: Uint8Array | null;
  contentType: string | null;
};

/**
 * Trasforma i loghi del corso in ciò che l'SVG sa disegnare: un'immagine
 * letta dallo store o dal database e convertita in `data:` URI, o un testo passato tale e
 * quale — non ha bisogno di essere letto da nessuna parte.
 *
 * Per le immagini, non basterebbe un indirizzo qualunque: l'attestato si
 * converte in PNG ricalcando l'SVG su un `<canvas>` (src/lib/svgToPng.ts), e
 * un'immagine esterna referenziata lì dentro "sporca" il canvas — il
 * browser rifiuta poi di esportarlo, anche se l'immagine viene dallo stesso
 * sito. Incorporare i byte direttamente nell'SVG toglie il problema alla
 * radice: non è più una richiesta di rete al momento dell'esportazione, è
 * già lì.
 *
 * Un'immagine che non si legge più (file rimosso a mano dallo store) viene
 * saltata in silenzio: meglio un attestato con un logo in meno che nessun
 * attestato.
 */
async function resolveLogos(logos: CourseLogoInput[]): Promise<LogoItem[]> {
  const items = await Promise.all(
    logos.map(async (logo): Promise<LogoItem | null> => {
      if (logo.text !== null) {
        return { kind: "text", text: logo.text, size: logo.size };
      }
      const url = logo.url;
      if (url === null) return null;
      const file = await loadMaterialBytes({
        url,
        content: logo.content,
        contentType: logo.contentType,
      });
      if (!file) return null;
      return {
        kind: "image",
        src: `data:${file.contentType};base64,${Buffer.from(file.bytes).toString("base64")}`,
        size: logo.size,
      };
    }),
  );
  return items.filter((item): item is LogoItem => item !== null);
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

  // `courseOverview` non porta più i byte dei loghi (§ leak nella dashboard
  // del corsista, che chiama la stessa funzione a ogni apertura): qui, dove
  // servono davvero per costruire l'attestato, si leggono a parte.
  const logos = await prisma.courseLogo.findMany({
    where: { courseId: enrollment.courseId },
    select: { url: true, text: true, size: true, content: true, contentType: true },
    orderBy: { createdAt: "asc" },
  });

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
      logos: await resolveLogos(
        logos.map((l) => ({ ...l, size: l.size as LogoSize })),
      ),
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
  location: string | null,
  issuer: string | null,
  logos: CourseLogoInput[],
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
    // Luogo del corso vero, non inventato: è quello che comparirà
    // sull'attestato reale, ed è il punto dell'anteprima mostrarlo.
    location,
    dateIt: formatDate(now, "it-IT"),
    dateEn: formatDate(now, "en-US"),
    issuer,
    logos: await resolveLogos(logos),
    // Nessun codice qui: un attestato vero ne mostra uno che risponde
    // davvero su /verifica/<codice>. Uno finto nell'anteprima confonderebbe
    // il relatore, che non ha modo di distinguerlo da uno rotto.
  };
}
