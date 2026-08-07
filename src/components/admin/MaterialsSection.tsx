"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { api, errorMessage, post } from "@/lib/api";
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
 * Il file non passa dal server: il browser lo carica direttamente sullo
 * store con un permesso a tempo. È ciò che toglie il limite dei 4MB
 * dell'app attuale (§7.14) — qui si arriva a 50MB.
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
      hint="Restano legate alla lezione, quindi la seguono in ogni corso che la usa. I file sono protetti: chi non è iscritto non li raggiunge, e chi lo è riceve un link che scade dopo un quarto d'ora, così non resta valido per sempre se viene girato."
    >
      {materials.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2">
          {materials.map((m) => (
            <li
              key={m.id}
              className="card flex items-center justify-between gap-3 p-4"
            >
              <span className="min-w-0">
                <span className="block truncate text-cream">{m.titleIt}</span>
                {m.notes && (
                  <span className="block truncate text-xs text-cream/45">
                    {m.notes}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="pill bg-cream/8 text-cream/50">{m.type}</span>
                <button
                  onClick={() => void remove(m.id, m.titleIt)}
                  className="press text-xs text-red-300/80 underline underline-offset-4 hover:text-red-300"
                >
                  Elimina
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {materials.length === 0 && (
        <p className="card mb-4 p-5 text-sm text-cream/45">
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
      let url: string;

      if (isVideo) {
        if (!videoUrl.trim()) throw new Error("Serve il link del video.");
        url = videoUrl.trim();
      } else {
        const file = fileRef.current?.files?.[0];
        if (!file) throw new Error("Scegli un file.");

        // Il file va dal browser allo store senza passare da qui.
        const blob = await upload(`dispense/${lessonId}/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/admin/materials/upload",
        });
        // Si salva il pathname, non l'indirizzo pubblico: il link vero
        // viene firmato al momento della lettura.
        url = `blob:${blob.pathname}`;
      }

      const result = await post("/api/admin/materials", {
        lessonId,
        type,
        titleIt,
        url,
        notes: notes || null,
      });

      if (!result.ok) throw new Error(errorMessage(result, t));

      setTitleIt("");
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
        <Field label="Titolo">
          <input
            value={titleIt}
            onChange={(e) => setTitleIt(e.target.value)}
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
            className={`press pill transition-colors ${
              type === option.value
                ? "bg-gold text-charcoal"
                : "bg-cream/8 text-cream/60 hover:text-cream"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {isVideo ? (
          <Field label="Link del video (YouTube, Vimeo…)">
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://…"
              className={inputClass}
            />
          </Field>
        ) : (
          <Field label="File (PDF, immagine o slide — fino a 50MB)">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.pptx"
              className={`${inputClass} file:mr-3 file:rounded-full file:border-0 file:bg-gold/20 file:px-3 file:py-1 file:text-xs file:text-gold`}
            />
          </Field>
        )}
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
