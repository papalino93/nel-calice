"use client";

import {
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
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
import { ArrowRightIcon, EyeIcon, LockIcon } from "@/components/icons";
import type { CertificateData } from "@/components/Certificate";
import { CertificateView } from "@/components/CertificateView";

type CourseLessonRow = {
  courseLessonId: string;
  lessonId: number;
  position: number;
  titleIt: string;
  titleEn: string;
  isExam: boolean;
  globallyUnlocked: boolean;
  unlockCode: string | null;
  questionCount: number;
  scoring: string;
};

type Detail = {
  slug: string;
  titleIt: string;
  titleEn: string;
  subtitleIt: string | null;
  subtitleEn: string | null;
  location: string | null;
  certificateIssuer: string | null;
  logos: { id: string; url: string }[];
  status: string;
  enrollmentOpen: boolean;
  enrollmentCode: string | null;
  lessonTimerMinutes: number;
  examTimerMinutes: number;
  enrolledCount: number;
  lessons: CourseLessonRow[];
};

type CatalogueRow = {
  id: number;
  titleIt: string;
  questionCount: number;
  usedInCourses: number;
};

export default function ManageCoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { t } = useLanguage();

  const [detail, setDetail] = useState<Detail | null>(null);
  const [cat, setCat] = useState<CatalogueRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const reload = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [d, c] = await Promise.all([
        api<Detail>(`/api/admin/courses/${slug}`),
        api<{ lessons: CatalogueRow[] }>("/api/admin/catalogue"),
      ]);
      if (cancelled) return;

      if (d.ok) setDetail(d.data);
      else setError(errorMessage(d, t));
      if (c.ok) setCat(c.data.lessons);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, reloads, t]);

  if (error) {
    return (
      <AdminShell title="—" backHref="/relatore" backLabel={t.adminArea}>
        <p className="text-sm text-cream/70">{error}</p>
      </AdminShell>
    );
  }

  if (!detail) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-cream/50">{t.checkingSession}</p>
      </main>
    );
  }

  const inCourse = new Set(detail.lessons.map((l) => l.lessonId));
  const available = cat.filter((l) => !inCourse.has(l.id));

  return (
    <AdminShell
      title={detail.titleIt}
      backHref="/relatore"
      backLabel={t.adminArea}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-cream/45">
        <span>/corso/{detail.slug}</span>
        <span>·</span>
        <span>{detail.enrolledCount} iscritti</span>
        <span>·</span>
        <Link
          href={`/corso/${detail.slug}`}
          className="inline-flex items-center gap-1 text-gold/80 underline underline-offset-4 hover:text-gold"
        >
          <EyeIcon className="h-3.5 w-3.5" />
          {t.studentView}
        </Link>
        <span>·</span>
        <Link
          href={`/relatore/corso/${detail.slug}/classe`}
          className="text-gold/80 underline underline-offset-4 hover:text-gold"
        >
          Andamento della classe
        </Link>
      </div>

      <CourseTitles detail={detail} onSaved={reload} />

      <LogosSection slug={slug} logos={detail.logos} onChanged={reload} />

      <CourseSettings detail={detail} onSaved={reload} />

      <CertificatePreview slug={slug} />

      <LessonsSection
        slug={slug}
        detail={detail}
        available={available}
        onChanged={reload}
      />
    </AdminShell>
  );
}

/** Anteprima dell'attestato con dati d'esempio (§3.7a). */
function CertificatePreview({ slug }: { slug: string }) {
  const [data, setData] = useState<CertificateData | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || data) return;
    let cancelled = false;
    void (async () => {
      const result = await api<{ data: CertificateData }>(
        `/api/admin/courses/${slug}/certificate-preview`,
      );
      if (!cancelled && result.ok) setData(result.data.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, data, slug]);

  return (
    <AdminSection
      title="Anteprima attestato"
      hint="Con dati d'esempio, per controllare come verrà prima che lo riceva qualcuno. È lo stesso disegno che vedranno i corsisti: quello che scarichi qui è identico al loro."
    >
      {!open ? (
        <button onClick={() => setOpen(true)} className={ghostButtonClass}>
          Mostra anteprima
        </button>
      ) : data ? (
        <CertificateView data={data} showShare={false} />
      ) : (
        <p className="text-sm text-cream/45">Un momento…</p>
      )}
    </AdminSection>
  );
}

