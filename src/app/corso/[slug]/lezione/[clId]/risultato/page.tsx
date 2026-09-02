"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { pick } from "@/lib/i18n";
import { percentage, resultMessage } from "@/lib/scoring";
import { useLanguage } from "@/components/LanguageProvider";
import {
  CheckIcon,
  ClockIcon,
  CrossIcon,
  GrapesIcon,
  Seal,
} from "@/components/icons";

type ReviewQuestion = {
  id: number;
  textIt: string;
  textEn: string;
  explanationIt: string | null;
  explanationEn: string | null;
  options: { id: number; textIt: string; textEn: string }[];
  correctOptionId: number | null;
  selectedOptionId: number | null;
  isCorrect: boolean;
  pointsAwarded: number;
};

type Review = {
  /** Presente solo quando il tentativo è ancora aperto: in quel caso non
      c'è nessuna correzione da mostrare, e i campi qui sotto non arrivano. */
  status?: string;
  score: number;
  maxScore: number;
  timedOut: boolean;
  questions: ReviewQuestion[];
};

export default function ResultPage({
  params,
}: {
  params: Promise<{ slug: string; clId: string }>;
}) {
  const { slug, clId } = use(params);
  const { lang, t } = useLanguage();
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyErrors, setOnlyErrors] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // Si passa dalla lezione per ritrovare l'id del tentativo.
      const lesson = await api<{ lesson: { attemptId: string | null } }>(
        `/api/courses/${slug}/lessons/${clId}`,
      );
      if (cancelled) return;

      // L'esito va letto dal risultato della richiesta, non dal suo
      // contrario: prima una risposta arrivata (403, 404, 500) veniva
      // annunciata come «connessione assente», e una riuscita senza
      // tentativo come errore generico.
      if (!lesson.ok) {
        setError(lesson.offline ? t.networkError : t.genericError);
        return;
      }
      if (!lesson.data.lesson.attemptId) {
        setError(t.genericError);
        return;
      }

      const result = await api<Review>(
        `/api/courses/${slug}/attempts/${lesson.data.lesson.attemptId}`,
      );
      if (cancelled) return;

      if (result.ok) setReview(result.data);
      else setError(result.offline ? t.networkError : t.genericError);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, clId, t]);

  if (error) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-cream/70">{error}</p>
        <Link
          href={`/corso/${slug}`}
          className="text-sm text-gold underline underline-offset-4"
        >
          {t.backToLessons}
        </Link>
      </main>
    );
  }

  if (!review) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-cream/60">{t.checkingSession}</p>
      </main>
    );
  }

  // Un tentativo ancora aperto non ha nulla da rivedere: il server risponde
  // 200 con il solo stato, senza punteggio né correzioni. Renderlo come una
  // revisione stampava «undefined/undefined», un messaggio da punteggio
  // minimo calcolato su NaN, e ogni domanda segnata sbagliata senza
  // risposta giusta. Qui si riconosce e si offre l'unica cosa sensata:
  // tornare al quiz.
  if (review.status === "in_corso") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-cream/70">{t.quizStillOpen}</p>
        <Link
          href={`/corso/${slug}/lezione/${clId}/quiz`}
          className="press lift inline-flex min-h-11 items-center rounded-full bg-gold px-6 py-3 text-sm font-medium text-charcoal"
        >
          {t.resumeQuiz}
        </Link>
        <Link
          href={`/corso/${slug}`}
          className="press inline-flex min-h-10 items-center text-sm text-cream/70 underline underline-offset-4"
        >
          {t.backToLessons}
        </Link>
      </main>
    );
  }

  const percent = percentage(review.score, review.maxScore);
  const shown = onlyErrors
    ? review.questions.filter((q) => !q.isCorrect)
    : review.questions;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 pt-8 pb-28 sm:px-8">
      <div className="rise-in flex flex-col items-center text-center">
        <Seal size={96}>
          <GrapesIcon className="h-full w-full" />
        </Seal>

        {review.timedOut && (
          <p className="pill mt-5 bg-red-400/12 text-red-300">
            <ClockIcon className="h-3.5 w-3.5" />
            {t.timeUp}
          </p>
        )}

        <p className="mt-6 text-xs uppercase tracking-[0.18em] text-gold/80">
          {t.yourScore}
        </p>
        <p className="mt-2 font-serif text-6xl leading-none text-cream">
          {review.score}
          <span className="text-cream/30">/{review.maxScore}</span>
        </p>
        <p className="mt-4 max-w-sm text-sm text-cream/60">
          {lang === "it"
            ? resultMessage(percent)
            : percent >= 80
              ? "Impressive — you have a good nose."
              : percent >= 50
                ? "Nice work: the glass is more than half full."
                : "Next sip we start again: look at the handouts and retry."}
        </p>
      </div>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-gold/80">
            {t.reviewQuestions}
          </h2>
          <div className="inline-flex rounded-full border border-cream/12 p-0.5 text-xs">
            {[
              { label: t.all, value: false },
              { label: t.onlyErrors, value: true },
            ].map((chip) => (
              <button
                key={chip.label}
                onClick={() => setOnlyErrors(chip.value)}
                aria-pressed={onlyErrors === chip.value}
                className={`press inline-flex min-h-10 items-center rounded-full px-4 transition-colors ${
                  onlyErrors === chip.value
                    ? "bg-gold/20 text-gold"
                    : "text-cream/50 hover:text-cream/80"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <ul className="flex flex-col gap-3">
          {shown.length === 0 && (
            <li className="card p-5 text-center text-sm text-cream/65">
              {lang === "en"
                ? "No incorrect answers here - excellent work."
                : "Nessuna risposta sbagliata qui: ottimo lavoro."}
            </li>
          )}
          {shown.map((question) => {
            const correct = question.options.find(
              (o) => o.id === question.correctOptionId,
            );
            const given = question.options.find(
              (o) => o.id === question.selectedOptionId,
            );

            return (
              <li key={question.id} className="card p-4">
                <p className="font-serif text-lg leading-snug text-cream">
                  {pick(lang, question.textIt, question.textEn)}
                </p>

                {question.selectedOptionId === null && (
                  <p className="mt-2 text-xs text-amber-300/80">{t.leftBlank}</p>
                )}

                <div className="mt-3 flex flex-col gap-1.5 text-sm">
                  {correct && (
                    <p className="flex items-start gap-2 text-gold">
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        <span className="text-cream/60">
                          {t.correctAnswer}:{" "}
                        </span>
                        {pick(lang, correct.textIt, correct.textEn)}
                      </span>
                    </p>
                  )}

                  {given && !question.isCorrect && (
                    <p className="flex items-start gap-2 text-red-300">
                      <CrossIcon className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        <span className="text-cream/60">{t.yourAnswer}: </span>
                        {pick(lang, given.textIt, given.textEn)}
                      </span>
                    </p>
                  )}
                </div>

                {(question.explanationIt || question.explanationEn) && (
                  <p className="mt-3 border-t border-cream/10 pt-3 text-sm leading-relaxed text-cream/65">
                    {pick(
                      lang,
                      question.explanationIt || question.explanationEn || "",
                      question.explanationEn || question.explanationIt || "",
                    )}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card mt-8 p-5 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold/80">
          {lang === "en" ? "What now?" : "E ora?"}
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-cream/65">
          {lang === "en"
            ? "Go back to your course: it will show the one lesson or material that makes sense to open next."
            : "Torna al corso: troverai subito la lezione o il materiale che ha senso aprire adesso."}
        </p>
        <Link
          href={`/corso/${slug}`}
          className="press lift mt-4 inline-block rounded-full bg-gold px-6 py-3 text-sm font-medium text-charcoal transition-transform"
        >
          {lang === "en" ? "Return to my course" : "Torna al mio corso"}
        </Link>
      </section>
    </main>
  );
}
