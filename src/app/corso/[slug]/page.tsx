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
  LockIcon,
  ProgressRing,
  Seal,
} from "@/components/icons";

type Overview = CourseOverview & {
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

  return (
    <>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 2xl:max-w-7xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Seal size={44} />
            <span className="truncate font-serif text-lg leading-tight text-cream/90">
              {pick(lang, course.titleIt, course.titleEn)}
            </span>
          </div>
          <LanguageToggle />
        </header>

        <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
          <div className="flex flex-col gap-5">
            <section className="card rise-in p-5">
              <div className="flex items-center gap-3.5">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-bordeaux font-serif text-xl text-cream ring-2 ring-gold/60">
                  {initials(user.name)}
                </span>
                <div className="min-w-0">
                  <p className="text-[0.6rem] font-medium uppercase tracking-[0.2em] text-gold/70">
                    {lang === "en" ? "Welcome" : "Benvenuto/a"}
                  </p>
                  <p className="truncate font-serif text-2xl leading-tight text-cream">
                    {user.name}
                  </p>
                </div>
              </div>
              <p className="mt-3 truncate text-xs text-cream/45">
                {t.signedInAs} {user.email} ·{" "}
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="underline underline-offset-2 hover:text-cream/70"
                >
                  {t.signOut}
                </button>
              </p>
            </section>

            <section className="rise-in flex flex-col items-center rounded-[16px] border border-gold/25 bg-bordeaux/90 p-6">
              <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-gold/90">
                {t.totalPoints}
              </h2>
              <div className="mt-4">
                <ProgressRing
                  value={overview.totalScore}
                  max={overview.totalPoints}
                />
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
            </section>

            {/* App sorella, si apre in nuova scheda (§9) */}
            <section className="rise-in rounded-[16px] border border-gold/35 bg-charcoal-soft/70 p-5">
              <div className="flex items-center gap-3">
                <Seal size={44} />
                <div className="min-w-0">
                  <p className="text-[0.6rem] font-medium uppercase tracking-[0.2em] text-gold/70">
                    Sorso
                  </p>
                  <p className="font-serif text-lg leading-tight text-cream">
                    {lang === "en"
                      ? "The tasting notebook"
                      : "Il taccuino di degustazione"}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-cream/50">
                {lang === "en"
                  ? "Rate the wines you taste, keep your own notes, and find them again on any device."
                  : "Valuta i vini che assaggi, tieni traccia dei tuoi punteggi e ritrovali su qualsiasi dispositivo."}
              </p>

              <a
                href="https://sorso-taccuino.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="press lift mt-4 flex items-center justify-center gap-2 rounded-full border border-gold/40 px-4 py-2.5 text-sm text-gold transition-transform"
              >
                {lang === "en" ? "Open Sorso" : "Apri Sorso"}
                <ArrowRightIcon className="h-4 w-4" />
              </a>
            </section>
          </div>

          <div>
            <h2 className="mb-3 px-1 text-xs font-medium uppercase tracking-[0.18em] text-gold/80">
              {t.lessons}
            </h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {overview.lessons.map((lesson) => (
                <LessonTile
                  key={lesson.courseLessonId}
                  slug={slug}
                  lesson={lesson}
                  onUnlock={() => setUnlocking(lesson)}
                />
              ))}
            </div>

            <div className="mt-6 flex justify-center gap-5 text-sm">
              <Link
                href="/"
                className="text-cream/45 underline underline-offset-4 hover:text-cream/70"
              >
                {t.backToCourses}
              </Link>
              {user.role === "relatore" && (
                <Link
                  href="/relatore"
                  className="text-gold/80 underline underline-offset-4 hover:text-gold"
                >
                  {t.adminArea}
                </Link>
              )}
            </div>
          </div>
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
            <p className="mt-0.5 text-xs text-cream/45">{subtitle}</p>
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
    return <span className="pill bg-cream/8 text-cream/45">{t.comingSoon}</span>;
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