function CourseTitles({
  detail,
  onSaved,
}: {
  detail: Detail;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const [titleIt, setTitleIt] = useState(detail.titleIt);
  const [titleEn, setTitleEn] = useState(detail.titleEn);
  const [subtitleIt, setSubtitleIt] = useState(detail.subtitleIt ?? "");
  const [subtitleEn, setSubtitleEn] = useState(detail.subtitleEn ?? "");
  const [location, setLocation] = useState(detail.location ?? "");
  const [certificateIssuer, setCertificateIssuer] = useState(
    detail.certificateIssuer ?? "",
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMsg(null);
    const result = await api(`/api/admin/courses/${detail.slug}`, {
      method: "PATCH",
      body: JSON.stringify({
        titleIt,
        titleEn,
        subtitleIt: subtitleIt || null,
        subtitleEn: subtitleEn || null,
        location: location.trim() || null,
        certificateIssuer: certificateIssuer.trim() || null,
      }),
    });
    setBusy(false);
    if (result.ok) {
      setMsg("Salvato.");
      onSaved();
    } else {
      setMsg(errorMessage(result, t));
    }
  }

  return (
    <AdminSection
      title="Titoli"
      hint="Il luogo è facoltativo: se lo lasci vuoto, l'attestato mostra solo la data. Sta bene compilato quando questa edizione si tiene altrove dalla solita sede."
    >
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
          <Field label="Luogo (per l'attestato)">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Per esempio: Roma"
              className={inputClass}
            />
          </Field>
          <Field label="Firma sull'attestato">
            <input
              value={certificateIssuer}
              onChange={(e) => setCertificateIssuer(e.target.value)}
              placeholder="Per esempio: L'Angolo del Vino"
              className={inputClass}
            />
          </Field>
        </div>
        <p className="mt-3 text-xs text-cream/45">
          Vuota, quella riga sparisce dall&apos;attestato. Se carichi almeno
          un logo qui sotto, i loghi prendono comunque il suo posto: per
          un&apos;edizione realizzata con un partner, il nome resta ma
          l&apos;attestato mostra i marchi, non lo scrive.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={save} disabled={busy} className={buttonClass}>
            Salva
          </button>
          {msg && <span className="text-xs text-cream/60">{msg}</span>}
        </div>
      </div>
    </AdminSection>
  );
}

/**
 * Loghi che sostituiscono la firma testuale sull'attestato — il caso di
 * un'edizione realizzata con un partner, dove il marchio dell'attività non
 * basta più da solo. Fino a quattro: oltre, sulla riga dell'attestato non
 * ci starebbero leggibili.
 */
function LogosSection({
  slug,
  logos,
  onChanged,
}: {
  slug: string;
  logos: { id: string; url: string }[];
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setBusy(true);
    setMsg(null);
    try {
      const permesso = await post<{ presignedUrl: string; pathname: string }>(
        `/api/admin/courses/${slug}/logos/upload`,
        { contentType: file.type },
      );
      if (!permesso.ok) throw new Error(errorMessage(permesso, t));

      const caricamento = await fetch(permesso.data.presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "content-type": file.type },
      });
      if (!caricamento.ok) {
        throw new Error("Il file non è stato accettato dallo storage.");
      }

      const result = await post(`/api/admin/courses/${slug}/logos`, {
        pathname: permesso.data.pathname,
      });
      if (!result.ok) throw new Error(errorMessage(result, t));

      if (fileRef.current) fileRef.current.value = "";
      onChanged();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : t.genericError);
    }
    setBusy(false);
  }

  async function remove(id: string) {
    setBusy(true);
    await api(`/api/admin/courses/${slug}/logos/${id}`, { method: "DELETE" });
    setBusy(false);
    onChanged();
  }

  return (
    <AdminSection
      title="Loghi dell'attestato"
      hint="Al posto della firma testuale — non accanto. Pensati per un'edizione realizzata con un partner: carica il suo marchio insieme al proprio, o al posto del proprio."
    >
      {logos.length > 0 && (
        <ul className="mb-4 flex flex-wrap gap-3">
          {logos.map((logo) => (
            <li
              key={logo.id}
              className="card flex items-center gap-3 p-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- immagine autenticata, non ottimizzabile da next/image */}
              <img
                src={logo.url}
                alt=""
                className="h-10 w-auto max-w-[7rem] object-contain"
              />
              <button
                onClick={() => remove(logo.id)}
                disabled={busy}
                className="press inline-flex min-h-8 items-center px-1 text-xs text-red-300/80 underline underline-offset-4 hover:text-red-300"
              >
                Elimina
              </button>
            </li>
          ))}
        </ul>
      )}

      {logos.length < 4 ? (
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={upload}
            disabled={busy}
            className="text-sm text-cream/70 file:mr-3 file:rounded-full file:border-0 file:bg-gold/15 file:px-3 file:py-2 file:text-xs file:text-gold hover:file:bg-gold/25"
          />
          <span className="text-xs text-cream/40">PNG, JPEG o WebP, fino a 2MB</span>
        </div>
      ) : (
        <p className="text-xs text-cream/45">
          Limite di 4 loghi raggiunto. Elimina un logo per caricarne un altro.
        </p>
      )}
      {msg && <p className="mt-2 text-sm text-red-300">{msg}</p>}
    </AdminSection>
  );
}

