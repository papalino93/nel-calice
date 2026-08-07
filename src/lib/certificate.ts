import type { CertificateData } from "@/components/Certificate";
import { courseOverview } from "./course";
import type { EnrollmentRef } from "./enrollment";
import { TOTAL_COURSE_POINTS, meritSubtitle, meritTitle, percentage } from "./scoring";

// Quando si ottiene l'attestato.
//
// Regola unica: quando l'iscritto ha svolto **tutte le lezioni del corso che
// hanno domande**. Vale sia per un corso con la prova finale sia per uno
// tematico che non ce l'ha — e non ci sarebbe altro modo di trattare i
// secondi senza lasciarli senza riconoscimento.
//
// Le lezioni ancora senza domande non contano: non sono svolgibili, e
// pretenderle bloccherebbe l'attestato per sempre.

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

  const doable = overview.lessons.filter((l) => l.status !== "vuoto");
  const done = doable.filter((l) => l.status === "fatto");

  if (doable.length === 0 || done.length < doable.length) {
    return { earned: false, done: done.length, required: doable.length };
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
      score: overview.totalScore,
      maxScore: TOTAL_COURSE_POINTS,
      date: formatDate(new Date()),
      issuer: "L'Angolo del Vino",
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
    score: 96,
    maxScore: TOTAL_COURSE_POINTS,
    date: formatDate(new Date()),
    issuer: "L'Angolo del Vino",
  };
}
