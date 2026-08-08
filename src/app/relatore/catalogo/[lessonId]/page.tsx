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

/** L'id della domanda selezionata, o "new" per il modulo di creazione. */
type Selection = number | "new";

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

  // Nessuna domanda selezionata finché non arrivano i dati: si parte dalla
  // prima già scritta, o dal modulo di creazione se la lezione è ancora vuota.
  const [selected, setSelected] = useState<Selection | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await api<LessonDetail>(
        `/api/admin/catalogue/${lessonId}`,
      );
      if (cancelled) return;
      if (result.ok) {
        setLesson(result.data);
        setSelected((current) =>
          current !== null
            ? current
            : (result.data.questions[0]?.id ?? "new"),
        );
      }
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

  // Una domanda appena eliminata non può restare selezionata: si ricade sulla
  // prima rimasta, o sul modulo di creazione se non ne resta nessuna.
  const selectedQuestion =
    typeof selected === "number"
      ? lesson.questions.find((q) => q.id === selected)
      : undefined;
  const effectiveSelection: Selection =
    selected === "new" || selectedQuestion
      ? selected!
      : (lesson.questions[0]?.id ?? "new");

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
        <div className="grid gap-4 lg:grid-cols-[17rem_1fr] lg:items-start">
          <QuestionList
            questions={lesson.questions}
            selected={effectiveSelection}
            onSelect={setSelected}
          />

          {effectiveSelection === "new" ? (
            <NewQuestion
              key="new"
              lessonId={lesson.id}
              onCreated={(id) => {
                reload();
                setSelected(id);
              }}
            />
          ) : (
            selectedQuestion && (
              <QuestionEditor
                key={selectedQuestion.id}
                lessonId={lesson.id}
                question={selectedQuestion}
                onChanged={reload}
                onDeleted={() => setSelected(null)}
              />
            )
          )}
        </div>
      </AdminSection>

      <MaterialsSection lessonId={lesson.id} />
    </AdminShell>
  );
}

/**
 * L'elenco a sinistra, il pannello di modifica a destra: più chiaro
 * dell'accordion precedente quando una lezione ha molte domande, perché la
 * lista intera resta visibile mentre se ne modifica una.
 */
function QuestionList({
  questions,
  selected,
  onSelect,
}: {
  questions: QuestionRow[];
  selected: Selection;
  onSelect: (s: Selection) => void;
}) {
  return (
    <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:pb-0">
      {questions.map((question, i) => (
        <li key={question.id} className="shrink-0 lg:shrink">
          <button
            onClick={() => onSelect(question.id)}
            className={`press block w-full min-w-[10rem] rounded-lg px-3 py-2.5 text-left text-sm transition-colors lg:min-w-0 ${
              selected === question.id
                ? "bg-gold/15 text-cream"
                : "text-cream/60 hover:bg-cream/5 hover:text-cream/85"
            }`}
          >
            <span className="block truncate">
              {i + 1}. {question.textIt || "(senza testo)"}
            </span>
          </button>
        </li>
      ))}
      <li className="shrink-0 lg:shrink lg:mt-1.5 lg:border-t lg:border-cream/10 lg:pt-2.5">
        <button
          onClick={() => onSelect("new")}
          className={`press block w-full min-w-[10rem] rounded-lg px-3 py-2.5 text-left text-sm transition-colors lg:min-w-0 ${
            selected === "new"
              ? "bg-gold/15 text-gold"
              : "text-gold/80 hover:bg-cream/5 hover:text-gold"
          }`}
        >
          + Nuova domanda
        </button>
      </li>
    </ul>
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
  onChanged,
  onDeleted,
}: {
  lessonId: number;
  question: QuestionRow;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const { t } = useLanguage();
  // Non serve un effetto per ripartire dai dati quando cambia la domanda
  // selezionata: il chiamante monta questo componente con `key={question.id}`,
  // quindi React lo ricrea da zero da solo, bozza compresa.
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
    if (result.ok) onChanged();
    else setMsg(errorMessage(result, t));
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
    if (result.ok) onDeleted();
    else setMsg(errorMessage(result, t));
  }

  return (
    <div className="card p-5">
      <DraftFields draft={draft} setDraft={setDraft} />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={busy} className={buttonClass}>
          Salva domanda
        </button>
        <button
          onClick={() => setDraft(draftFrom(question))}
          className={ghostButtonClass}
        >
          Annulla modifiche
        </button>
        <button
          onClick={remove}
          disabled={busy}
          className="press ml-auto inline-flex min-h-10 items-center px-1 text-xs text-red-300/80 underline underline-offset-4 hover:text-red-300"
        >
          Elimina domanda
        </button>
      </div>

      {msg && <p className="mt-3 text-sm text-red-300">{msg}</p>}
    </div>
  );
}

function NewQuestion({
  lessonId,
  onCreated,
}: {
  lessonId: number;
  onCreated: (id: number) => void;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [msg, setMsg] = useState<string | null>(null);

  async function create() {
    setMsg(null);
    const result = await post<{ questionId: number }>(
      `/api/admin/catalogue/${lessonId}/questions`,
      draft,
    );
    if (result.ok) {
      setDraft(emptyDraft);
      onCreated(result.data.questionId);
    } else setMsg(errorMessage(result, t));
  }

  return (
    <div className="card p-5">
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-gold/70">
        Nuova domanda
      </p>
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
          // I due campi si impilano sotto i 640px. Affiancati non si
          // stringono: un input ha una larghezza propria che il browser non
          // comprime, e su un telefono la riga usciva dalla scheda — l'unico
          // punto dell'app che scorreva in orizzontale.
          <li key={i} className="flex items-start gap-2">
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
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-colors ${
                option.isCorrect
                  ? "border-gold bg-gold text-charcoal"
                  : "border-cream/25 text-transparent hover:border-gold/50"
              }`}
            >
              <CheckIcon className="h-3.5 w-3.5" />
            </button>

            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
              <input
                value={option.textIt}
                onChange={(e) => setOption(i, { textIt: e.target.value })}
                placeholder="Testo (italiano)"
                className={`${inputClass} min-w-0`}
              />
              <input
                value={option.textEn}
                onChange={(e) => setOption(i, { textEn: e.target.value })}
                placeholder="Inglese"
                className={`${inputClass} min-w-0`}
              />
            </div>

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
              className="press grid h-10 w-10 shrink-0 place-items-center text-cream/35 transition-colors hover:text-red-300 disabled:opacity-25"
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
