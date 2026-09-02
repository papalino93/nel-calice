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
  exitTooLate:
    "Il tempo è già scaduto: questo tentativo conterà come concluso, con le risposte date finora.",
  exitFailed:
    "Non è stato possibile abbandonare il quiz. Controlla la rete e riprova.",
  timeUp: "Tempo scaduto",
  // La consegna può non arrivare al server (rete che cade in sala): il quiz
  // resta aperto e si può riprovare, invece di far credere di aver consegnato.
  submitFailed:
    "La consegna non è arrivata al server. Il quiz è ancora aperto: riprova.",
  retry: "Riprova",
  answerNotSaved: "Questa risposta non è stata salvata. Toccala di nuovo.",
  lessonEmptyTitle: "Questa lezione non ha ancora domande.",
  lessonLocked: "Questa serata è ancora bloccata.",
  lessonNotFound: "Questa lezione non esiste.",
  quizStillOpen: "Questo quiz è ancora in corso.",
  resumeQuiz: "Riprendi il quiz",
  questionsCount: (n: number) => `${n} ${n === 1 ? "domanda" : "domande"}`,
  quizResumeHint:
    "Il tempo e le risposte già date restano salvati: se chiudi la pagina, riprendi da dove eri.",
  quizStartHint:
    "Quando sei pronto/a, avvia il quiz: il tempo parte da questo momento.",
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
  otherCourses: "Gli altri tuoi corsi",
  coursesCount: (n: number) => `${n} ${n === 1 ? "corso" : "corsi"}`,
  personalArea: "La tua area personale",
  journeyStarts: "Il tuo percorso comincia qui",
  journeyStartsHint:
    "Quiz, risultati e materiali del corso resteranno sempre salvati in questa area personale.",
  continueHere: "Riprendi da qui",
  courseReady: "Il tuo corso è pronto quando lo sei tu.",
  openMyCourse: "Apri il mio corso",
  enrolled: "Iscrizione confermata.",
  alreadyEnrolled: "Sei già iscritto a questo corso.",
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
  exitTooLate:
    "Time had already run out: this attempt will count as concluded, with whatever you'd answered so far.",
  exitFailed: "Could not leave the quiz. Check your connection and try again.",
  timeUp: "Time's up",
  submitFailed:
    "Your submission never reached the server. The quiz is still open: try again.",
  retry: "Try again",
  answerNotSaved: "This answer was not saved. Tap it again.",
  lessonEmptyTitle: "This lesson has no questions yet.",
  lessonLocked: "This evening is still locked.",
  lessonNotFound: "This lesson does not exist.",
  quizStillOpen: "This quiz is still open.",
  resumeQuiz: "Resume the quiz",
  questionsCount: (n: number) => `${n} ${n === 1 ? "question" : "questions"}`,
  quizResumeHint:
    "The time left and the answers you've given stay saved: if you close the page, you pick up where you were.",
  quizStartHint:
    "When you're ready, start the quiz: the clock starts from this moment.",
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
  otherCourses: "Your other courses",
  coursesCount: (n: number) => `${n} ${n === 1 ? "course" : "courses"}`,
  personalArea: "Your personal area",
  journeyStarts: "Your wine journey starts here",
  journeyStartsHint:
    "Your quizzes, results and course materials will always be saved in this personal area.",
  continueHere: "Continue from here",
  courseReady: "Your course is ready whenever you are.",
  openMyCourse: "Open my course",
  enrolled: "You're enrolled.",
  alreadyEnrolled: "You are already enrolled in this course.",
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
  // Anche la stringa vuota conta come mancante, non solo `null`: il campo
  // inglese di un'opzione di risposta si salva vuoto se il relatore non lo
  // compila, e senza questo il corsista inglese si trovava davanti pulsanti
  // bianchi invece del testo italiano.
  const has = (v: string | null) => (v && v.trim() ? v : null);
  const chosen = lang === "en" ? has(en) : has(it);
  return chosen ?? has(it) ?? has(en) ?? "";
}
