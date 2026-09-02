"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { api } from "@/lib/api";
import { pick } from "@/lib/i18n";
import { Login } from "@/components/Login";
import { EnrollForm } from "@/components/EnrollForm";
import { LanguageToggle, useLanguage } from "@/components/LanguageProvider";
import { ArrowRightIcon, Seal } from "@/components/icons";

type CourseRow = {
  slug: string;
  titleIt: string;
  titleEn: string;
  subtitleIt: string | null;
  subtitleEn: string | null;
  status: string;
  enrolledAt: string;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

type MyCourses = {
  user: { name: string; email: string; role: "relatore" | "corsista" };
  courses: CourseRow[];
};

/**
 * Smistamento dopo il login.
 *
 * - relatore  → area riservata (da lì può comunque passare alla vista corsista)
 * - uno o più corsi → area personale, da cui riprendere senza dover
 *   ricordare un link o "dove si era rimasti"
 * - nessuno   → campo del codice
 */
export default function Home() {
  const { status } = useSession();
  const { lang, t } = useLanguage();
  const router = useRouter();

  const [data, setData] = useState<MyCourses | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    void (async () => {
      const result = await api<MyCourses>("/api/courses");
      if (cancelled) return;

      if (!result.ok) {
        // Su 401 `api` chiede la chiusura della sessione, e normalmente la
        // schermata di accesso arriva da sé al render successivo. Ma quella
        // chiusura è a sua volta una richiesta di rete: se non riesce, lo
        // stato resta "authenticated" e senza dati, cioè fermo per sempre su
        // «Un momento…». La via d'uscita si mostra in ogni caso.
        setLoadError(true);
        return;
      }

      // Un relatore atterra normalmente nell'area riservata. Con
      // `?vista=corsista` il dirottamento si salta: serve a controllare cosa
      // vede davvero chi arriva la prima sera, campo del codice compreso.
      const asStudent =
        new URLSearchParams(window.location.search).get("vista") === "corsista";

      if (result.data.user.role === "relatore" && !asStudent) {
        router.replace("/relatore");
        return;
      }
      setData(result.data);
    })();

    return () => {
      cancelled = true;
    };
  }, [status, reloads, router]);

  // Mentre si verifica la sessione non si mostra il pulsante di login, così
  // non lampeggia a chi è già collegato (§3.1).
  if (status === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-cream/50">{t.checkingSession}</p>
      </main>
    );
  }

  if (status !== "authenticated") return <Login />;

  if (loadError) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-cream/70">{t.genericError}</p>
        <button
          onClick={() => {
            setLoadError(false);
            setReloads((n) => n + 1);
          }}
          className="press rounded-full bg-gold px-5 py-2 text-sm font-medium text-charcoal"
        >
          {t.confirm}
        </button>
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

  const currentCourse = data.courses[0];
  // Il corso in evidenza NON si ripete nell'elenco sotto: con una sola
  // iscrizione — il caso di quasi tutti — la stessa riga compariva due
  // volte, in una card grande e poi in una piccola, con accanto «1 corso».
  const otherCourses = data.courses.slice(1);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pt-8 pb-28 sm:px-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-bordeaux font-serif text-base text-cream ring-2 ring-gold/60">
            {initials(data.user.name)}
          </span>
          <div className="min-w-0">
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-gold/75">
              {t.personalArea}
            </p>
            <p className="truncate font-serif text-xl leading-tight text-cream">
              {data.user.name}
            </p>
            <p className="truncate text-xs text-cream/55">{data.user.email}</p>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="press -ml-1 mt-1 inline-flex min-h-9 items-center px-1 text-xs text-cream/60 underline underline-offset-2 hover:text-cream"
            >
              {t.signOut}
            </button>
          </div>
        </div>
        <LanguageToggle />
      </header>

      <div className="rise-in flex flex-1 flex-col">
        {data.courses.length === 0 ? (
          <div className="mt-8 flex w-full flex-col items-center text-center">
            <Seal size={64} />
            <h1 className="mt-5 font-serif text-3xl text-cream">
              {t.journeyStarts}
            </h1>
            <p className="mt-2 mb-5 max-w-sm text-sm leading-relaxed text-cream/65">
              {t.journeyStartsHint}
            </p>
            <EnrollForm onEnrolled={() => setReloads((n) => n + 1)} />
          </div>
        ) : (
          <div className="w-full">
            {currentCourse && (
              <section className="rounded-card border border-gold/40 bg-bordeaux/35 p-5 shadow-[0_14px_36px_rgba(0,0,0,0.2)]">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-gold-light/90">
                  {t.continueHere}
                </p>
                <h1 className="mt-1 font-serif text-2xl text-cream">
                  {pick(lang, currentCourse.titleIt, currentCourse.titleEn)}
                </h1>
                <p className="mt-1 text-sm text-cream/70">
                  {pick(
                    lang,
                    currentCourse.subtitleIt,
                    currentCourse.subtitleEn,
                  ) || t.courseReady}
                </p>
                <Link
                  href={`/corso/${currentCourse.slug}`}
                  className="press lift mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-charcoal transition-transform"
                >
                  {t.openMyCourse}
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </section>
            )}

            {otherCourses.length > 0 && (
              <>
                {/* Non è un `h1`: la pagina ne ha già uno, il titolo del
                    corso in evidenza. Questa è un'etichetta di sezione. */}
                <div className="mt-8 mb-4 flex items-end justify-between gap-4">
                  <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-gold/80">
                    {t.otherCourses}
                  </h2>
                  <span className="text-xs text-cream/60">
                    {t.coursesCount(data.courses.length)}
                  </span>
                </div>
                <ul className="flex flex-col gap-3">
                  {otherCourses.map((course) => {
                    const subtitle = pick(
                      lang,
                      course.subtitleIt,
                      course.subtitleEn,
                    );
                    return (
                      <li key={course.slug}>
                        <Link
                          href={`/corso/${course.slug}`}
                          className="card lift press flex items-center justify-between gap-4 p-5 transition-transform"
                        >
                          <span className="min-w-0">
                            <span className="block font-serif text-xl text-cream">
                              {pick(lang, course.titleIt, course.titleEn)}
                            </span>
                            {/* Senza sottotitolo non si stampa una riga
                                vuota, che lasciava uno spazio inspiegato. */}
                            {subtitle && (
                              <span className="block truncate text-xs text-cream/60">
                                {subtitle}
                              </span>
                            )}
                          </span>
                          <ArrowRightIcon className="h-5 w-5 shrink-0 text-gold" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            <details className="mt-8 rounded-card border border-cream/10 p-4">
              <summary className="cursor-pointer text-center text-sm text-cream/45 hover:text-cream/70">
                + {t.enrollTitle}
              </summary>
              <div className="mt-4 flex justify-center">
                <EnrollForm
                  autoFocus={false}
                  onEnrolled={() => setReloads((n) => n + 1)}
                />
              </div>
            </details>
          </div>
        )}
      </div>
    </main>
  );
}
