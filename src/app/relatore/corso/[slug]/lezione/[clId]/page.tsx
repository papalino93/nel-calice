"use client";

import { use, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { AdminShell } from "@/components/admin/AdminShell";

type Status = "non_iniziato" | "in_corso" | "consegnato" | "scaduto";

type Overview = {
  courseLessonId: string;
  lessonTitleIt: string;
  isExam: boolean;
  totalQuestions: number;
  students: {
    enrollmentId: string;
    name: string;
    status: Status;
    answeredCount: number;
    correctCount: number;
    secondsRemaining: number | null;
  }[];
  questions: {
    questionId: number;
    position: number;
    textIt: string;
    correct: number;
    incorrect: number;
    unanswered: number;
  }[];
};

const POLL_MS = 4000;

const STATUS_LABEL: Record<Status, string> = {
  non_iniziato: "Non iniziato",
  in_corso: "In corso",
  consegnato: "Consegnato",
  scaduto: "Scaduto",
};

const STATUS_DOT: Record<Status, string> = {
  non_iniziato: "bg-cream/20",
  in_corso: "bg-gold animate-pulse",
  consegnato: "bg-emerald-400",
  scaduto: "bg-red-400",
};

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Cosa succede in aula proprio ora, su questa lezione (§7.19). Fa polling
 * da sola ogni pochi secondi: non c'è un pulsante «Aggiorna» perché il
 * punto è guardarla mentre la classe risponde, non ricaricarla a mano.
 */
export default function LiveLessonPage({
  params,
}: {
  params: Promise<{ slug: string; clId: string }>;
}) {
  const { slug, clId } = use(params);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const latestRequest = useRef(0);

  useEffect(() => {
    let stopped = false;

    async function tick() {
      const id = ++latestRequest.current;
      const result = await api<Overview>(
        `/api/admin/courses/${slug}/lessons/${clId}/live`,
      );
      // Una risposta arrivata in ritardo, dopo una più recente, si scarta:
      // altrimenti un giro lento potrebbe sovrascrivere dati più freschi.
      if (stopped || id !== latestRequest.current) return;
      if (result.ok) {
        setData(result.data);
        setUpdatedAt(new Date());
        setError(null);
      } else {
        setError("Non è stato possibile aggiornare.");
      }
    }

    void tick();
    const timer = window.setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [slug, clId]);

  if (!data) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-cream/50">Caricamento…</p>
      </main>
    );
  }

  const counts = data.students.reduce(
    (acc, s) => {
      acc[s.status] += 1;
      return acc;
    },
    { non_iniziato: 0, in_corso: 0, consegnato: 0, scaduto: 0 } as Record<Status, number>,
  );

  return (
    <AdminShell
      title={`In diretta · ${data.lessonTitleIt}`}
      backHref={`/relatore/corso/${slug}`}
      backLabel="Corso"
    >
      <div className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-cream/60">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-gold animate-pulse" />
          Si aggiorna da sola ogni {POLL_MS / 1000} secondi
        </span>
        {updatedAt && (
          <span>
            · ultimo aggiornamento{" "}
            {updatedAt.toLocaleTimeString("it-IT", { timeStyle: "medium" })}
          </span>
        )}
        {error && <span className="text-red-300">· {error}</span>}
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="In corso" value={counts.in_corso} tone="gold" />
        <SummaryStat
          label="Consegnati"
          value={counts.consegnato}
          tone="emerald"
        />
        <SummaryStat label="Scaduti" value={counts.scaduto} tone="red" />
        <SummaryStat
          label="Non iniziati"
          value={counts.non_iniziato}
          tone="cream"
        />
      </div>

      <section>
        <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-gold/80">
          Corsisti
        </h2>
        {data.students.length === 0 ? (
          <p className="card mt-3 p-5 text-sm text-cream/60">
            Nessun iscritto, per ora.
          </p>
        ) : (
          <div className="card mt-3 overflow-x-auto p-0">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b border-gold/15 text-left">
                  <th className="p-3 font-medium text-cream/60">Corsista</th>
                  <th className="p-3 text-center font-medium text-cream/60">
                    Stato
                  </th>
                  <th className="p-3 text-center font-medium text-cream/60">
                    Risposte
                  </th>
                  <th className="p-3 text-center font-medium text-cream/60">
                    Corrette
                  </th>
                  <th className="p-3 text-right font-medium text-cream/60">
                    Tempo
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((s) => (
                  <tr
                    key={s.enrollmentId}
                    className="border-b border-cream/5 last:border-0"
                  >
                    <td className="p-3 text-cream">{s.name}</td>
                    <td className="p-3 text-center">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 rounded-full ${STATUS_DOT[s.status]}`}
                        />
                        <span className="text-cream/70">
                          {STATUS_LABEL[s.status]}
                        </span>
                      </span>
                    </td>
                    <td className="p-3 text-center tabular-nums text-cream/85">
                      {s.answeredCount}/{data.totalQuestions}
                    </td>
                    <td className="p-3 text-center tabular-nums text-gold">
                      {s.correctCount}
                    </td>
                    <td className="p-3 text-right tabular-nums text-cream/70">
                      {s.secondsRemaining !== null
                        ? formatClock(s.secondsRemaining)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-9">
        <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-gold/80">
          Domande
        </h2>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-cream/60">
          Corrette, sbagliate e in bianco contate su tutti i tentativi di
          questa lezione, anche quelli ancora in corso — si aggiorna mentre
          la classe risponde, non solo a consegna avvenuta.
        </p>
        {data.questions.length === 0 ? (
          <p className="card mt-3 p-5 text-sm text-cream/60">
            Questa lezione non ha ancora domande.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {data.questions.map((q) => {
              const total = q.correct + q.incorrect + q.unanswered;
              return (
                <li key={q.questionId} className="card p-4">
                  <p className="text-sm text-cream/85">
                    {q.position}. {q.textIt}
                  </p>
                  <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-cream/10">
                    {total > 0 && (
                      <>
                        <div
                          className="h-full bg-emerald-400"
                          style={{ width: `${(q.correct / total) * 100}%` }}
                        />
                        <div
                          className="h-full bg-red-400"
                          style={{ width: `${(q.incorrect / total) * 100}%` }}
                        />
                      </>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-cream/60">
                    {q.correct} corrette · {q.incorrect} sbagliate ·{" "}
                    {q.unanswered} in bianco
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "gold" | "emerald" | "red" | "cream";
}) {
  const color = {
    gold: "text-gold",
    emerald: "text-emerald-300",
    red: "text-red-300",
    cream: "text-cream/70",
  }[tone];
  return (
    <div className="card p-4">
      <p className={`font-serif text-2xl tabular-nums ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-cream/60">{label}</p>
    </div>
  );
}
