"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { api } from "@/lib/api";
import { pick } from "@/lib/i18n";
import type { CourseOverview, LessonCard } from "@/lib/course";
import { Login } from "@/components/Login";
import { EnrollForm } from "@/components/EnrollForm";
import { UnlockDialog } from "@/components/UnlockDialog";
import { LanguageToggle, useLanguage } from "@/components/LanguageProvider";
import {
  ArrowRightIcon,
  CheckIcon,
  EyeIcon,
  LockIcon,
  MedalIcon,
  ProgressRing,
  Seal,
} from "@/components/icons";

type Overview = CourseOverview & {
  hasOtherCourses: boolean;
  user: { name: string; email: string; role: "relatore" | "corsista" };
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { status } = useSession();
  const { lang, t } = useLanguage();

  const [overview, setOverview] = useState<Overview | null>(null);
  const [needsEnrollment, setNeedsEnrollment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState<LessonCard | null>(null);

  const [reloads, setReloads] = useState(0);
  const reload = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    void (async () => {
      const result = await api<Overview>(`/api/courses/${slug}`);
      if (cancelled) return;

      if (result.ok) {
        setOverview(result.data);
        setNeedsEnrollment(false);
        setError(null);
        return;
      }
      // Chi non è iscritto non riceve un errore, ma la porta d'ingresso.
      if (result.status === 403) {
        setNeedsEnrollment(true);
        return;
      }
      setError(result.offline ? t.networkError : t.genericError);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, status, reloads, t]);

  if (status === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-cream/50">{t.checkingSession}</p>
      </main>
    );
  }
  if (status !== "authenticated") return <Login />;

  if (needsEnrollment) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        <Seal size={72} />
        <div className="mt-8">
          <EnrollForm courseSlug={slug} onEnrolled={reload} />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm text-cream/70">{error}</p>
        <button
          onClick={reload}
          className="press rounded-full bg-gold px-5 py-2 text-sm font-medium text-charcoal"
        >
          {t.confirm}
        </button>
      </main>
    );
  }

  if (!overview) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-cream/50">{t.checkingSession}</p>
      </main>
    );
  }

  const { user, course } = overview;

  // Il corso è completo quando non resta nessuna lezione da fare — comprese
  // quelle senza ancora domande, che quindi non possono mai dirsi fatte: la
  // stessa regola di src/lib/certificate.ts, qui solo per mostrare il
  // pulsante al momento giusto invece che deciderlo.
  const allDone =
    overview.lessons.length > 0 &&
    overview.lessons.every((l) => l.status === "fatto");

  // Un corso da una o due serate non riempie due colonne: la destra
  // resterebbe quasi vuota accanto a una sinistra alta e pesante. Sotto le
  // tre lezioni si passa a una colonna sola, con le lezioni in cima —
  // che sono il motivo per cui si entra.
  const compact = overview.lessons.length <= 2;

  // L'identità non è contenuto: è la conferma di chi sei. Sta
  // nell'intestazione, dove ci si aspetta di trovarla, e non occupa una card
  // nel corpo della pagina — che resta alle lezioni, ai punti e a Sorso.
  const identity = (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-bordeaux font-serif text-base text-cream ring-2 ring-gold/60">
        {initials(user.name)}
      </span>
      <div className="min-w-0">
        <p className="text-[0.6rem] font-medium uppercase tracking-[0.2em] text-gold/70">
          {lang === "en" ? "Welcome" : "Benvenuto/a"}
        </p>
        <p className="truncate font-serif text-lg leading-tight text-cream">
          {user.name}
        </p>
        {/* L'uscita sta fuori dalla riga dell'indirizzo, non dentro: lì
            veniva accorciata insieme al testo, e con `overflow: hidden`
            non spariva soltanto — finiva fuori dal riquadro e smetteva di
            rispondere al tocco. Su un telefono, e per chi è iscritto a un
            corso solo, quello è l'unico modo di uscire che esiste. */}
        <p className="truncate text-xs text-cream/50">{user.email}</p>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="press -ml-1 inline-flex min-h-9 items-center px-1 text-xs text-cream/60 underline underline-offset-2 hover:text-cream"
        >
          {t.signOut}
        </button>
      </div>
    </div>
  );

  const pointsBlock = (
    <section className="rise-in flex flex-col items-center rounded-[16px] border border-gold/25 bg-bordeaux/90 p-6">
      <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-gold/90">
        {t.totalPoints}
      </h2>
      <div className="mt-4">
        <ProgressRing value={overview.totalScore} max={overview.totalPoints} />
      </div>
      <p className="mt-4 text-xs uppercase tracking-wider text-cream/50">
        {t.currentTitle}
      </p>
      <p className="mt-1 text-center font-serif text-2xl text-gold-light">
        {overview.totalScore === 0
          ? lang === "en"
            ? "Start your journey to find out"
            : "Inizia il tuo percorso per scoprirla"
          : overview.meritTitle}
      </p>

      {/* Compare solo a corso completato: prima sarebbe una promessa
                che l'app non può ancora mantenere. */}
      {allDone && (
        <Link
          href={`/corso/${slug}/attestato`}
          className="press lift mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-medium text-charcoal transition-transform"
        >
          <MedalIcon className="h-4 w-4" />
          {lang === "en" ? "Your certificate" : "Il tuo attestato"}
        </Link>
      )}
    </section>
  );

  // App sorella (§9). Fondo scuro come le altre card: il blocco bordeaux
  // resta uno solo — quello dei punti — perché spiccava proprio in quanto
  // unica macchia di colore. Il richiamo qui viene dal pulsante in oro
  // pieno, che è la cosa su cui si clicca.
  const sorsoBlock = (
    <section className="rise-in overflow-hidden rounded-[16px] border border-gold/40 bg-charcoal-soft/70">
      <div className="p-5">
        <div className="flex items-center gap-3">
          <Seal size={48} />
          <div className="min-w-0">
            <p className="text-[0.6rem] font-medium uppercase tracking-[0.2em] text-gold">
              Sorso
            </p>
            <p className="font-serif text-xl leading-tight text-cream">
              {lang === "en"
                ? "The tasting notebook"
                : "Il taccuino di degustazione"}
            </p>
          </div>
        </div>

        <p className="mt-3.5 text-sm leading-relaxed text-cream/65">
          {lang === "en"
            ? "Rate the wines you taste, keep your own notes, and find them again on any device."
            : "Valuta i vini che assaggi, tieni traccia dei tuoi punteggi e ritrovali su qualsiasi dispositivo."}
        </p>

        <a
          href="https://sorso-taccuino.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="press lift mt-4 flex items-center justify-center gap-2 rounded-full bg-gold px-4 py-3 text-sm font-medium text-charcoal transition-transform"
        >
          {lang === "en" ? "Open Sorso" : "Apri Sorso"}
          <ArrowRightIcon className="h-4 w-4" />
        </a>
      </div>
    </section>
  );

  const lessonsBlock = (
    <div>
      <h2 className="mb-3 px-1 text-xs font-medium uppercase tracking-[0.18em] text-gold/80">
        {t.lessons}
      </h2>
      <div className={`grid gap-3 ${compact ? "" : "lg:grid-cols-2"}`}>
        {overview.lessons.map((lesson) => (
          <LessonTile
            key={lesson.courseLessonId}
            slug={slug}
            lesson={lesson}
            onUnlock={() => setUnlocking(lesson)}
          />
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* Un relatore che guarda un corso dal punto di vista dei corsisti deve
          sapere perché sta vedendo questa pagina, e come tornare indietro.
          Un corsista non incontra mai questa fascia. */}
      {user.role === "relatore" && (
        <div className="border-b border-gold/20 bg-gold/8">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-2 text-xs sm:px-8 2xl:max-w-7xl">
            <span className="flex items-center gap-2 text-gold/85">
              <EyeIcon className="h-3.5 w-3.5" />
              {lang === "en"
                ? "You are viewing this course as a student"
                : "Stai guardando il corso come lo vede un corsista"}
            </span>
            <Link
              href={`/relatore/corso/${slug}`}
              className="press shrink-0 whitespace-nowrap text-gold underline underline-offset-4"
            >
              {t.adminArea} →
            </Link>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-8 pb-28 sm:px-8 2xl:max-w-7xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-5">
          <div className="flex min-w-0 items-center gap-3">
            <Seal size={44} />
            <span className="line-clamp-2 font-serif text-lg leading-tight text-cream/90 sm:truncate">
              {pick(lang, course.titleIt, course.titleEn)}
            </span>
          </div>

          <div className="order-last flex w-full items-center justify-between gap-4 sm:order-none sm:w-auto">
            {identity}
            <LanguageToggle />
          </div>
        </header>

        {/* I blocchi sono gli stessi nelle due disposizioni: cambia solo
            come vengono impaginati. */}
        {compact ? (
          <div className="mx-auto flex max-w-xl flex-col gap-5">
            {lessonsBlock}
            {pointsBlock}
            {sorsoBlock}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
            <div className="flex flex-col gap-5">
              {pointsBlock}
              {sorsoBlock}
            </div>
            <div>{lessonsBlock}</div>
          </div>
        )}

        <div className="mt-8 flex justify-center gap-5 text-sm">
          {/* Solo per chi è iscritto a più corsi: con un corso solo la home
              rimanda qui, e il collegamento sarebbe un anello chiuso. */}
          {overview.hasOtherCourses && (
            <Link
              href="/"
              className="text-cream/60 underline underline-offset-4 hover:text-cream/70"
            >
              {t.backToCourses}
            </Link>
          )}
        </div>
      </main>

      {unlocking && (
        <UnlockDialog
          slug={slug}
          courseLessonId={unlocking.courseLessonId}
          lessonTitle={pick(lang, unlocking.titleIt, unlocking.titleEn)}
          onClose={() => setUnlocking(null)}
          onUnlocked={() => {
            setUnlocking(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function LessonTile({
  slug,
  lesson,
  onUnlock,
}: {
  slug: string;
  lesson: LessonCard;
  onUnlock: () => void;
}) {
  const { lang, t } = useLanguage();
  const title = pick(lang, lesson.titleIt, lesson.titleEn);
  const subtitle = pick(lang, lesson.subtitleIt, lesson.subtitleEn);

  const body = (
    <>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-gold/45 font-serif text-lg text-gold">
          {lesson.isExam ? "★" : String(lesson.position).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-gold/70">
            {lesson.isExam ? t.finalExam : `${t.lesson} ${lesson.position}`}
          </p>
          <p className="mt-0.5 font-serif text-lg leading-snug text-cream">
            {title}
          </p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-cream/60">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <StatusPill lesson={lesson} />
        {lesson.points > 0 && lesson.status !== "fatto" && (
          <span className="text-xs text-cream/35">
            {lesson.points} {t.points}
          </span>
        )}
      </div>
    </>
  );

  const base = "card p-4 text-left transition-transform";

  if (lesson.status === "vuoto") {
    return (
      <div className={`${base} cursor-not-allowed opacity-45`} aria-disabled>
        {body}
      </div>
    );
  }

  if (lesson.status === "bloccata") {
    return (
      <button onClick={onUnlock} className={`${base} lift press w-full`}>
        {body}
      </button>
    );
  }

  return (
    <Link
      href={`/corso/${slug}/lezione/${lesson.courseLessonId}`}
      className={`${base} lift press block`}
    >
      {body}
    </Link>
  );
}

function StatusPill({ lesson }: { lesson: LessonCard }) {
  const { t } = useLanguage();

  if (lesson.status === "vuoto") {
    return (
      <span className="pill bg-cream/8 text-cream/60">{t.comingSoon}</span>
    );
  }

  if (lesson.status === "bloccata") {
    return (
      <span className="pill bg-gold/12 text-gold">
        <LockIcon className="h-3.5 w-3.5" />
        {t.unlock}
      </span>
    );
  }

  if (lesson.status === "fatto") {
    return (
      <span className="pill bg-emerald-400/12 text-emerald-300">
        <CheckIcon className="h-3.5 w-3.5" />
        {lesson.score}/{lesson.maxScore}
      </span>
    );
  }

  return (
    <span className="pill bg-bordeaux/60 text-cream">
      {lesson.inProgress ? t.resume : t.start}
      <ArrowRightIcon className="h-3.5 w-3.5" />
    </span>
  );
}
