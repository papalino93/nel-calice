"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { api, errorMessage, post } from "@/lib/api";
import { pick } from "@/lib/i18n";
import { Login } from "@/components/Login";
import { Field, buttonClass, inputClass } from "@/components/admin/AdminShell";
import { LanguageToggle, useLanguage } from "@/components/LanguageProvider";
import { ArrowRightIcon, EyeIcon, Seal } from "@/components/icons";

type AdminCourse = {
  slug: string;
  titleIt: string;
  titleEn: string;
  subtitleIt: string | null;
  subtitleEn: string | null;
  status: string;
  enrollmentOpen: boolean;
  enrollmentCode: string;
  lessonCount: number;
  enrolledCount: number;
};

type AdminHome = {
  user: { name: string; email: string };
  courses: AdminCourse[];
  catalogueSize: number;
};

/**
 * Casa del relatore: è qui che atterra appena fa login, non nella dashboard
 * dei corsisti. Da qui può comunque passare alla vista di un corso come lo
 * vede un iscritto — serve per controllare, o per fare un quiz insieme
 * alla classe.
 */
export default function AdminHomePage() {
  const { status } = useSession();
  const { lang, t } = useLanguage();
  const [data, setData] = useState<AdminHome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  const reload = useCallback(() => setReloads((n) => n + 1), []);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    void (async () => {
      const result = await api<AdminHome>("/api/admin");
      if (cancelled) return;
      if (result.ok) setData(result.data);
      else setError(result.offline ? t.networkError : t.genericError);
    })();

    return () => {
      cancelled = true;
    };
  }, [status, t, reloads]);

  if (status === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-cream/50">{t.checkingSession}</p>
      </main>
    );
  }
  if (status !== "authenticated") return <Login />;

  if (error) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-cream/70">{error}</p>
        <Link href="/" className="text-sm text-gold underline underline-offset-4">
          {t.backToCourses}
        </Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-cream/50">{t.checkingSession}</p>
      </main>
    );
  }

  const currentCourse =
    data.courses.find((course) => course.status === "ACTIVE") ?? data.courses[0];
  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Seal size={44} />
          <div>
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-gold/70">
              {t.adminArea}
            </p>
            <p className="font-serif text-xl leading-tight text-cream">
              {data.user.name}
            </p>
          </div>
        </div>
        <LanguageToggle />
      </header>

      <p className="text-xs text-cream/60">
        {data.user.email} ·{" "}
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="underline underline-offset-2 hover:text-cream/70"
        >
          {t.signOut}
        </button>
      </p>

      {currentCourse && (
        <section className="mt-7" aria-labelledby="riprendi-da-qui">
          <h2
            id="riprendi-da-qui"
            className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-gold/80"
          >
            {lang === "en" ? "Pick up from here" : "Ricomincia da qui"}
          </h2>
          <div className="rounded-card border border-gold/40 bg-bordeaux/35 p-5 shadow-[0_14px_36px_rgba(0,0,0,0.2)]">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-gold-light/90">
              {currentCourse.status === "ACTIVE"
                ? lang === "en" ? "Course in progress" : "Corso attivo"
                : lang === "en" ? "Course to prepare" : "Corso da preparare"}
            </p>
            <h2 className="mt-1 font-serif text-2xl text-cream">
              {pick(lang, currentCourse.titleIt, currentCourse.titleEn)}
            </h2>
            <p className="mt-1 text-sm text-cream/70">
              {currentCourse.lessonCount} {lang === "en" ? "lessons" : "lezioni"} · {currentCourse.enrolledCount} {lang === "en" ? "enrolled" : "iscritti"}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/relatore/corso/${currentCourse.slug}`}
                className="press inline-flex min-h-10 items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-medium text-charcoal"
              >
                {lang === "en" ? "Manage this course" : "Gestisci questo corso"}
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
              <Link
                href={`/relatore/corso/${currentCourse.slug}/classe`}
                className="press inline-flex min-h-10 items-center rounded-full border border-cream/25 px-4 py-2 text-sm text-cream/85"
              >
                {lang === "en" ? "Class progress" : "Andamento classe"}
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-cream/15 pt-4">
              <span className="text-xs text-cream/70">
                {lang === "en" ? "Enrollment code:" : "Codice iscrizione:"}
              </span>
              <code className="rounded-lg bg-charcoal/45 px-2.5 py-1.5 font-serif text-sm tracking-[0.14em] text-gold-light">
                {currentCourse.enrollmentCode}
              </code>
              <button
                onClick={() => void copyCode(currentCourse.enrollmentCode)}
                className="press min-h-10 rounded-full px-3 text-xs text-gold underline underline-offset-4"
              >
                {copied === currentCourse.enrollmentCode
                  ? lang === "en" ? "Copied" : "Copiato"
                  : lang === "en" ? "Copy" : "Copia"}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="mt-7 rounded-card border border-cream/10 bg-charcoal-soft/50 p-4">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-gold/70">
          {lang === "en" ? "How a student enrolls" : "Come si iscrive un corsista"}
        </p>
        <ol className="mt-2.5 flex flex-col gap-1.5 text-sm text-cream/70">
          <li>
            1.{" "}
            {lang === "en"
              ? "Signs in with Google."
              : "Entra con Google."}
          </li>
          <li>
            2.{" "}
            {lang === "en"
              ? "Enters the enrollment code you gave them."
              : "Inserisce il codice d'iscrizione che gli hai dato."}
          </li>
          <li>
            3.{" "}
            {lang === "en"
              ? "Is in: quizzes and handouts unlock evening by evening."
              : "È dentro: quiz e materiali si sbloccano serata dopo serata."}
          </li>
        </ol>
        <Link
          href="/relatore/impostazioni"
          className="press mt-3 inline-flex min-h-9 items-center text-xs text-gold/80 underline underline-offset-4 hover:text-gold"
        >
          {lang === "en" ? "See the full guide" : "Vedi la guida completa"}
        </Link>
      </section>

      <section className="mt-9">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-gold/80">
          {lang === "en" ? "Courses" : "Corsi"}
        </h2>

        <ul className="flex flex-col gap-3">
          {data.courses.map((course) => (
            <li key={course.slug} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-serif text-xl text-cream">
                    {pick(lang, course.titleIt, course.titleEn)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-cream/60">
                    /corso/{course.slug}
                  </p>
                  <p className="mt-2 text-xs text-cream/50">
                    {course.lessonCount}{" "}
                    {lang === "en" ? "lessons" : "lezioni"} ·{" "}
                    {course.enrolledCount}{" "}
                    {lang === "en" ? "enrolled" : "iscritti"}
                  </p>
                </div>
                <span
                  className={`pill shrink-0 ${
                    course.status === "ACTIVE"
                      ? "bg-emerald-400/12 text-emerald-300"
                      : course.status === "DRAFT"
                        ? "bg-cream/8 text-cream/50"
                        : "bg-gold/12 text-gold"
                  }`}
                >
                  {course.status}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/relatore/corso/${course.slug}`}
                  className="press lift inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-medium text-charcoal transition-transform"
                >
                  {lang === "en" ? "Manage" : "Gestisci"}
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </Link>
                {/* Il relatore deve poter vedere il corso come lo vedono i
                    corsisti — anche solo per fare un quiz insieme in aula. */}
                <Link
                  href={`/corso/${course.slug}`}
                  className="press inline-flex items-center rounded-full border border-cream/20 px-4 py-2 text-sm text-cream/70 transition-colors hover:text-cream"
                >
                  {t.studentView}
                </Link>
              </div>
            </li>
          ))}
        </ul>

        {data.courses.length === 0 && (
          <p className="card p-5 text-sm text-cream/60">
            {lang === "en"
              ? "No courses yet."
              : "Nessun corso, per ora."}
          </p>
        )}

        <NewCourse onCreated={reload} />
      </section>

      {/* La home dei corsisti non è raggiungibile da un relatore: entrando
          verrebbe rimandato qui. Questo collegamento salta il dirottamento,
          per controllare cosa vede chi arriva la prima sera. */}
      <div className="mt-4">
        <Link
          href="/?vista=corsista"
          className="press inline-flex items-center gap-1.5 text-xs text-cream/60 underline underline-offset-4 hover:text-cream/70"
        >
          <EyeIcon className="h-3.5 w-3.5" />
          {lang === "en"
            ? "See the students' home page"
            : "Vedi la pagina d'ingresso dei corsisti"}
        </Link>
      </div>

      <section className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link
          href="/relatore/impostazioni"
          className="card lift press flex items-center justify-between gap-4 p-5 transition-transform"
        >
          <span>
            <span className="block font-serif text-lg text-cream">
              {lang === "en" ? "Settings" : "Impostazioni"}
            </span>
            <span className="block text-xs text-cream/55">
              {lang === "en"
                ? "People, access and the things you should not have to remember"
                : "Persone, accessi e tutto ciò che non devi ricordare a memoria"}
            </span>
          </span>
          <ArrowRightIcon className="h-5 w-5 shrink-0 text-gold" />
        </Link>

        <Link
          href="/relatore/catalogo"
          className="card lift press flex items-center justify-between gap-4 p-5 transition-transform"
        >
          <span>
            <span className="block font-serif text-lg text-cream">
              {data.catalogueSize} {lang === "en" ? "lessons available" : "lezioni disponibili"}
            </span>
            <span className="block text-xs text-cream/55">
              {lang === "en"
                ? "Reusable content, questions and handouts"
                : "Contenuti, domande e dispense riusabili"}
            </span>
          </span>
          <ArrowRightIcon className="h-5 w-5 shrink-0 text-gold" />
        </Link>
      </section>

    </main>
  );
}

