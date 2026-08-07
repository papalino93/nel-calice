"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { api } from "@/lib/api";
import { pick } from "@/lib/i18n";
import type { CourseOverview, LessonCard } from "@/lib/course";
import { LanguageToggle, useLanguage } from "@/components/LanguageProvider";
import { UnlockDialog } from "@/components/UnlockDialog";
import {
  ArrowRightIcon,
  CheckIcon,
  GlassIcon,
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

export function Dashboard() {
  const { lang, t } = useLanguage();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState<LessonCard | null>(null);

  // Contatore di ricariche: cambiandolo si rilancia l'effetto, senza dover
  // chiamare una funzione che aggiorna lo stato dall'interno dell'effetto.
  const [reloads, setReloads] = useState(0);
  const reload = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await api<Overview>("/api/course");
      if (cancelled) return;

      if (result.ok) {
        setOverview(result.data);
        setError(null);
      } else {
        setError(result.offline ? t.networkError : t.genericError);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [t, reloads]);

  if (error && !overview) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="card max-w-sm p-6 text-center">
          <p className="text-sm text-cream/70">{error}</p>
          <button
            onClick={reload}
            className="press mt-4 rounded-full bg-gold px-5 py-2 text-sm font-medium text-charcoal"
          >
            {t.confirm}
          </button>
        </div>
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

  const { user } = overview;

  return (
    <>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 2xl:max-w-7xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Seal size={44} />
            <span className="font-serif text-lg leading-tight text-cream/90">
              {t.courseTitle}
            </span>
          </div>
          <LanguageToggle />
        </header>

        <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
          {/* Colonna sinistra — chi sei e a che punto sei */}
          <div className="flex flex-col gap-5">
            <section className="card rise-in p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-bordeaux font-serif text-lg text-cream">
                  {initials(user.name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-serif text-xl text-cream">
                    {user.name}
                  </p>
                  <p className="truncate text-xs text-cream/45">
                    {t.signedInAs} {user.email} ·{" "}
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="underline underline-offset-2 hover:text-cream/70"
                    >
                      {t.signOut}
                    </button>
                  </p>
                </div>
              </div>
            </section>

            <section className="card rise-in flex flex-col items-center p-6">
              <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-gold/80">
                {t.totalPoints}
              </h2>
              <div className="mt-4">
                <ProgressRing
                  value={overview.totalScore}
                  max={overview.totalPoints}
                />
              </div>
              <p className="mt-4 text-xs uppercase tracking-wider text-cream/40">
                {t.currentTitle}
              </p>
              <p className="mt-1 font-serif text-2xl text-gold">
                {overview.meritTitle}
              </p>
            </section>

            {/* App sorella, si apre in nuova scheda (§9) */}
            <a
              href="https://sorso-taccuino.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="card lift press flex items-center gap-3 p-4 transition-transform"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/12 text-gold">
                <GlassIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-serif text-lg text-cream">Sorso</span>
                <span className="block truncate text-xs text-cream/45">
                  {lang === "en"
                    ? "Your tasting notebook"
                    : "Il tuo taccuino di degustazione"}
                </span>
              </span>
            </a>
          </div>

          {/* Colonna destra — le lezioni */}
          <div>
            <h2 className="mb-3 px-1 text-xs font-medium uppercase tracking-[0.18em] text-gold/80">
              {t.lessons}
            </h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {overview.lessons.map((lesson) => (
                <LessonTile
                  key={lesson.id}
                  lesson={lesson}
                  onUnlock={() => setUnlocking(lesson)}
                />
              ))}
            </div>

            {user.role === "relatore" && (
              <div className="mt-6 text-center">
                <Link
                  href="/relatore"
                  className="text-sm text-gold/80 underline underline-offset-4 hover:text-gold"
                >
                  {t.adminArea}
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

      {unlocking && (
        <UnlockDialog
          lessonId={unlocking.id}
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
  lesson,
  onUnlock,
}: {
  lesson: LessonCard;
  onUnlock: () => void;
}) {
  const { lang, t } = useLanguage();
  const title = pick(lang, lesson.titleIt, lesson.titleEn);
  const subtitle = pick(lang, lesson.subtitleIt, lesson.subtitleEn);

  const body = (
    <>
      <div className="flex items-start gap-3">
        <span className="font-serif text-3xl leading-none text-gold/45">
          {lesson.isExam ? "★" : lesson.id}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-lg leading-snug text-cream">{title}</p>
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
    <Link href={`/lezione/${lesson.id}`} className={`${base} lift press block`}>
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
    <span className="pill bg-bordeaux/45 text-cream">
      {lesson.inProgress ? t.resume : t.start}
      <ArrowRightIcon className="h-3.5 w-3.5" />
    </span>
  );
}
