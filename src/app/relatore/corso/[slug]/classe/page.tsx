"use client";

import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLanguage } from "@/components/LanguageProvider";
import { AdminSection, AdminShell } from "@/components/admin/AdminShell";

type ClassOverview = {
  totalPoints: number;
  students: {
    name: string;
    email: string;
    totalScore: number;
    doneCount: number;
    byLesson: Record<string, { score: number; maxScore: number } | null>;
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

export default function ClassPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { t } = useLanguage();
  const [data, setData] = useState<ClassOverview | null>(null);

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
  }, [slug]);

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
        hint="Una riga per iscritto, una colonna per lezione. Il punteggio compare solo per le lezioni già consegnate."
      >
        {data.students.length === 0 ? (
          <p className="card p-5 text-sm text-cream/45">
            Nessun iscritto, per ora.
          </p>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-gold/15 text-left">
                  <th className="p-3 font-medium text-cream/60">Corsista</th>
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
                    key={s.email}
                    className="border-b border-cream/5 last:border-0"
                  >
                    <td className="p-3">
                      <span className="block text-cream">{s.name}</span>
                      <span className="block text-xs text-cream/40">
                        {s.email}
                      </span>
                    </td>
                    {data.lessons.map((l) => {
                      const cell = s.byLesson[l.courseLessonId];
                      return (
                        <td
                          key={l.courseLessonId}
                          className="p-3 text-center tabular-nums"
                        >
                          {cell ? (
                            <span className="text-cream/85">
                              {cell.score}
                              <span className="text-cream/30">
                                /{cell.maxScore}
                              </span>
                            </span>
                          ) : (
                            <span className="text-cream/20">—</span>
                          )}
                        </td>
                      );
                    })}
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
      </AdminSection>

      <AdminSection
        title="Domande andate peggio"
        hint="Percentuale di risposte corrette sull'intera classe, dalla più sbagliata in giù. È il modo più diretto per capire quali argomenti non sono passati e su cui vale la pena tornare la serata dopo."
      >
        {data.questions.length === 0 ? (
          <p className="card p-5 text-sm text-cream/45">
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
                <p className="mt-1.5 text-xs text-cream/40">
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
