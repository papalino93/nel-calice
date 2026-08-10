import type { CertificateData } from "@/components/Certificate";
import { courseOverview } from "./course";
import type { EnrollmentRef } from "./enrollment";
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
  const now = new Date();

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
      dateIt: formatDate(now, "it-IT"),
      dateEn: formatDate(now, "en-US"),
      issuer: "L'Angolo del Vino",
      // Ricavato dall'iscrizione, non salvato: vedi src/lib/verification.ts.
      // Vale anche per gli attestati già scaricati prima che esistesse.
      verificationCode: formatVerificationCode(verificationCode(enrollment.id)),
      verificationHost: siteHost(),
    },
  };
}

/** Dati d'esempio per l'anteprima del relatore (§3.7a). */
export function sampleCertificate(
  courseTitleIt: string,
  courseTitleEn: string,
): CertificateData {
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
    dateIt: formatDate(now, "it-IT"),
    dateEn: formatDate(now, "en-US"),
    issuer: "L'Angolo del Vino",
    // Un codice finto, ma della lunghezza giusta: l'anteprima serve a vedere
    // l'ingombro. Cercarlo davvero risponde "non risulta", ed è corretto.
    verificationCode: formatVerificationCode("ESEMPIO000000000"),
    verificationHost: siteHost(),
  };
}
