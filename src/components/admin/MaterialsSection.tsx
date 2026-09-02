"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage, post } from "@/lib/api";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, fileToBase64 } from "@/lib/inlineUpload";
import { useLanguage } from "@/components/LanguageProvider";
import {
  AdminSection,
  Field,
  buttonClass,
  inputClass,
} from "@/components/admin/AdminShell";

type Material = {
  id: string;
  type: string;
  titleIt: string;
  titleEn: string | null;
  url: string;
  notes: string | null;
  viewCount: number;
};

const TYPES = [
  { value: "PDF", label: "Dispensa PDF" },
  { value: "SLIDE", label: "Slide" },
  { value: "IMAGE", label: "Immagine" },
  { value: "VIDEO", label: "Video" },
  { value: "SCROLL", label: "Pergamena" },
] as const;

/**
 * Gestione dispense di una lezione del catalogo.
 *
 * Il file viaggia nel corpo della richiesta e finisce dentro alla riga del
 * database (§ store Blob sospeso per limite del piano Hobby): niente
 * account esterno, niente costo. Per questo il limite di dimensione è più
 * stretto di quando si passava dallo store — vedi `MAX_UPLOAD_MB`.
 */
export function MaterialsSection({ lessonId }: { lessonId: number }) {
  const { t } = useLanguage();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [reloads, setReloads] = useState(0);
  const reload = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await api<{ materials: Material[] }>(
        `/api/admin/catalogue/${lessonId}/materials`,
      );
      if (!cancelled && result.ok) setMaterials(result.data.materials);
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId, reloads]);

  async function remove(id: string, title: string) {
    if (!window.confirm(`Eliminare "${title}"? Anche il file verrà rimosso.`))
      return;
    await api(`/api/admin/materials/${id}`, { method: "DELETE" });
    reload();
  }

  return (
    <AdminSection
      title="Dispense"
      hint="Restano legate alla lezione, quindi la seguono in ogni corso che la usa. I file sono protetti: non hanno un indirizzo pubblico, e ogni apertura ripassa dal controllo di chi sei. Un link copiato e girato non serve quindi a nulla a chi non è iscritto o non ha ancora sbloccato la serata. Attenzione però: chi la serata l'ha già sbloccata continua ad accedervi anche se poi togli lo sblocco a tutti."
      defaultOpen={false}
    >
      {materials.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2">
          {materials.map((m) => (
            <li
              key={m.id}
              className="card flex items-center justify-between gap-3 p-4"
            >
              <span className="min-w-0">
                {/* Il relatore deve poter aprire ciò che ha caricato: è il
                    solo modo di accorgersi di aver messo il file sbagliato
                    prima che lo scarichi la classe. */}
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block line-clamp-2 text-cream underline sm:truncate decoration-cream/25 underline-offset-4 hover:decoration-gold"
                >
                  {m.titleIt}
                </a>
                {m.notes && (
                  <span className="block truncate text-xs text-cream/60">
                    {m.notes}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="pill bg-cream/8 text-cream/50">{m.type}</span>
                <button
                  onClick={() => void remove(m.id, m.titleIt)}
                  className="press inline-flex min-h-10 items-center px-1 text-xs text-red-300/80 underline underline-offset-4 hover:text-red-300"
                >
                  Elimina
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {materials.length === 0 && (
        <p className="card mb-4 p-5 text-sm text-cream/60">
          Nessuna dispensa per questa lezione.
        </p>
      )}

      <UploadForm lessonId={lessonId} onDone={reload} t={t} />
    </AdminSection>
  );
}

function UploadForm({
  lessonId,
  onDone,
  t,
}: {
  lessonId: number;
  onDone: () => void;
  t: { genericError: string; networkError: string };
}) {
  const [titleIt, setTitleIt] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [notes, setNotes] = useState("");
  const [type, setType] = useState<string>("PDF");
  const [videoUrl, setVideoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isVideo = type === "VIDEO";

  async function submit() {
    setBusy(true);
    setMsg(null);

    try {
      // Il file va dentro alla riga del database (§ store Blob sospeso per
      // limite del piano Hobby): niente account esterno, niente passaggio a
      // parte, ma per questo resta piccolo — da qui il limite più stretto
      // di prima.
      const payload: Record<string, unknown> = {
        lessonId,
        type,
        titleIt,
        titleEn: titleEn || null,
        notes: notes || null,
      };

      if (isVideo) {
        if (!videoUrl.trim()) throw new Error("Serve il link del video.");
        payload.url = videoUrl.trim();
      } else {
        const file = fileRef.current?.files?.[0];
        if (!file) throw new Error("Scegli un file.");
        // Controllato prima di leggerlo: un file da 0 byte produce una
        // base64 vuota, indistinguibile lato server da "nessun file scelto"
        // — l'errore giusto va dato qui, non lasciato indovinare dopo.
        if (file.size === 0) throw new Error("Il file scelto è vuoto.");
        if (file.size > MAX_UPLOAD_BYTES) {
          throw new Error(`File troppo grande: massimo ${MAX_UPLOAD_MB}MB.`);
        }
        payload.content = await fileToBase64(file);
        payload.contentType = file.type || "application/octet-stream";
      }

      const result = await post("/api/admin/materials", payload);

      if (!result.ok) throw new Error(errorMessage(result, t));

      setTitleIt("");
      setTitleEn("");
      setNotes("");
      setVideoUrl("");
      if (fileRef.current) fileRef.current.value = "";
      onDone();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : t.genericError);
    }

    setBusy(false);
  }

  return (
    <div className="card p-5">
      <p className="mb-3 text-sm text-cream/70">Aggiungi una dispensa</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Titolo (italiano)">
          <input
            value={titleIt}
            onChange={(e) => setTitleIt(e.target.value)}
            placeholder="Es. Scheda di degustazione"
            className={inputClass}
          />
        </Field>
        <Field label="Titolo (inglese)">
          <input
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            placeholder="Se vuoto, usa l'italiano"
            className={inputClass}
          />
        </Field>
        <Field label="Note (facoltative)">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <p className="mt-4 mb-2 text-xs text-cream/55">Tipo</p>
      <div className="flex flex-wrap gap-2">
        {TYPES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setType(option.value)}
            aria-pressed={type === option.value}
            className={`press pill min-h-10 px-4 transition-colors ${
              type === option.value
                ? "bg-gold text-charcoal"
                : "bg-cream/8 text-cream/60 hover:text-cream"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-cream/50">
        Puoi cambiare tipo in qualunque momento: titolo, note e file scelto
        restano qui finché non carichi la dispensa.
      </p>

      <div className="mt-4">
        {/* I due campi restano montati: cambiare PDF/immagine/video non deve
            mai far perdere una scelta già fatta nel browser. */}
        <div hidden={isVideo}>
          <Field label={`File (PDF, immagine o slide — fino a ${MAX_UPLOAD_MB}MB)`}>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.pptx"
              className={`${inputClass} file:mr-3 file:rounded-full file:border-0 file:bg-gold/20 file:px-3 file:py-1 file:text-xs file:text-gold`}
            />
          </Field>
        </div>
        <div hidden={!isVideo}>
          <Field label="Link del video (YouTube, Vimeo…)">
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://…"
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={submit}
          disabled={busy || !titleIt.trim()}
          className={buttonClass}
        >
          {busy ? "Caricamento…" : "Carica dispensa"}
        </button>
        {msg && <span className="text-sm text-red-300">{msg}</span>}
      </div>
    </div>
  );
}
