"use client";

import { use, useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useLanguage } from "@/components/LanguageProvider";
import {
  AdminSection,
  AdminShell,
  ghostButtonClass,
  inputClass,
} from "@/components/admin/AdminShell";

type ClassOverview = {
  totalPoints: number;
  students: {
    enrollmentId: string;
    name: string;
    email: string;
    enrolledAt: string;
    paymentStatus: "TO_VERIFY" | "PAID";
    paidAt: string | null;
    adminNotes: string | null;
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
  materialViews: {
    id: string;
    viewedAt: string;
    studentName: string;
    materialTitleIt: string;
  }[];
};

function formatViewedAt(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type Cell =
  | { inProgress: true; score: null; maxScore: null }
  | { inProgress: false; score: number; maxScore: number }
  | { inProgress: false; score: null; maxScore: null; locked: boolean };

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

  const paidCount = data.students.filter((s) => s.paymentStatus === "PAID").length;
  const toVerifyCount = data.students.length - paidCount;

  return (
    <AdminShell
      title="Classe: iscritti e andamento"
      backHref={`/relatore/corso/${slug}`}
      backLabel="Corso"
    >
      <AdminSection
        title="Iscritti, pagamenti e note"
        hint="Le nuove iscrizioni e l'attività del corso arrivano automaticamente. Il pagamento resta una scelta del relatore, perché può avvenire anche fuori dalla piattaforma. Le note sono private: il corsista non le vede mai."
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-gold">
              {data.students.length} iscritti
            </span>
            <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-emerald-200">
              {paidCount} pagati
            </span>
            <span className="rounded-full border border-cream/15 px-3 py-1.5 text-cream/65">
              {toVerifyCount} da verificare
            </span>
          </div>
          <button onClick={reload} className={ghostButtonClass}>
            Aggiorna elenco
          </button>
        </div>

        {data.students.length === 0 ? (
          <p className="card p-5 text-sm text-cream/60">
            Nessun iscritto, per ora. Quando una persona entra con Google e
            inserisce il codice del corso, apparirà qui automaticamente.
          </p>
        ) : (
          <div className="grid gap-3">
            {data.students.map((student) => (
              <EnrollmentCard
                key={student.enrollmentId}
                slug={slug}
                student={student}
                onSaved={reload}
              />
            ))}
          </div>
        )}
      </AdminSection>

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

      <AdminSection
        title="Letture dispense"
        hint="Ogni apertura di una dispensa da parte di un iscritto, più recenti in cima. Una stessa dispensa riaperta più volte compare una riga per volta: non è un riassunto, ma il registro di chi ha visto cosa e quando."
      >
        {data.materialViews.length === 0 ? (
          <p className="card p-5 text-sm text-cream/60">
            Nessuna dispensa aperta, per ora.
          </p>
        ) : (
          <div className="card max-h-96 overflow-y-auto p-0">
            <table className="w-full text-sm">
              <tbody>
                {data.materialViews.map((v) => (
                  <tr key={v.id} className="border-b border-cream/5 last:border-0">
                    <td className="p-3 text-cream/85">{v.studentName}</td>
                    <td className="p-3 text-cream/60">{v.materialTitleIt}</td>
                    <td className="p-3 text-right whitespace-nowrap text-xs text-cream/60">
                      {formatViewedAt(v.viewedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSection>
    </AdminShell>
  );
}

type EnrollmentStudent = ClassOverview["students"][number];

/** Scheda amministrativa di un iscritto: dati che non devono mai comparire
    nell'area personale del corsista. */
function EnrollmentCard({
  slug,
  student,
  onSaved,
}: {
  slug: string;
  student: EnrollmentStudent;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const [note, setNote] = useState(student.adminNotes ?? "");
  const [busy, setBusy] = useState<"payment" | "note" | "remove" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(body: Record<string, unknown>, kind: "payment" | "note") {
    setBusy(kind);
    setMessage(null);
    const result = await api<{ paidAt: string | null; adminNotes: string | null }>(
      `/api/admin/courses/${slug}/class/${student.enrollmentId}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
    setBusy(null);
    if (result.ok) {
      setMessage(kind === "payment" ? "Pagamento aggiornato." : "Nota salvata.");
      onSaved();
    } else {
      setMessage(errorMessage(result, t));
    }
  }

  async function remove() {
    // Chi ha già fatto almeno una lezione merita un avviso più esplicito:
    // togliendolo si perdono anche i suoi tentativi, non solo la riga
    // d'iscrizione.
    const question =
      student.doneCount > 0
        ? `Togliere ${student.name} dal corso? Ha già consegnato ${student.doneCount} ${student.doneCount === 1 ? "lezione" : "lezioni"}: verranno cancellati anche i suoi tentativi, gli sblocchi e le letture delle dispense. Non si può annullare.`
        : `Togliere ${student.name} dal corso? Non ha ancora fatto nessuna lezione. Non si può annullare.`;
    if (!window.confirm(question)) return;

    setBusy("remove");
    setMessage(null);
    const result = await api(
      `/api/admin/courses/${slug}/class/${student.enrollmentId}`,
      { method: "DELETE" },
    );
    setBusy(null);
    if (result.ok) {
      onSaved();
    } else {
      setMessage(errorMessage(result, t));
    }
  }

  async function saveNote() {
    // Evita due richieste in volo insieme se il campo perde e riprende il
    // fuoco più in fretta di quanto il server risponda: senza questo, la
    // risposta che arriva per ultima vince a caso, non per forza quella
    // del testo più recente.
    if (busy === "note") return;
    if (note === (student.adminNotes ?? "")) return;
    await save({ adminNotes: note }, "note");
  }

  const paid = student.paymentStatus === "PAID";

  return (
    <article className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-serif text-xl text-cream">{student.name}</h3>
          <a
            href={`mailto:${student.email}`}
            className="mt-0.5 block break-all text-sm text-cream/60 underline decoration-gold/30 underline-offset-4 hover:text-cream"
          >
            {student.email}
          </a>
          <p className="mt-2 text-xs text-cream/45">
            Iscritto il {formatDate(student.enrolledAt)}
          </p>
          <button
            onClick={() => void remove()}
            disabled={busy !== null}
            className="press mt-2 inline-flex min-h-8 items-center text-xs text-red-300/70 underline underline-offset-4 hover:text-red-300 disabled:opacity-40"
          >
            {busy === "remove" ? "Rimozione…" : "Togli dal corso"}
          </button>
        </div>

        <div className="min-w-44 rounded-xl border border-cream/10 bg-charcoal/25 p-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-cream/50">
            Pagamento
          </p>
          <p className={`mt-1 text-sm font-medium ${paid ? "text-emerald-200" : "text-gold"}`}>
            {paid ? "Pagato" : "Da verificare"}
          </p>
          {paid && student.paidAt && (
            <p className="mt-0.5 text-xs text-cream/45">
              Confermato il {formatDate(student.paidAt)}
            </p>
          )}
          <button
            onClick={() =>
              void save(
                { paymentStatus: paid ? "TO_VERIFY" : "PAID" },
                "payment",
              )
            }
            disabled={busy !== null}
            className={`press mt-3 w-full rounded-full px-3 py-2 text-xs font-medium transition-opacity disabled:opacity-40 ${
              paid
                ? "border border-cream/20 text-cream/70 hover:text-cream"
                : "bg-gold text-charcoal"
            }`}
          >
            {busy === "payment"
              ? "Salvataggio…"
              : paid
                ? "Rimetti da verificare"
                : "Segna come pagato"}
          </button>
        </div>
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-cream/50">
          Nota interna
        </span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => void saveNote()}
          maxLength={2000}
          rows={3}
          placeholder="Es. bonifico da controllare, posto riservato, telefonare prima…"
          className={`${inputClass} resize-y leading-relaxed`}
        />
        <span className="mt-1.5 block text-xs text-cream/45">
          Si salva quando esci dal campo. Solo i relatori possono leggerla.
        </span>
      </label>

      {message && (
        <p className={`mt-3 text-xs ${message.includes("salvat") || message.includes("aggiornat") ? "text-emerald-200" : "text-red-300"}`}>
          {message}
        </p>
      )}
    </article>
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

  async function unlock() {
    setBusy(true);
    setMsg(null);
    const result = await api(`/api/admin/courses/${slug}/class/unlock`, {
      method: "POST",
      body: JSON.stringify({ enrollmentId, courseLessonId }),
    });
    setBusy(false);
    if (result.ok) {
      onReset();
    } else {
      setMsg(errorMessage(result, t));
    }
  }

  if (cell !== null && !cell.inProgress && cell.score === null) {
    // Nessun tentativo: o l'iscritto può ancora aprirla da sé (globalmente,
    // o con un suo sblocco), o serve un intervento del relatore — un caso
    // per volta, chi ha già perso la serata.
    return (
      <td className="p-2 text-center">
        {cell.locked ? (
          <button
            onClick={unlock}
            disabled={busy}
            title="Sblocca questa serata solo per questo iscritto"
            className="press rounded-full border border-gold/30 px-2.5 py-1.5 text-xs text-gold/80 hover:bg-gold/10 disabled:opacity-40"
          >
            {busy ? "…" : "Sblocca"}
          </button>
        ) : (
          <span className="text-cream/20">—</span>
        )}
        {msg && <p className="mt-1 text-[0.65rem] text-red-300">{msg}</p>}
      </td>
    );
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
        {cell.inProgress ? (
          <span className="text-xs text-gold/70">in corso</span>
        ) : (
          <span className="text-cream/85">
            {cell.score}
            <span className="text-cream/30">/{cell.maxScore}</span>
          </span>
        )}
        {/* Sempre visibile, non solo al passaggio del mouse: su tablet e
            telefono non esiste un hover da cui farlo comparire, e sarebbe
            altrimenti irraggiungibile col tocco. */}
        <button
          onClick={() => setConfirming(true)}
          title="Azzera il tentativo, perché lo rifaccia"
          aria-label="Azzera il tentativo"
          className="press grid min-h-8 min-w-8 place-items-center rounded-full text-sm text-cream/25 transition-colors hover:text-red-300"
        >
          ↺
        </button>
      </span>
    </td>
  );
}
