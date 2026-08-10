"use client";

import { use, useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useLanguage } from "@/components/LanguageProvider";
import { AdminSection, AdminShell } from "@/components/admin/AdminShell";

type ClassOverview = {
  totalPoints: number;
  students: {
    enrollmentId: string;
    name: string;
    email: string;
    totalScore: number;
    doneCount: number;
    byLesson: Record<string, Cell>;
  }[];
  lessons: {
    courseLessonId: string;
    position: number;
    titleIt: string;
    isExam: boolean;
  }[];
  questions: {
    questionId: number;
    textIt: string;
    answered: number;
    correct: number;
    correctRate: number;
  }[];
};

type Cell =
  | { inProgress: true; score: null; maxScore: null }
  | { inProgress: false; score: number; maxScore: number }
  | null;

export default function ClassPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { t } = useLanguage();
  const [data, setData] = useState<ClassOverview | null>(null);
  const [reloads, setReloads] = useState(0);
  const reload = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await api<ClassOverview>(
        `/api/admin/courses/${slug}/class`,
      );
      if (!cancelled && result.ok) setData(result.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, reloads]);

  if (!data) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-cream/50">{t.checkingSession}</p>
      </main>
    );
  }

  return (
    <AdminShell
      title="Andamento della classe"
      backHref={`/relatore/corso/${slug}`}
      backLabel="Corso"
    >
      <AdminSection
        title="Chi ha fatto cosa"
        hint="Una riga per iscritto, una colonna per lezione. Il punteggio compare solo per le lezioni già consegnate. Su un tentativo — in corso o già consegnato — puoi azzerarlo perché lo rifaccia: serve per un click su «inizia» per sbaglio, o un tentativo mai davvero svolto. Il corsista non può farlo da solo."
      >
        {data.students.length === 0 ? (
          <p className="card p-5 text-sm text-cream/60">
            Nessun iscritto, per ora.
          </p>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-gold/15 text-left">
                  <th className="sticky left-0 z-10 border-r border-gold/10 bg-charcoal-soft p-3 font-medium text-cream/60">
                    Corsista
                  </th>
                  {data.lessons.map((l) => (
                    <th
                      key={l.courseLessonId}
                      className="p-3 text-center font-medium text-cream/60"
                      title={l.titleIt}
                    >
                      {l.isExam ? "★" : l.position}
                    </th>
                  ))}
                  <th className="p-3 text-right font-medium text-gold/80">
                    Totale
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((s) => (
                  <tr
                    key={s.enrollmentId}
                    className="border-b border-cream/5 last:border-0"
                  >
                    <td className="sticky left-0 z-10 border-r border-gold/10 bg-charcoal-soft p-3">
                      <span className="block text-cream">{s.name}</span>
                      <span className="block text-xs text-cream/60">
                        {s.email}
                      </span>
                    </td>
                    {data.lessons.map((l) => (
                      <StudentCell
                        key={l.courseLessonId}
                        slug={slug}
                        enrollmentId={s.enrollmentId}
                        courseLessonId={l.courseLessonId}
                        cell={s.byLesson[l.courseLessonId]}
                        onReset={reload}
                      />
                    ))}
                    <td className="p-3 text-right font-serif text-lg text-gold tabular-nums">
                      {s.totalScore}
                      <span className="text-cream/30">
                        /{data.totalPoints}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Il `title` sulle intestazioni numeriche non esiste al tocco: chi
            usa un telefono o un tablet non ha modo di sapere a quale
            lezione corrisponda ogni colonna senza questa legenda. */}
        {data.lessons.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-cream/60">
            {data.lessons.map((l) => (
              <span key={l.courseLessonId}>
                <span className="text-gold/80">
                  {l.isExam ? "★" : l.position}
                </span>{" "}
                {l.titleIt}
              </span>
            ))}
          </p>
        )}
      </AdminSection>

      <AdminSection
        title="Domande andate peggio"
        hint="Percentuale di risposte corrette sull'intera classe, dalla più sbagliata in giù. È il modo più diretto per capire quali argomenti non sono passati e su cui vale la pena tornare la serata dopo."
      >
        {data.questions.length === 0 ? (
          <p className="card p-5 text-sm text-cream/60">
            Nessuna risposta registrata, per ora.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.questions.map((q) => (
              <li key={q.questionId} className="card p-4">
                <div className="flex items-start justify-between gap-4">
                  <p className="min-w-0 text-sm text-cream/85">{q.textIt}</p>
                  <span
                    className={`shrink-0 font-serif text-lg tabular-nums ${
                      q.correctRate >= 70
                        ? "text-emerald-300"
                        : q.correctRate >= 40
                          ? "text-gold"
                          : "text-red-300"
                    }`}
                  >
                    {Math.round(q.correctRate)}%
                  </span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-cream/10">
                  <div
                    className={`h-full rounded-full ${
                      q.correctRate >= 70
                        ? "bg-emerald-400"
                        : q.correctRate >= 40
                          ? "bg-gold"
                          : "bg-red-400"
                    }`}
                    style={{ width: `${q.correctRate}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-cream/60">
                  {q.correct} su {q.answered} risposte
                </p>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>
    </AdminShell>
  );
}

/**
 * Una cella della tabella: il punteggio (o "in corso", o "—"), più
 * l'azzeramento quando c'è un tentativo da rifare.
 *
 * Il pulsante sta dietro un tocco in più apposta: è un'azione che tocca il
 * lavoro di un'altra persona, e non deve essere a un clic di distanza da un
 * numero che si sta solo leggendo.
 */
function StudentCell({
  slug,
  enrollmentId,
  courseLessonId,
  cell,
  onReset,
}: {
  slug: string;
  enrollmentId: string;
  courseLessonId: string;
  cell: Cell;
  onReset: () => void;
}) {
  const { t } = useLanguage();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function reset() {
    setBusy(true);
    setMsg(null);
    const result = await api(`/api/admin/courses/${slug}/class/attempts`, {
      method: "DELETE",
      body: JSON.stringify({ enrollmentId, courseLessonId }),
    });
    setBusy(false);
    if (result.ok) {
      setConfirming(false);
      onReset();
    } else {
      setMsg(errorMessage(result, t));
    }
  }

  if (confirming) {
    return (
      <td className="p-2 text-center">
        <div className="inline-flex items-center gap-1.5">
          <button
            onClick={reset}
            disabled={busy}
            className="press rounded-full bg-red-400/15 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-400/25"
          >
            Conferma
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="press rounded-full px-2 py-1.5 text-xs text-cream/60 hover:text-cream/70"
          >
            Annulla
          </button>
        </div>
        {msg && <p className="mt-1 text-[0.65rem] text-red-300">{msg}</p>}
      </td>
    );
  }

  return (
    <td className="p-3 text-center tabular-nums">
      <span className="inline-flex items-center gap-1.5">
        {cell === null ? (
          <span className="text-cream/20">—</span>
        ) : cell.inProgress ? (
          <span className="text-xs text-gold/70">in corso</span>
        ) : (
          <span className="text-cream/85">
            {cell.score}
            <span className="text-cream/30">/{cell.maxScore}</span>
          </span>
        )}
        {cell !== null && (
          // Sempre visibile, non solo al passaggio del mouse: su tablet e
          // telefono non esiste un hover da cui farlo comparire, e sarebbe
          // altrimenti irraggiungibile col tocco.
          <button
            onClick={() => setConfirming(true)}
            title="Azzera il tentativo, perché lo rifaccia"
            aria-label="Azzera il tentativo"
            className="press grid min-h-8 min-w-8 place-items-center rounded-full text-sm text-cream/25 transition-colors hover:text-red-300"
          >
            ↺
          </button>
        )}
      </span>
    </td>
  );
}
