"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, errorMessage, post } from "@/lib/api";
import { useLanguage } from "@/components/LanguageProvider";
import {
  AdminSection,
  AdminShell,
  Field,
  buttonClass,
  inputClass,
} from "@/components/admin/AdminShell";
import { ArrowRightIcon } from "@/components/icons";

type Row = {
  id: number;
  titleIt: string;
  titleEn: string;
  subtitleIt: string | null;
  questionCount: number;
  materialCount: number;
  usedInCourses: number;
};

export default function CataloguePage() {
  const { t } = useLanguage();
  const [lessons, setLessons] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [reloads, setReloads] = useState(0);
  const reload = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await api<{ lessons: Row[] }>("/api/admin/catalogue");
      if (cancelled) return;
      if (result.ok) setLessons(result.data.lessons);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloads]);

  return (
    <AdminShell
      title="Catalogo lezioni"
      backHref="/relatore"
      backLabel={t.adminArea}
    >
      <AdminSection
        title="Le lezioni"
        hint="Scritte una volta e riusabili in quanti corsi vuoi. Modificare una lezione qui la modifica in tutti i corsi che la usano — è contenuto condiviso, non copie separate. Una lezione usata da un corso non si può cancellare: porterebbe con sé i tentativi già svolti."
      >
        <ul className="flex flex-col gap-2.5">
          {lessons.map((lesson) => (
            <li key={lesson.id}>
              <Link
                href={`/relatore/catalogo/${lesson.id}`}
                className="card lift press flex items-center justify-between gap-4 p-4 transition-transform"
              >
                <span className="min-w-0">
                  <span className="block font-serif text-lg text-cream">
                    {lesson.titleIt}
                  </span>
                  <span className="mt-0.5 block text-xs text-cream/45">
                    {lesson.questionCount} domande · {lesson.materialCount}{" "}
                    dispense ·{" "}
                    {lesson.usedInCourses === 0
                      ? "non usata da nessun corso"
                      : `usata in ${lesson.usedInCourses} cors${lesson.usedInCourses === 1 ? "o" : "i"}`}
                  </span>
                </span>
                <ArrowRightIcon className="h-5 w-5 shrink-0 text-gold" />
              </Link>
            </li>
          ))}
        </ul>

        {loaded && lessons.length === 0 && (
          <p className="card p-5 text-sm text-cream/45">
            Il catalogo è vuoto. Scrivi la prima lezione qui sotto.
          </p>
        )}
      </AdminSection>

      <NewLesson onCreated={reload} />
    </AdminShell>
  );
}

function NewLesson({ onCreated }: { onCreated: () => void }) {
  const { t } = useLanguage();
  const [titleIt, setTitleIt] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [subtitleIt, setSubtitleIt] = useState("");
  const [subtitleEn, setSubtitleEn] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function create() {
    setMsg(null);
    const result = await post<{ id: number }>("/api/admin/catalogue", {
      titleIt,
      titleEn,
      subtitleIt: subtitleIt || null,
      subtitleEn: subtitleEn || null,
    });
    if (result.ok) {
      setTitleIt("");
      setTitleEn("");
      setSubtitleIt("");
      setSubtitleEn("");
      onCreated();
    } else {
      setMsg(errorMessage(result, t));
    }
  }

  return (
    <AdminSection title="Nuova lezione">
      <div className="card p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Titolo (italiano)">
            <input
              value={titleIt}
              onChange={(e) => setTitleIt(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Titolo (inglese)">
            <input
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              className={inputClass}
              placeholder="Se vuoto, usa l'italiano"
            />
          </Field>
          <Field label="Sottotitolo (italiano)">
            <input
              value={subtitleIt}
              onChange={(e) => setSubtitleIt(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Sottotitolo (inglese)">
            <input
              value={subtitleEn}
              onChange={(e) => setSubtitleEn(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={create}
            disabled={!titleIt.trim()}
            className={buttonClass}
          >
            Crea lezione
          </button>
          {msg && <span className="text-sm text-red-300">{msg}</span>}
        </div>
      </div>
    </AdminSection>
  );
}
