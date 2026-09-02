"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage, post } from "@/lib/api";
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
  const [savingAnswer, setSavingAnswer] = useState(false);
  // Un guasto durante il quiz non deve buttare fuori dalla prova: si mostra
  // in fondo, sopra il pulsante, e il quiz resta dov'è.
  const [notice, setNotice] = useState<string | null>(null);

  // Evita doppie consegne se il timer scade mentre l'utente preme "Consegna".
  const submittedRef = useRef(false);
  // Il salvataggio della risposta corrente, se ancora in volo: "Avanti" (e
  // quindi "Consegna" sull'ultima domanda) lo aspetta prima di proseguire,
  // altrimenti su una rete lenta si può consegnare prima che il server
  // abbia registrato l'ultima scelta (§7.16).
  const pendingSaveRef = useRef<Promise<unknown> | null>(null);

  const submit = useCallback(async () => {
    if (submittedRef.current || !attempt) return;
    submittedRef.current = true;
    setSubmitting(true);

    // Copre anche la consegna automatica allo scadere del timer: se il
    // tempo finisce mentre l'ultima risposta è ancora in volo, si aspetta
    // comunque che arrivi prima di chiedere al server di chiudere.
    if (pendingSaveRef.current) await pendingSaveRef.current;

    // Il client non manda punteggi: chiede solo di chiudere. Il server
    // corregge da sé, con le risposte già salvate (§7.4).
    const result = await post(
      `/api/courses/${slug}/attempts/${attempt.attemptId}/submit`,
    );

    // Se la consegna non arriva, il tentativo è ancora aperto sul server:
    // mandare comunque alla pagina del risultato faceva credere di aver
    // consegnato, e `submittedRef` impediva per sempre di riprovare. Qui si
    // riapre il pulsante e si dice cosa è successo. Il 409 è l'eccezione:
    // vuol dire che il tentativo era già chiuso (timer scattato altrove),
    // quindi il risultato c'è davvero e si può andare a vederlo.
    if (!result.ok && result.status !== 409) {
      submittedRef.current = false;
      setSubmitting(false);
      setNotice(result.offline ? t.networkError : t.submitFailed);
      return;
    }

    router.replace(`/corso/${slug}/lezione/${clId}/risultato`);
  }, [attempt, slug, clId, router, t]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await post<AttemptView>(
        `/api/courses/${slug}/lessons/${clId}/attempt`,
      );
      if (cancelled) return;

      if (!result.ok) {
        // 409 vale per due cose diverse: «l'hai già fatta» (e allora il
        // risultato esiste, si va a vederlo) e «questa lezione non ha
        // ancora domande» — che mandato al risultato diventava un vicolo
        // cieco, perché di tentativo non ce n'è nessuno. Si distinguono
        // sul codice mandato dal server, non sullo stato HTTP.
        if (result.status === 409 && result.error !== "empty") {
          router.replace(`/corso/${slug}/lezione/${clId}/risultato`);
          return;
        }
        // Il server manda un codice, non una frase: così la stessa causa si
        // legge nella lingua scelta invece che sempre in italiano.
        const byReason: Record<string, string> = {
          empty: t.lessonEmptyTitle,
          locked: t.lessonLocked,
          not_found: t.lessonNotFound,
        };
        setError(byReason[result.error] ?? errorMessage(result, t));
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
    setNotice(null);
    // Salvataggio immediato: allo scadere del tempo il server ha già in mano
    // le risposte date entro il termine.
    setSavingAnswer(true);
    const request = post(
      `/api/courses/${slug}/attempts/${attempt!.attemptId}/answer`,
      { questionId: question.id, selectedOptionId: optionId },
    ).finally(() => setSavingAnswer(false));
    pendingSaveRef.current = request;
    const result = await request;

    // Un salvataggio fallito passava inosservato: l'opzione si accendeva
    // d'oro e alla consegna quella risposta risultava «lasciata in bianco».
    // Va detto subito, mentre si può ancora ritoccare.
    if (!result.ok) {
      setNotice(result.offline ? t.networkError : t.answerNotSaved);
    }
  }

  async function next() {
    // Aspetta che la risposta corrente sia arrivata al server prima di
    // avanzare — è il punto in cui, senza questa attesa, un tocco veloce su
    // rete lenta poteva consegnare senza l'ultima scelta.
    if (pendingSaveRef.current) await pendingSaveRef.current;
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

    const result = await api(
      `/api/courses/${slug}/attempts/${attempt!.attemptId}`,
      { method: "DELETE" },
    );

    // Il server rifiuta di abbandonare un tentativo il cui tempo è già
    // scaduto (giusto: altrimenti si cancellava e si ripartiva da capo con
    // l'orologio intero). Ma in quel caso la promessa appena fatta col
    // conferma — "non verrà registrato nulla" — diventa falsa: al prossimo
    // tocco quel tentativo si chiude da sé come scaduto, con le risposte già
    // date. Meglio dirlo qui che lasciarlo scoprire dopo.
    // Con la rete assente, però, non è «troppo tardi»: non è successo
    // niente, e il quiz è ancora lì. Mandare via dicendo che il tentativo
    // conterà come concluso sarebbe falso al contrario.
    if (!result.ok) {
      if (result.offline) {
        setNotice(t.exitFailed);
        return;
      }
      window.alert(t.exitTooLate);
    }

    router.push(`/corso/${slug}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pt-6 sm:px-8">
      {/* Il tempo che resta non deve mai scorrere fuori dallo schermo: con
          cinque o sei opzioni la pagina supera l'altezza di un telefono, e
          durante una prova a tempo quel numero è l'informazione che conta
          di più. Resta in cima, e più grande sul telefono. */}
      <div className="sticky top-0 z-20 -mx-5 flex items-center justify-between gap-4 bg-charcoal/95 px-5 pb-2 backdrop-blur sm:-mx-8 sm:px-8">
        <button
          onClick={exit}
          className="press text-sm text-cream/55 transition-colors hover:text-cream"
        >
          ⎋ {t.exit}
        </button>
        <span
          className={`inline-flex items-center gap-2 text-base font-medium tabular-nums transition-colors sm:text-sm ${
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

      {/* Come il timer: con molte opzioni il pulsante finiva sotto la piega,
          e si sceglieva la risposta senza vedere come proseguire. Il fondo
          generoso tiene il pulsante donazione fuori dai piedi. */}
      <div className="sticky bottom-0 z-20 -mx-5 mt-auto bg-charcoal/95 px-5 pt-4 pb-20 backdrop-blur sm:-mx-8 sm:px-8">
        {/* Sta qui, appiccicato al pulsante, perché è qui che si guarda nel
            momento in cui qualcosa non è andato: una risposta non salvata o
            una consegna non arrivata. */}
        {notice && (
          <p
            role="alert"
            className="mb-3 rounded-[10px] border border-red-400/35 bg-red-400/10 px-4 py-2.5 text-sm leading-snug text-red-200"
          >
            {notice}
          </p>
        )}
        <button
          onClick={() => void next()}
          disabled={selected === null || submitting || savingAnswer}
          className="press lift flex w-full items-center justify-center gap-2 rounded-full bg-gold px-6 py-3.5 font-medium text-charcoal transition-all disabled:cursor-not-allowed disabled:opacity-35"
        >
          {isLast ? t.finish : t.next}
        </button>
      </div>
    </main>
  );
}
