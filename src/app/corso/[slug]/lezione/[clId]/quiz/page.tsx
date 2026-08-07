"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, post } from "@/lib/api";
import { pick } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { ClockIcon } from "@/components/icons";

type SafeQuestion = {
  id: number;
  textIt: string;
  textEn: string;
  options: { id: number; textIt: string; textEn: string }[];
  selectedOptionId: number | null;
};

type AttemptView = {
  attemptId: string;
  expiresAt: string;
  secondsRemaining: number;
  totalSeconds: number;
  questions: SafeQuestion[];
};

const LETTERS = "ABCDEFGH";

export default function QuizPage({
  params,
}: {
  params: Promise<{ slug: string; clId: string }>;
}) {
  const { slug, clId } = use(params);
  const { lang, t } = useLanguage();
  const router = useRouter();

  const [attempt, setAttempt] = useState<AttemptView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Evita doppie consegne se il timer scade mentre l'utente preme "Consegna".
  const submittedRef = useRef(false);

  const submit = useCallback(async () => {
    if (submittedRef.current || !attempt) return;
    submittedRef.current = true;
    setSubmitting(true);

    // Il client non manda punteggi: chiede solo di chiudere. Il server
    // corregge da sé, con le risposte già salvate (§7.4).
    await post(`/api/courses/${slug}/attempts/${attempt.attemptId}/submit`);
    router.replace(`/corso/${slug}/lezione/${clId}/risultato`);
  }, [attempt, slug, clId, router]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await post<AttemptView>(
        `/api/courses/${slug}/lessons/${clId}/attempt`,
      );
      if (cancelled) return;

      if (!result.ok) {
        if (result.status === 409) {
          router.replace(`/corso/${slug}/lezione/${clId}/risultato`);
          return;
        }
        setError(result.offline ? t.networkError : result.error);
        return;
      }

      setAttempt(result.data);
      setRemaining(result.data.secondsRemaining);

      // Riprendendo dopo un refresh si riparte dalla prima domanda ancora
      // senza risposta, non dall'inizio.
      const firstUnanswered = result.data.questions.findIndex(
        (q) => q.selectedOptionId === null,
      );
      const start = firstUnanswered === -1 ? 0 : firstUnanswered;
      setIndex(start);
      setSelected(result.data.questions[start]?.selectedOptionId ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, clId, router, t]);

  // Conto alla rovescia calcolato dalla scadenza assoluta decisa dal server:
  // ricaricare la pagina non lo azzera (§7.5).
  useEffect(() => {
    if (!attempt) return;

    const deadline = new Date(attempt.expiresAt).getTime();
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) void submit();
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [attempt, submit]);

  if (error) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-cream/70">{error}</p>
        <button
          onClick={() => router.push(`/corso/${slug}`)}
          className="press rounded-full border border-cream/20 px-5 py-2 text-sm text-cream/70"
        >
          {t.backToLessons}
        </button>
      </main>
    );
  }

  if (!attempt || remaining === null) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-cream/50">{t.checkingSession}</p>
      </main>
    );
  }

  const question = attempt.questions[index];
  const total = attempt.questions.length;
  const isLast = index === total - 1;

  const totalSeconds = Math.max(1, attempt.totalSeconds);
  const ratio = Math.min(1, Math.max(0, remaining / totalSeconds));
  // Sotto il 20% del tempo la barra si colora di rosso (§3.4).
  const low = ratio <= 0.2;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  async function choose(optionId: number) {
    setSelected(optionId);
    // Salvataggio immediato: allo scadere del tempo il server ha già in mano
    // le risposte date entro il termine.
    await post(`/api/courses/${slug}/attempts/${attempt!.attemptId}/answer`, {
      questionId: question.id,
      selectedOptionId: optionId,
    });
  }

  function next() {
    if (isLast) {
      void submit();
      return;
    }
    const nextIndex = index + 1;
    setIndex(nextIndex);
    setSelected(attempt!.questions[nextIndex]?.selectedOptionId ?? null);
  }

  async function exit() {
    if (!window.confirm(t.exitConfirm)) return;
    await api(`/api/courses/${slug}/attempts/${attempt!.attemptId}`, {
      method: "DELETE",
    });
    router.push(`/corso/${slug}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-6 sm:px-8">
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={exit}
          className="press text-sm text-cream/55 transition-colors hover:text-cream"
        >
          ⎋ {t.exit}
        </button>
        <span
          className={`inline-flex items-center gap-2 text-sm tabular-nums transition-colors ${
            low ? "text-red-300" : "text-cream/70"
          }`}
          role="timer"
          aria-live="off"
        >
          <ClockIcon className="h-3.5 w-3.5 opacity-60" />
          {minutes}:{String(seconds).padStart(2, "0")}
        </span>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream/10">
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
            low ? "bg-red-400" : "progress-fill"
          }`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>

      <p className="mt-5 text-[0.65rem] font-medium uppercase tracking-[0.16em] text-gold/70">
        {t.questionOf(index + 1, total)}
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-cream/10">
        <div
          className="progress-fill h-full rounded-full transition-[width] duration-300"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      {/* La domanda su fondo chiaro: unico elemento crema della pagina, si
          legge subito anche su un telefono in una sala poco illuminata. */}
      <h1
        key={question.id}
        className="rise-in mt-6 rounded-[16px] border border-gold/45 bg-cream-soft px-5 py-4 font-serif text-xl leading-snug text-charcoal sm:text-2xl"
      >
        {pick(lang, question.textIt, question.textEn)}
      </h1>

      <div className="mt-5 flex flex-col gap-2.5">
        {question.options.map((option, i) => {
          const chosen = selected === option.id;
          return (
            <button
              key={option.id}
              onClick={() => void choose(option.id)}
              aria-pressed={chosen}
              className={`press card flex items-center gap-3 p-4 text-left transition-colors ${
                chosen
                  ? "border-gold/70 bg-gold/12 text-cream"
                  : "text-cream/80 hover:border-gold/35"
              }`}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs transition-colors ${
                  chosen
                    ? "border-gold bg-gold text-charcoal"
                    : "border-cream/25 text-cream/50"
                }`}
              >
                {LETTERS[i] ?? i + 1}
              </span>
              {pick(lang, option.textIt, option.textEn)}
            </button>
          );
        })}
      </div>

      <div className="mt-auto pt-8">
        <button
          onClick={next}
          disabled={selected === null || submitting}
          className="press lift flex w-full items-center justify-center gap-2 rounded-full bg-gold px-6 py-3.5 font-medium text-charcoal transition-all disabled:cursor-not-allowed disabled:opacity-35"
        >
          {isLast ? t.finish : t.next}
        </button>
      </div>
    </main>
  );
}