/**
 * Crea un corso nuovo, vuoto — l'unico modo che c'era prima era il seed
 * iniziale del database, che non regge una seconda edizione.
 *
 * Nasce sempre "In preparazione", senza lezioni: quelle si aggiungono dal
 * pannello del corso appena creato, per cui si viene mandati subito dopo.
 * Lo slug (l'indirizzo) è calcolato dal titolo, non chiesto: il relatore non
 * deve inventarsi un percorso, e se il titolo si ripete diventa unico da solo.
 */
function NewCourse({ onCreated }: { onCreated: () => void }) {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [titleIt, setTitleIt] = useState("");
  const [enrollmentCode, setEnrollmentCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setMsg(null);
    const result = await post<{ slug: string }>("/api/admin/courses", {
      titleIt: titleIt.trim(),
      enrollmentCode,
    });
    setBusy(false);
    if (result.ok) {
      onCreated();
      router.push(`/relatore/corso/${result.data.slug}`);
    } else {
      setMsg(errorMessage(result, t));
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="press mt-3 inline-flex min-h-10 items-center text-sm text-gold/80 underline underline-offset-4 hover:text-gold"
      >
        + {lang === "en" ? "New course" : "Nuovo corso"}
      </button>
    );
  }

  return (
    <div className="card mt-3 p-5">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <Field label={lang === "en" ? "Course title" : "Titolo del corso"}>
          <input
            value={titleIt}
            onChange={(e) => setTitleIt(e.target.value)}
            placeholder={
              lang === "en" ? "e.g. Autumn Reds" : "Per esempio: Rossi d'Autunno"
            }
            className={inputClass}
          />
        </Field>
        <Field label={lang === "en" ? "Enrolment code" : "Codice d'iscrizione"}>
          <input
            value={enrollmentCode}
            onChange={(e) => setEnrollmentCode(e.target.value)}
            className={`${inputClass} font-serif tracking-[0.15em] uppercase`}
            autoCapitalize="characters"
            spellCheck={false}
          />
        </Field>
        <button
          onClick={create}
          disabled={!titleIt.trim() || !enrollmentCode.trim() || busy}
          className={buttonClass}
        >
          {lang === "en" ? "Create" : "Crea"}
        </button>
      </div>
      <p className="mt-3 text-xs text-cream/60">
        {lang === "en"
          ? "It starts empty, in preparation: add lessons and an English title from its own page."
          : "Nasce vuoto e in preparazione: le lezioni e il titolo inglese si aggiungono dalla sua pagina."}
      </p>
      {msg && <p className="mt-2 text-sm text-red-300">{msg}</p>}
    </div>
  );
}
