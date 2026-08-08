import type { CertificateData } from "@/components/Certificate";
import { courseOverview } from "./course";
import type { EnrollmentRef } from "./enrollment";
import { siteHost } from "./site";
import { TOTAL_COURSE_POINTS, meritSubtitle, meritTitle, percentage } from "./scoring";
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

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
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
      date: formatDate(new Date()),
      issuer: "L'Angolo del Vino",
      // Ricavato dall'iscrizione, non salvato: vedi src/lib/verification.ts.
      // Vale anche per gli attestati già scaricati prima che esistesse.
      verificationCode: formatVerificationCode(verificationCode(enrollment.id)),
      verificationHost: siteHost(),
    },
  };
}

/** Dati d'esempio per l'anteprima del relatore (§3.7a). */
export function sampleCertificate(courseTitle: string): CertificateData {
  const title = meritTitle(96);
  return {
    name: "Nome Cognome",
    courseTitle,
    meritTitle: title,
    meritSubtitle: meritSubtitle(title),
    date: formatDate(new Date()),
    issuer: "L'Angolo del Vino",
    // Un codice finto, ma della lunghezza giusta: l'anteprima serve a vedere
    // l'ingombro. Cercarlo davvero risponde "non risulta", ed è corretto.
    verificationCode: formatVerificationCode("ESEMPIO000000000"),
    verificationHost: siteHost(),
  };
}
