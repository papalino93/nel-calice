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
import { ArrowRightIcon, EyeIcon, LockIcon, RefreshIcon } from "@/components/icons";
import type { CertificateData } from "@/components/Certificate";
import { CertificateView } from "@/components/CertificateView";

type LogoSize = "SMALL" | "MEDIUM" | "LARGE";

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
  logos: { id: string; url: string | null; text: string | null; size: LogoSize }[];
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
      <div className="flex flex-wrap items-center gap-2 text-xs text-cream/60">
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

      <section className="card mt-6 border-gold/25 bg-bordeaux/15 p-5" aria-label="Azioni del corso">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-gold/85">
          Da qui gestisci tutta la serata
        </p>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-cream/70">
          Prima fai iscrivere le persone al corso; poi, a ogni incontro,
          comunichi il codice della lezione. Quiz e materiali si sbloccano insieme.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <a href="#impostazioni" className="press rounded-xl border border-cream/10 bg-charcoal/25 p-3 text-left text-sm text-cream/75 hover:border-gold/35 hover:text-cream">
            <span className="block text-gold">1. Iscrizioni</span>
            <span className="mt-0.5 block text-xs text-cream/50">Codice del corso e tempi</span>
          </a>
          <a href="#lezioni" className="press rounded-xl border border-cream/10 bg-charcoal/25 p-3 text-left text-sm text-cream/75 hover:border-gold/35 hover:text-cream">
            <span className="block text-gold">2. Lezioni</span>
            <span className="mt-0.5 block text-xs text-cream/50">Codici, quiz e dispense</span>
          </a>
          <Link href={`/relatore/corso/${detail.slug}/classe`} className="press rounded-xl border border-cream/10 bg-charcoal/25 p-3 text-left text-sm text-cream/75 hover:border-gold/35 hover:text-cream">
            <span className="block text-gold">3. Classe</span>
            <span className="mt-0.5 block text-xs text-cream/50">Risultati e presenza</span>
          </Link>
          <Link href={`/corso/${detail.slug}`} className="press rounded-xl border border-cream/10 bg-charcoal/25 p-3 text-left text-sm text-cream/75 hover:border-gold/35 hover:text-cream">
            <span className="block text-gold">4. Vista corsista</span>
            <span className="mt-0.5 block text-xs text-cream/50">Controlla cosa vedono</span>
          </Link>
        </div>
      </section>

      <div id="impostazioni">
        <CourseSettings detail={detail} onSaved={reload} />
      </div>

      <CertificateSection slug={slug} detail={detail} onSaved={reload} />

      <div id="lezioni">
        <LessonsSection
          slug={slug}
          detail={detail}
          available={available}
          onChanged={reload}
        />
      </div>
    </AdminShell>
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
      hint="Titolo e sottotitolo del corso, come compaiono ovunque nell'app — luogo e firma per l'attestato sono più giù, nella sezione «Attestato»."
      defaultOpen={false}
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
        </div>
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
 * Tutto quello che finisce sulla pergamena, in un'unica sezione: prima era
 * sparso fra «Titoli», «Loghi» e «Anteprima», con «Impostazioni del corso»
 * (codice d'iscrizione, durate, stato — niente a che fare con l'aspetto
 * dell'attestato) in mezzo a loghi e anteprima. Qui invece si modifica e si
 * controlla il risultato senza uscire dal blocco.
 */
function CertificateSection({
  slug,
  detail,
  onSaved,
}: {
  slug: string;
  detail: Detail;
  onSaved: () => void;
}) {
  return (
    <AdminSection
      title="Attestato"
      hint="Luogo, firma, loghi (o testo al loro posto) e l'anteprima che li mostra insieme — nell'ordine in cui si usano: si cambia qui sopra, si controlla qui sotto."
      defaultOpen={false}
    >
      <div className="flex flex-col gap-6">
        <CertificateFields detail={detail} onSaved={onSaved} />
        <LogosSection slug={slug} logos={detail.logos} onChanged={onSaved} />
        <CertificatePreview slug={slug} />
      </div>
    </AdminSection>
  );
}

function CertificateFields({
  detail,
  onSaved,
}: {
  detail: Detail;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
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
    <div>
      <p className="mb-2 text-sm text-cream/70">Luogo e firma</p>
      <div className="card p-5">
        <div className="grid gap-3 sm:grid-cols-2">
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
        <p className="mt-3 text-xs text-cream/60">
          Il luogo è facoltativo: vuoto, l&apos;attestato mostra solo la
          data. La firma sparisce dalla riga se la lasci vuota; se invece
          aggiungi almeno un riquadro qui sotto, i riquadri prendono
          comunque il suo posto — per un&apos;edizione realizzata con un
          partner, il nome resta qui ma l&apos;attestato mostra i riquadri,
          non lo scrive.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={save} disabled={busy} className={buttonClass}>
            Salva
          </button>
          {msg && <span className="text-xs text-cream/60">{msg}</span>}
        </div>
      </div>
    </div>
  );
}

const LOGO_SIZE_LABELS: Record<LogoSize, string> = {
  SMALL: "S",
  MEDIUM: "M",
  LARGE: "L",
};

// Stesso rapporto delle taglie sulla pergamena (LOGO_BOX in Certificate.tsx:
// 50/78/100), scalato per un'anteprima nell'editor: prima l'immagine restava
// sempre alta 2.5rem qui, taglia scelta o no, e non si vedeva la differenza
// finché non si guardava l'attestato vero.
const LOGO_PREVIEW_HEIGHT: Record<LogoSize, string> = {
  SMALL: "h-8",
  MEDIUM: "h-12",
  LARGE: "h-16",
};

/**
 * Riquadri che sostituiscono la firma testuale sull'attestato — il caso di
 * un'edizione realizzata con un partner, dove il marchio dell'attività non
 * basta più da solo. Ognuno è un'immagine caricata O un testo scritto al
 * suo posto (non tutti hanno un file del proprio marchio pronto), e ha una
 * sua taglia: chi ha provato a caricarne uno e l'ha trovato piccolissimo lo
 * ingrandisce da qui, senza dover ritagliare o rifare il file. Fino a
 * quattro: oltre, sulla riga dell'attestato non ci starebbero leggibili.
 */
function LogosSection({
  slug,
  logos,
  onChanged,
}: {
  slug: string;
  logos: { id: string; url: string | null; text: string | null; size: LogoSize }[];
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"image" | "text">("image");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadImage() {
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

  async function addText() {
    if (!text.trim()) return;
    setBusy(true);
    setMsg(null);
    const result = await post(`/api/admin/courses/${slug}/logos`, {
      text: text.trim(),
    });
    setBusy(false);
    if (result.ok) {
      setText("");
      onChanged();
    } else {
      setMsg(errorMessage(result, t));
    }
  }

  async function resize(id: string, size: LogoSize) {
    await api(`/api/admin/courses/${slug}/logos/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ size }),
    });
    onChanged();
  }

  async function remove(id: string) {
    setBusy(true);
    await api(`/api/admin/courses/${slug}/logos/${id}`, { method: "DELETE" });
    setBusy(false);
    onChanged();
  }

  return (
    <div>
      <p className="mb-2 text-sm text-cream/70">Loghi, o testo al loro posto</p>
      <div className="card p-5">
        {logos.length > 0 && (
          <ul className="mb-4 flex flex-wrap gap-3">
            {logos.map((logo) => (
              <li key={logo.id} className="card flex flex-col gap-2 p-3">
                <div className="flex items-center gap-3">
                  {logo.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- immagine autenticata, non ottimizzabile da next/image
                    <img
                      src={logo.url}
                      alt=""
                      className={`${LOGO_PREVIEW_HEIGHT[logo.size]} w-auto max-w-[9rem] object-contain`}
                    />
                  ) : (
                    <span className="max-w-[9rem] truncate font-serif text-sm text-gold">
                      {logo.text}
                    </span>
                  )}
                  <button
                    onClick={() => remove(logo.id)}
                    disabled={busy}
                    className="press inline-flex min-h-8 items-center px-1 text-xs text-red-300/80 underline underline-offset-4 hover:text-red-300"
                  >
                    Elimina
                  </button>
                </div>
                <div
                  className="inline-flex items-center gap-1 self-start rounded-full border border-cream/10 p-0.5"
                  role="group"
                  aria-label="Taglia"
                >
                  {(["SMALL", "MEDIUM", "LARGE"] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => resize(logo.id, size)}
                      aria-pressed={logo.size === size}
                      title={
                        size === "SMALL"
                          ? "Piccolo"
                          : size === "MEDIUM"
                            ? "Medio"
                            : "Grande"
                      }
                      className={`press min-h-7 min-w-7 rounded-full text-xs transition-colors ${
                        logo.size === size
                          ? "bg-gold/20 text-gold"
                          : "text-cream/50 hover:text-cream/70"
                      }`}
                    >
                      {LOGO_SIZE_LABELS[size]}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}

        {logos.length < 4 ? (
          <>
            <div className="mb-3 flex gap-1.5">
              <ModeButton active={mode === "image"} onClick={() => setMode("image")}>
                Immagine
              </ModeButton>
              <ModeButton active={mode === "text"} onClick={() => setMode("text")}>
                Testo
              </ModeButton>
            </div>
            {mode === "image" ? (
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={uploadImage}
                  disabled={busy}
                  className="text-sm text-cream/70 file:mr-3 file:rounded-full file:border-0 file:bg-gold/15 file:px-3 file:py-2 file:text-xs file:text-gold hover:file:bg-gold/25"
                />
                <span className="text-xs text-cream/60">
                  PNG, JPEG o WebP, fino a 2MB
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Per esempio: Cantina Sociale"
                  className={`${inputClass} max-w-xs`}
                />
                <button
                  onClick={addText}
                  disabled={busy || !text.trim()}
                  className={buttonClass}
                >
                  Aggiungi
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-cream/60">
            Limite di 4 riquadri raggiunto. Elimina un riquadro per
            aggiungerne un altro.
          </p>
        )}
        {msg && <p className="mt-2 text-sm text-red-300">{msg}</p>}
      </div>
    </div>
  );
}

/** Anteprima dell'attestato con dati d'esempio (§3.7a). */
function CertificatePreview({ slug }: { slug: string }) {
  const [data, setData] = useState<CertificateData | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      setLoading(true);
      const result = await api<{ data: CertificateData }>(
        `/api/admin/courses/${slug}/certificate-preview`,
      );
      if (!cancelled) {
        if (result.ok) setData(result.data.data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, reloadKey, slug]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm text-cream/70">Anteprima</p>
        {open && (
          <button
            onClick={() => setReloadKey((n) => n + 1)}
            disabled={loading}
            title="Aggiorna con luogo, firma e loghi appena salvati"
            className="press inline-flex items-center gap-1.5 text-xs text-cream/60 transition-colors hover:text-cream disabled:opacity-40"
          >
            <RefreshIcon className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Aggiorna
          </button>
        )}
      </div>
      <div className="card p-5">
        <p className="mb-3 text-xs leading-relaxed text-cream/60">
          Con dati d&apos;esempio, per controllare come verrà prima che lo
          riceva qualcuno. È lo stesso disegno che vedranno i corsisti:
          quello che scarichi qui è identico al loro. Non si aggiorna da
          sola dopo un cambiamento qui sopra: premi «Aggiorna» per vederlo.
        </p>
        {!open ? (
          <button onClick={() => setOpen(true)} className={ghostButtonClass}>
            Mostra anteprima
          </button>
        ) : data ? (
          <CertificateView data={data} showShare={false} />
        ) : (
          <p className="text-sm text-cream/60">Un momento…</p>
        )}
      </div>
    </div>
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
      hint="Per iscriversi, il corsista entra prima con Google e poi inserisce questo codice nella sua area personale. Attiva le iscrizioni solo quando il codice è pronto da comunicare. Le durate valgono per ogni tentativo di questo corso."
      defaultOpen={false}
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
          <Field label="Durata del quiz di lezione (minuti)">
            <input
              type="number"
              min={1}
              value={lessonMin}
              onChange={(e) => setLessonMin(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Durata del quiz della prova finale (minuti)">
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
        <p className="card p-5 text-sm text-cream/60">
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
          <p className="mt-3 text-xs text-cream/60">
            La lezione nasce anche nel catalogo: resta riusabile in un&apos;altra
            edizione, con le sue domande e le sue dispense. Le domande le scrivi
            dopo, dal pulsante «Domande» della serata.
          </p>
        ) : (
          available.length === 0 && (
            <p className="mt-3 text-xs text-cream/60">
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
        active ? "bg-gold/15 text-gold" : "text-cream/60 hover:text-cream/70"
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
  const [copied, setCopied] = useState(false);

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

  async function copyCode() {
    const value = code.trim().toUpperCase();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMsg("Non riesco a copiare il codice da qui.");
    }
  }

  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-gold/70">
            {lesson.isExam ? "Prova finale" : `Lezione ${lesson.position}`}
          </p>
          <p className="font-serif text-lg text-cream">{lesson.titleIt}</p>
          <p className="mt-0.5 text-xs text-cream/60">{lesson.scoring}</p>
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
        <div>
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
          <button
            onClick={() => void copyCode()}
            disabled={!code.trim()}
            className="press mt-1.5 min-h-8 px-1 text-xs text-gold/85 underline underline-offset-4 disabled:text-cream/30"
          >
            {copied ? "Copiato" : "Copia codice"}
          </button>
        </div>

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

        <Link
          href={`/relatore/corso/${slug}/lezione/${lesson.courseLessonId}`}
          className={`${ghostButtonClass} mb-1.5 inline-flex items-center gap-1.5`}
          title="Chi ha aperto il quiz, a che punto è, quante risposte sono giuste finora"
        >
          Diretta
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