function CourseSettings({
  detail,
  onSaved,
}: {
  detail: Detail;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const [code, setCode] = useState(detail.enrollmentCode ?? "");
  const [lessonMin, setLessonMin] = useState(String(detail.lessonTimerMinutes));
  const [examMin, setExamMin] = useState(String(detail.examTimerMinutes));
  const [status, setStatus] = useState(detail.status);
  const [open, setOpen] = useState(detail.enrollmentOpen);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMsg(null);
    const result = await api(`/api/admin/courses/${detail.slug}`, {
      method: "PATCH",
      body: JSON.stringify({
        enrollmentCode: code.trim() || undefined,
        lessonTimerMinutes: Number(lessonMin),
        examTimerMinutes: Number(examMin),
        status,
        enrollmentOpen: open,
      }),
    });
    setBusy(false);
    if (result.ok) {
      setMsg("Salvato.");
      onSaved();
    } else {
      setMsg(errorMessage(result, t));
    }
  }

  return (
    <AdminSection
      title="Impostazioni del corso"
      hint="Il codice d'iscrizione è quello che comunichi alla prima serata: è unico fra tutti i corsi, quindi chi lo digita finisce qui e non altrove. Le durate valgono per ogni tentativo di questo corso."
    >
      <div className="card p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Codice d'iscrizione">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${inputClass} font-serif tracking-[0.15em] uppercase`}
              autoCapitalize="characters"
              spellCheck={false}
            />
          </Field>
          <Field label="Durata lezioni (minuti)">
            <input
              type="number"
              min={1}
              value={lessonMin}
              onChange={(e) => setLessonMin(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Durata prova finale (minuti)">
            <input
              type="number"
              min={1}
              value={examMin}
              onChange={(e) => setExamMin(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Field label="Stato">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputClass}
            >
              <option value="DRAFT">In preparazione</option>
              <option value="ACTIVE">Attivo</option>
              <option value="ARCHIVED">Archiviato</option>
            </select>
          </Field>

          <label className="mt-5 inline-flex items-center gap-2 text-sm text-cream/70">
            <input
              type="checkbox"
              checked={open}
              onChange={(e) => setOpen(e.target.checked)}
              className="h-5 w-5 accent-[var(--color-gold)]"
            />
            Iscrizioni aperte
          </label>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button onClick={save} disabled={busy} className={buttonClass}>
            Salva
          </button>
          {msg && <span className="text-xs text-cream/60">{msg}</span>}
        </div>
      </div>
    </AdminSection>
  );
}

function LessonsSection({
  slug,
  detail,
  available,
  onChanged,
}: {
  slug: string;
  detail: Detail;
  available: CatalogueRow[];
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"new" | "catalogue">("new");
  const [addLessonId, setAddLessonId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [addCode, setAddCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ready = Boolean(
    addCode.trim() && (mode === "new" ? newTitle.trim() : addLessonId),
  );

  async function add() {
    setMsg(null);
    setBusy(true);
    const result = await post(
      `/api/admin/courses/${slug}/lessons`,
      mode === "new"
        ? { titleIt: newTitle.trim(), code: addCode }
        : { lessonId: Number(addLessonId), code: addCode },
    );
    setBusy(false);

    if (result.ok) {
      setAddLessonId("");
      setNewTitle("");
      setAddCode("");
      onChanged();
    } else {
      setMsg(errorMessage(result, t));
    }
  }

  return (
    <AdminSection
      title="Lezioni di questo corso"
      hint="Quali serate fa questa edizione, e con quale codice. Puoi scrivere una lezione nuova qui, oppure riprendere dal catalogo una già fatta. Togliere una lezione non la cancella dal catalogo: resta per gli altri corsi, con le sue domande e dispense. I numeri delle altre non scorrono."
    >
      <ul className="flex flex-col gap-2.5">
        {detail.lessons.map((lesson) => (
          <LessonRow
            key={lesson.courseLessonId}
            slug={slug}
            lesson={lesson}
            enrolledCount={detail.enrolledCount}
            onChanged={onChanged}
          />
        ))}
      </ul>

      {detail.lessons.length === 0 && (
        <p className="card p-5 text-sm text-cream/45">
          Nessuna lezione in questo corso, per ora.
        </p>
      )}

      <div className="card mt-4 p-5">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-sm text-cream/70">Aggiungi una serata</p>
          <div className="flex gap-1.5">
            <ModeButton
              active={mode === "new"}
              onClick={() => {
                setMode("new");
                setMsg(null);
              }}
            >
              Lezione nuova
            </ModeButton>
            <ModeButton
              active={mode === "catalogue"}
              onClick={() => {
                setMode("catalogue");
                setMsg(null);
              }}
            >
              Dal catalogo
            </ModeButton>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          {mode === "new" ? (
            <Field label="Titolo della lezione">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Per esempio: I vini del Piemonte"
                className={inputClass}
              />
            </Field>
          ) : (
            <Field label="Dal catalogo">
              <select
                value={addLessonId}
                onChange={(e) => setAddLessonId(e.target.value)}
                className={inputClass}
              >
                <option value="">Scegli…</option>
                {available.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.titleIt} ({l.questionCount} domande)
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Codice serata">
            <input
              value={addCode}
              onChange={(e) => setAddCode(e.target.value)}
              className={`${inputClass} font-serif tracking-[0.15em] uppercase`}
              autoCapitalize="characters"
              spellCheck={false}
            />
          </Field>

          <button onClick={add} disabled={!ready || busy} className={buttonClass}>
            Aggiungi
          </button>
        </div>

        {mode === "new" ? (
          <p className="mt-3 text-xs text-cream/45">
            La lezione nasce anche nel catalogo: resta riusabile in un&apos;altra
            edizione, con le sue domande e le sue dispense. Le domande le scrivi
            dopo, dal pulsante «Domande» della serata.
          </p>
        ) : (
          available.length === 0 && (
            <p className="mt-3 text-xs text-cream/45">
              Tutte le lezioni del catalogo sono già in questo corso.{" "}
              <button
                onClick={() => setMode("new")}
                className="press text-gold/80 underline underline-offset-4 hover:text-gold"
              >
                Scrivine una nuova
              </button>
              .
            </p>
          )
        )}
        {msg && <p className="mt-3 text-sm text-red-300">{msg}</p>}
      </div>
    </AdminSection>
  );
}

/** Le due strade per aggiungere una serata, una accanto all'altra. */
function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`press inline-flex min-h-10 items-center rounded-full px-4 text-xs transition ${
        active ? "bg-gold/15 text-gold" : "text-cream/45 hover:text-cream/70"
      }`}
    >
      {children}
    </button>
  );
}

function LessonRow({
  slug,
  lesson,
  enrolledCount,
  onChanged,
}: {
  slug: string;
  lesson: CourseLessonRow;
  enrolledCount: number;
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const [code, setCode] = useState(lesson.unlockCode ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    const result = await api(
      `/api/admin/courses/${slug}/lessons/${lesson.courseLessonId}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
    setBusy(false);
    if (result.ok) onChanged();
    else setMsg(errorMessage(result, t));
  }

  async function remove() {
    const warning =
      enrolledCount > 0
        ? `Togliere "${lesson.titleIt}" da questo corso cancella anche i tentativi già svolti dai ${enrolledCount} iscritti. La lezione resta nel catalogo. Procedere?`
        : `Togliere "${lesson.titleIt}" da questo corso? Resta nel catalogo.`;
    if (!window.confirm(warning)) return;

    setBusy(true);
    await api(`/api/admin/courses/${slug}/lessons/${lesson.courseLessonId}`, {
      method: "DELETE",
    });
    setBusy(false);
    onChanged();
  }

  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-gold/70">
            {lesson.isExam ? "Prova finale" : `Lezione ${lesson.position}`}
          </p>
          <p className="font-serif text-lg text-cream">{lesson.titleIt}</p>
          <p className="mt-0.5 text-xs text-cream/45">{lesson.scoring}</p>
        </div>

        <button
          onClick={() => patch({ globallyUnlocked: !lesson.globallyUnlocked })}
          disabled={busy}
          className={`pill shrink-0 ${
            lesson.globallyUnlocked
              ? "bg-emerald-400/12 text-emerald-300"
              : "bg-gold/12 text-gold"
          }`}
          title="Apre o chiude la lezione per tutti gli iscritti, subito, indipendentemente dai codici"
        >
          <LockIcon className="h-3.5 w-3.5" />
          {lesson.globallyUnlocked ? "Aperta a tutti" : "Sblocca a tutti"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Field label="Codice della serata">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onBlur={() => {
              const next = code.trim().toUpperCase();
              if (next && next !== (lesson.unlockCode ?? "")) {
                void patch({ unlockCode: next });
              }
            }}
            className={`${inputClass} w-44 font-serif tracking-[0.15em] uppercase`}
            autoCapitalize="characters"
            spellCheck={false}
          />
        </Field>

        <label className="mb-2 inline-flex items-center gap-2 text-sm text-cream/70">
          <input
            type="checkbox"
            checked={lesson.isExam}
            onChange={(e) => void patch({ isExam: e.target.checked })}
            className="h-5 w-5 accent-[var(--color-gold)]"
          />
          Prova finale
        </label>

        <Link
          href={`/relatore/catalogo/${lesson.lessonId}`}
          className={`${ghostButtonClass} mb-1.5 inline-flex items-center gap-1.5`}
        >
          Domande
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </Link>

        <button
          onClick={remove}
          disabled={busy}
          className="press mb-1 ml-auto inline-flex min-h-10 items-center px-1 text-xs text-red-300/80 underline underline-offset-4 hover:text-red-300"
        >
          Togli dal corso
        </button>
      </div>

      {msg && <p className="mt-2 text-sm text-red-300">{msg}</p>}
    </li>
  );
}
