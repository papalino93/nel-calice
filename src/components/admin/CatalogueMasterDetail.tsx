"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { api, errorMessage, post } from "@/lib/api";
import { useLanguage } from "@/components/LanguageProvider";
import {
  AdminSection,
  Field,
  buttonClass,
  inputClass,
} from "@/components/admin/AdminShell";
import { ArrowRightIcon } from "@/components/icons";
import { LessonEditor } from "@/components/admin/LessonEditor";

type Row = {
  id: number;
  titleIt: string;
  titleEn: string;
  subtitleIt: string | null;
  questionCount: number;
  materialCount: number;
  usedInCourses: number;
};

/**
 * Catalogo lezioni, in due forme a seconda dello schermo (§ brief revisione
 * UX-design, editor master-detail).
 *
 * Sopra i 1024px: elenco a sinistra, dettaglio della lezione scelta a
 * destra, senza mai lasciare la pagina — prima ogni lezione era una pagina
 * a parte, un clic in più ogni volta che se ne confrontavano due.
 *
 * Sotto i 1024px resta una pila lineare, tale e quale a prima: o l'elenco,
 * o il dettaglio di una lezione, mai insieme — c'è spazio per uno schermo
 * solo. La selezione cambia pagina (`/relatore/catalogo/[id]`), non solo
 * stato interno: così un link diretto (es. "Domande" dalla pagina di un
 * corso) continua a portare dritto alla lezione giusta, con la stessa
 * vista che si avrebbe scegliendola qui.
 */
export function CatalogueMasterDetail({
  selectedId,
}: {
  selectedId: number | null;
}) {
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

  // Su desktop la scelta di una lezione non deve navigare: cambiare pagina
  // (anche solo fra /relatore/catalogo e /relatore/catalogo/[id]) smonta e
  // rimonta l'intero componente, con l'elenco che sparisce e ricompare a
  // ogni clic — il difetto esatto che il master-detail vuole evitare. Lo
  // stato locale parte già corretto da `selectedId` quando la pagina arriva
  // puntata su una lezione (link diretto "Domande" dalla pagina del corso):
  // in quel caso è un montaggio nuovo di questo stesso componente, quindi
  // `useState` legge il valore giusto da solo — non serve risincronizzarlo
  // in un effetto.
  const [active, setActive] = useState(selectedId);

  function choose(id: number, event: MouseEvent) {
    // Sotto i 1024px il clic resta una navigazione vera: è la pila lineare,
    // un solo schermo alla volta, con la cronologia del browser che si
    // comporta come ci si aspetta premendo "indietro".
    if (window.matchMedia("(min-width: 1024px)").matches) {
      event.preventDefault();
      setActive(id);
      window.history.replaceState(null, "", `/relatore/catalogo/${id}`);
    }
  }

  return (
    <>
      <AdminSection
        title="Le lezioni"
        hint="Scritte una volta e riusabili in quanti corsi vuoi. Modificare una lezione qui la modifica in tutti i corsi che la usano — è contenuto condiviso, non copie separate. Una lezione usata da un corso non si può cancellare: porterebbe con sé i tentativi già svolti."
      >
        <div className="lg:grid lg:grid-cols-[19rem_1fr] lg:items-start lg:gap-5">
          <div className={active !== null ? "hidden lg:block" : ""}>
            <ul className="flex flex-col gap-2.5">
              {lessons.map((lesson) => (
                <li key={lesson.id}>
                  <Link
                    href={`/relatore/catalogo/${lesson.id}`}
                    onClick={(event) => choose(lesson.id, event)}
                    className={`card lift press flex items-center justify-between gap-4 p-4 transition-transform lg:p-3.5 ${
                      active === lesson.id ? "border-gold/50 bg-gold/8" : ""
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block font-serif text-lg text-cream">
                        {lesson.titleIt}
                      </span>
                      <span className="mt-0.5 block text-xs text-cream/60">
                        {lesson.questionCount} domande · {lesson.materialCount}{" "}
                        dispense ·{" "}
                        {lesson.usedInCourses === 0
                          ? "non usata da nessun corso"
                          : `usata in ${lesson.usedInCourses} cors${lesson.usedInCourses === 1 ? "o" : "i"}`}
                      </span>
                    </span>
                    <ArrowRightIcon className="h-5 w-5 shrink-0 text-gold lg:hidden" />
                  </Link>
                </li>
              ))}
            </ul>

            {loaded && lessons.length === 0 && (
              <p className="card p-5 text-sm text-cream/60">
                Il catalogo è vuoto. Scrivi la prima lezione qui sotto.
              </p>
            )}
          </div>

          <div className={active === null ? "hidden lg:block" : ""}>
            {active !== null ? (
              <LessonEditor
                key={active}
                lessonId={active}
                backHref="/relatore/catalogo"
              />
            ) : (
              <div className="card hidden h-full min-h-[16rem] place-items-center p-8 text-center lg:grid">
                <p className="max-w-xs text-sm text-cream/50">
                  Scegli una lezione dall&apos;elenco per vederne domande e
                  dispense.
                </p>
              </div>
            )}
          </div>
        </div>
      </AdminSection>

      <div className={active !== null ? "hidden lg:block" : ""}>
        <NewLesson onCreated={reload} />
      </div>
    </>
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
