"use client";

import { use, useCallback, useEffect, useState } from "react";
import { api, errorMessage, post } from "@/lib/api";
import { useLanguage } from "@/components/LanguageProvider";
import {
  AdminSection,
  AdminShell,
  Field,
  buttonClass,
  ghostButtonClass,
  inputClass,
} from "@/components/admin/AdminShell";
import { CheckIcon, CrossIcon } from "@/components/icons";
import { MaterialsSection } from "@/components/admin/MaterialsSection";

type OptionRow = {
  id: number;
  textIt: string;
  textEn: string;
  isCorrect: boolean;
};

type QuestionRow = {
  id: number;
  textIt: string;
  textEn: string;
  position: number;
  options: OptionRow[];
};

type LessonDetail = {
  id: number;
  titleIt: string;
  titleEn: string;
  subtitleIt: string | null;
  subtitleEn: string | null;
  notes: string | null;
  questions: QuestionRow[];
};

/** Bozza di una domanda mentre la si scrive. */
type Draft = {
  textIt: string;
  textEn: string;
  options: { textIt: string; textEn: string; isCorrect: boolean }[];
};

function draftFrom(q: QuestionRow): Draft {
  return {
    textIt: q.textIt,
    textEn: q.textEn,
    options: q.options.map((o) => ({
      textIt: o.textIt,
      textEn: o.textEn,
      isCorrect: o.isCorrect,
    })),
  };
}

const emptyDraft: Draft = {
  textIt: "",
  textEn: "",
  options: [
    { textIt: "", textEn: "", isCorrect: true },
    { textIt: "", textEn: "", isCorrect: false },
  ],
};

export default function LessonEditorPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = use(params);
  const { t } = useLanguage();

  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [reloads, setReloads] = useState(0);
  const reload = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await api<LessonDetail>(
        `/api/admin/catalogue/${lessonId}`,
      );
      if (cancelled) return;
      if (result.ok) setLesson(result.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId, reloads]);

  if (!lesson) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-cream/50">{t.checkingSession}</p>
      </main>
    );
  }

  return (
    <AdminShell
      title={lesson.titleIt}
      backHref="/relatore/catalogo"
      backLabel="Catalogo"
    >
      <LessonFields lesson={lesson} onSaved={reload} />

      <AdminSection
        title="Domande"
        hint="Le domande appartengono alla lezione, non al corso: valgono per ogni corso che la usa. Quanto vale ciascuna dipende invece dal corso, e si vede nella pagina del corso. Una domanda a cui qualcuno ha già risposto non è più modificabile: cambiarla falserebbe punteggi già assegnati."
      >
        <ul className="flex flex-col gap-3">
          {lesson.questions.map((question, i) => (
            <QuestionEditor
              key={question.id}
              lessonId={lesson.id}
              question={question}
              index={i}
              onChanged={reload}
            />
          ))}
        </ul>

        {lesson.questions.length === 0 && (
          <p className="card p-5 text-sm text-cream/45">
            Nessuna domanda, per ora.
          </p>
        )}
      </AdminSection>

      <NewQuestion lessonId={lesson.id} onCreated={reload} />

      <MaterialsSection lessonId={lesson.id} />
    </AdminShell>
  );
}

