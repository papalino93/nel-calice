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
  options: { id: number; textIt: string; textEn: string }[];
  correctOptionId: number | null;
  selectedOptionId: number | null;
  isCorrect: boolean;
  pointsAwarded: number;
};

type Review = {
  score: number;
  maxScore: number;
  timedOut: boolean;
  questions: ReviewQuestion[];
};

export default function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { lang, t } = useLanguage();
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyErrors, setOnlyErrors] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // Si passa dalla lezione per ritrovare l'id del tentativo più recente.
      const lesson = await api<{ lesson: { attemptId: string | null } }>(
        `/api/lessons/${id}`,
      );
      if (cancelled) return;

      if (!lesson.ok || !lesson.data.lesson.attemptId) {
        setError(lesson.ok ? t.genericError : t.networkError);
        return;
      }

      const result = await api<Review>(
        `/api/attempts/${lesson.data.lesson.attemptId}`,
      );
      if (cancelled) return;

      if (result.ok) setReview(result.data);
      else setError(result.offline ? t.networkError : t.genericError);
    })();

    return () => {
      cancelled = true;
    };
  }, [id, t]);

  if (error) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-cream/70">{error}</p>
        <Link href="/" className="text-sm text-gold underline underline-offset-4">
          {t.backToLessons}
        </Link>
      </main>
    );
  }

  if (!review) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-cream/50">{t.checkingSession}</p>
      </main>
    );
  }

  const percent = percentage(review.score, review.maxScore);
  const shown = onlyErrors
    ? review.questions.filter((q) => !q.isCorrect)
    : review.questions;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-8">
      <div className="rise-in flex flex-col items-center text-center">
        <Seal size={96}>
          <GrapesIcon className="h-full w-full" />
        </Seal>

        {review.timedOut && (
          <p className="pill mt-5 bg-red-400/12 text-red-300">
            <ClockIcon className="h-3.5 w-3.5" />⏱ {t.timeUp}
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
                className={`press rounded-full px-3 py-1 transition-colors ${
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
                  <p className="mt-2 text-xs text-amber-300/80">
                    {t.leftBlank}
                  </p>
                )}

                <div className="mt-3 flex flex-col gap-1.5 text-sm">
                  {correct && (
                    <p className="flex items-start gap-2 text-gold">
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        <span className="text-cream/45">{t.correctAnswer}: </span>
                        {pick(lang, correct.textIt, correct.textEn)}
                      </span>
                    </p>
                  )}

                  {given && !question.isCorrect && (
                    <p className="flex items-start gap-2 text-red-300">
                      <CrossIcon className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        <span className="text-cream/45">{t.yourAnswer}: </span>
                        {pick(lang, given.textIt, given.textEn)}
                      </span>
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-8 text-center">
        <Link
          href="/"
          className="press lift inline-block rounded-full border border-gold/40 px-6 py-3 text-sm text-gold transition-transform"
        >
          {t.backToLessons}
        </Link>
      </div>
    </main>
  );
}
