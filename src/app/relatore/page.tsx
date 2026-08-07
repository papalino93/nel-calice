"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { api } from "@/lib/api";
import { pick } from "@/lib/i18n";
import { Login } from "@/components/Login";
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
  }, [status, t]);

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

      <p className="text-xs text-cream/40">
        {data.user.email} ·{" "}
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="underline underline-offset-2 hover:text-cream/70"
        >
          {t.signOut}
        </button>
      </p>

      <section className="mt-8">
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
                  <p className="mt-0.5 truncate text-xs text-cream/45">
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
          <p className="card p-5 text-sm text-cream/45">
            {lang === "en"
              ? "No courses yet."
              : "Nessun corso, per ora."}
          </p>
        )}
      </section>

      {/* La home dei corsisti non è raggiungibile da un relatore: entrando
          verrebbe rimandato qui. Questo collegamento salta il dirottamento,
          per controllare cosa vede chi arriva la prima sera. */}
      <div className="mt-4">
        <Link
          href="/?vista=corsista"
          className="press inline-flex items-center gap-1.5 text-xs text-cream/45 underline underline-offset-4 hover:text-cream/70"
        >
          <EyeIcon className="h-3.5 w-3.5" />
          {lang === "en"
            ? "See the students' home page"
            : "Vedi la pagina d'ingresso dei corsisti"}
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-gold/80">
          {lang === "en" ? "Lesson catalogue" : "Catalogo lezioni"}
        </h2>
        <Link
          href="/relatore/catalogo"
          className="card lift press flex items-center justify-between gap-4 p-5 transition-transform"
        >
          <span>
            <span className="block font-serif text-lg text-cream">
              {data.catalogueSize}{" "}
              {lang === "en" ? "lessons available" : "lezioni disponibili"}
            </span>
            <span className="block text-xs text-cream/45">
              {lang === "en"
                ? "Written once, reusable in any course"
                : "Scritte una volta, riusabili in qualsiasi corso"}
            </span>
          </span>
          <ArrowRightIcon className="h-5 w-5 shrink-0 text-gold" />
        </Link>
      </section>
    </main>
  );
}