function LessonFields({
  lesson,
  onSaved,
}: {
  lesson: LessonDetail;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const [titleIt, setTitleIt] = useState(lesson.titleIt);
  const [titleEn, setTitleEn] = useState(lesson.titleEn);
  const [subtitleIt, setSubtitleIt] = useState(lesson.subtitleIt ?? "");
  const [subtitleEn, setSubtitleEn] = useState(lesson.subtitleEn ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setMsg(null);
    const result = await api(`/api/admin/catalogue/${lesson.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        titleIt,
        titleEn,
        subtitleIt: subtitleIt || null,
        subtitleEn: subtitleEn || null,
      }),
    });
    if (result.ok) {
      setMsg("Salvato.");
      onSaved();
    } else setMsg(errorMessage(result, t));
  }

  return (
    <AdminSection title="Titoli">
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
          <button onClick={save} className={buttonClass}>
            Salva
          </button>
          {msg && <span className="text-xs text-cream/60">{msg}</span>}
        </div>
      </div>
    </AdminSection>
  );
}

function QuestionEditor({
  lessonId,
  question,
  index,
  onChanged,
}: {
  lessonId: number;
  question: QuestionRow;
  index: number;
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(question));
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMsg(null);
    const result = await api(
      `/api/admin/catalogue/${lessonId}/questions/${question.id}`,
      { method: "PUT", body: JSON.stringify(draft) },
    );
    setBusy(false);
    if (result.ok) {
      setOpen(false);
      onChanged();
    } else setMsg(errorMessage(result, t));
  }

  async function remove() {
    if (!window.confirm("Eliminare questa domanda?")) return;
    setBusy(true);
    setMsg(null);
    const result = await api(
      `/api/admin/catalogue/${lessonId}/questions/${question.id}`,
      { method: "DELETE" },
    );
    setBusy(false);
    if (result.ok) onChanged();
    else setMsg(errorMessage(result, t));
  }

  return (
    <li className="card p-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <span className="min-w-0 text-cream">
          {index + 1}. {question.textIt || "(senza testo)"}
        </span>
        <span className="shrink-0 text-cream/40">{open ? "▾" : "›"}</span>
      </button>

      {open && (
        <div className="mt-4">
          <DraftFields draft={draft} setDraft={setDraft} />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={save} disabled={busy} className={buttonClass}>
              Salva domanda
            </button>
            <button
              onClick={() => {
                setDraft(draftFrom(question));
                setOpen(false);
              }}
              className={ghostButtonClass}
            >
              Annulla
            </button>
            <button
              onClick={remove}
              disabled={busy}
              className="press ml-auto text-xs text-red-300/80 underline underline-offset-4 hover:text-red-300"
            >
              Elimina domanda
            </button>
          </div>

          {msg && <p className="mt-3 text-sm text-red-300">{msg}</p>}
        </div>
      )}
    </li>
  );
}

function NewQuestion({
  lessonId,
  onCreated,
}: {
  lessonId: number;
  onCreated: () => void;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [msg, setMsg] = useState<string | null>(null);

  async function create() {
    setMsg(null);
    const result = await post(
      `/api/admin/catalogue/${lessonId}/questions`,
      draft,
    );
    if (result.ok) {
      setDraft(emptyDraft);
      onCreated();
    } else setMsg(errorMessage(result, t));
  }

  return (
    <AdminSection title="Nuova domanda">
      <div className="card p-5">
        <DraftFields draft={draft} setDraft={setDraft} />
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={create}
            disabled={!draft.textIt.trim()}
            className={buttonClass}
          >
            Aggiungi domanda
          </button>
          {msg && <span className="text-sm text-red-300">{msg}</span>}
        </div>
      </div>
    </AdminSection>
  );
}

/** Campi condivisi fra modifica e creazione di una domanda. */
function DraftFields({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
}) {
  function setOption(i: number, patch: Partial<Draft["options"][number]>) {
    setDraft({
      ...draft,
      options: draft.options.map((o, j) => (j === i ? { ...o, ...patch } : o)),
    });
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Domanda (italiano)">
          <textarea
            value={draft.textIt}
            onChange={(e) => setDraft({ ...draft, textIt: e.target.value })}
            rows={2}
            className={inputClass}
          />
        </Field>
        <Field label="Domanda (inglese)">
          <textarea
            value={draft.textEn}
            onChange={(e) => setDraft({ ...draft, textEn: e.target.value })}
            rows={2}
            className={inputClass}
            placeholder="Se vuoto, usa l'italiano"
          />
        </Field>
      </div>

      <p className="mt-4 mb-2 text-xs text-cream/55">
        Opzioni — segna quella corretta
      </p>

      <ul className="flex flex-col gap-2">
        {draft.options.map((option, i) => (
          <li key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setDraft({
                  ...draft,
                  // Una sola corretta: sceglierne una toglie il segno all'altra.
                  options: draft.options.map((o, j) => ({
                    ...o,
                    isCorrect: j === i,
                  })),
                })
              }
              aria-label="Segna come corretta"
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors ${
                option.isCorrect
                  ? "border-gold bg-gold text-charcoal"
                  : "border-cream/25 text-transparent hover:border-gold/50"
              }`}
            >
              <CheckIcon className="h-3.5 w-3.5" />
            </button>

            <input
              value={option.textIt}
              onChange={(e) => setOption(i, { textIt: e.target.value })}
              placeholder="Testo (italiano)"
              className={inputClass}
            />
            <input
              value={option.textEn}
              onChange={(e) => setOption(i, { textEn: e.target.value })}
              placeholder="Inglese"
              className={inputClass}
            />

            <button
              type="button"
              onClick={() =>
                setDraft({
                  ...draft,
                  options: draft.options.filter((_, j) => j !== i),
                })
              }
              disabled={draft.options.length <= 2}
              aria-label="Elimina opzione"
              className="press shrink-0 text-cream/35 transition-colors hover:text-red-300 disabled:opacity-25"
            >
              <CrossIcon className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() =>
          setDraft({
            ...draft,
            options: [
              ...draft.options,
              { textIt: "", textEn: "", isCorrect: false },
            ],
          })
        }
        className="press mt-3 text-xs text-gold/80 underline underline-offset-4 hover:text-gold"
      >
        + Aggiungi opzione
      </button>
    </>
  );
}
