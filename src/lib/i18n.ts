// Bilingue italiano/inglese, con l'italiano come lingua principale (§2.6).
//
// Qui stanno solo le etichette dell'interfaccia. I contenuti (titoli delle
// lezioni, domande, opzioni) hanno i campi It/En sulla stessa riga del
// database, così le due lingue non possono divergere in struttura — che è
// esattamente il difetto §7.12 dell'app attuale, dove le traduzioni inglesi
// erano un array separato e fisso.

export type Language = "it" | "en";

// L'italiano è la lingua di riferimento: da qui si deriva la forma, e
// l'inglese viene controllato dal compilatore contro di essa. Una chiave
// aggiunta di là e dimenticata di qua non compila.
const it = {
  courseTitle: "Corso di Avvicinamento al Vino",
  courseSubtitle: "L'Angolo del Vino · serata dopo serata",
  signIn: "Accedi con Google",
  checkingSession: "Un momento…",
  signInHint: "Serve per ritrovare i tuoi progressi alla lezione successiva.",
  signedInAs: "Collegato come",
  signOut: "Esci",
  totalPoints: "Punti Totali",
  currentTitle: "Qualifica attuale",
  lessons: "Lezioni",
  lesson: "Lezione",
  finalExam: "Prova finale",
  unlock: "Sblocca",
  start: "Inizia",
  seeResult: "Vedi il risultato",
  resume: "Riprendi",
  comingSoon: "In arrivo",
  points: "punti",
  adminArea: "Area Relatore",
  // Modale del codice
  unlockTitle: "Codice della serata",
  unlockHint: "Il relatore lo comunica a voce durante la lezione.",
  unlockPlaceholder: "Scrivi il codice",
  confirm: "Conferma",
  cancel: "Annulla",
  // Quiz
  questionOf: (n: number, total: number) => `Domanda ${n} di ${total}`,
  next: "Avanti",
  finish: "Consegna",
  exit: "Esci",
  exitConfirm: "Vuoi davvero abbandonare il quiz? Non verrà registrato nulla.",
  timeUp: "Tempo scaduto",
  // Risultato
  yourScore: "Il tuo punteggio",
  reviewQuestions: "Rivedi le domande",
  onlyErrors: "Solo errori",
  all: "Tutte",
  correctAnswer: "Risposta corretta",
  yourAnswer: "La tua risposta",
  leftBlank: "Lasciata in bianco",
  backToLessons: "Torna alle lezioni",
  // Materiali
  materials: "Materiale Didattico",
  noMaterials: "Nessuna dispensa per questa lezione, per ora.",
  // Corsi e iscrizione
  myCourses: "I tuoi corsi",
  noCoursesYet: "Non sei ancora iscritto a nessun corso.",
  enrollTitle: "Codice del corso",
  enrollHint: "Il relatore lo comunica a voce alla prima serata.",
  enrollPlaceholder: "Scrivi il codice",
  enroll: "Iscriviti",
  openCourse: "Apri",
  studentView: "Vista corsista",
  backToCourses: "Torna ai corsi",
  // Errori
  genericError: "Qualcosa non ha funzionato. Riprova.",
  networkError: "Connessione assente. Controlla la rete e riprova.",
};

export type Strings = typeof it;

const en: Strings = {
  courseTitle: "An Introduction to Wine",
  courseSubtitle: "L'Angolo del Vino · evening by evening",
  signIn: "Sign in with Google",
  checkingSession: "One moment…",
  signInHint: "So you find your progress again at the next lesson.",
  signedInAs: "Signed in as",
  signOut: "Sign out",
  totalPoints: "Total Points",
  currentTitle: "Current title",
  lessons: "Lessons",
  lesson: "Lesson",
  finalExam: "Final test",
  unlock: "Unlock",
  start: "Start",
  seeResult: "See result",
  resume: "Resume",
  comingSoon: "Coming soon",
  points: "points",
  adminArea: "Host Area",
  unlockTitle: "Tonight's code",
  unlockHint: "The host says it out loud during the lesson.",
  unlockPlaceholder: "Type the code",
  confirm: "Confirm",
  cancel: "Cancel",
  questionOf: (n: number, total: number) => `Question ${n} of ${total}`,
  next: "Next",
  finish: "Submit",
  exit: "Exit",
  exitConfirm: "Really leave the quiz? Nothing will be recorded.",
  timeUp: "Time's up",
  yourScore: "Your score",
  reviewQuestions: "Review the questions",
  onlyErrors: "Mistakes only",
  all: "All",
  correctAnswer: "Correct answer",
  yourAnswer: "Your answer",
  leftBlank: "Left blank",
  backToLessons: "Back to lessons",
  materials: "Course Material",
  noMaterials: "No handouts for this lesson yet.",
  myCourses: "Your courses",
  noCoursesYet: "You are not enrolled in any course yet.",
  enrollTitle: "Course code",
  enrollHint: "The host says it out loud on the first evening.",
  enrollPlaceholder: "Type the code",
  enroll: "Join",
  openCourse: "Open",
  studentView: "Student view",
  backToCourses: "Back to courses",
  genericError: "Something went wrong. Please try again.",
  networkError: "You seem to be offline. Check your connection and retry.",
};

export const strings: Record<Language, Strings> = { it, en };

/** Sceglie il campo giusto fra la versione italiana e quella inglese. */
export function pick(
  lang: Language,
  it: string | null,
  en: string | null,
): string {
  const chosen = lang === "en" ? en : it;
  return chosen ?? it ?? en ?? "";
}
