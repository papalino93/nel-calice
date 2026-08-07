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
};

type MyCourses = {
  user: { name: string; email: string; role: "relatore" | "corsista" };
  courses: CourseRow[];
};

/**
 * Smistamento dopo il login.
 *
 * - relatore  → area riservata (da lì può comunque passare alla vista corsista)
 * - un corso  → dentro, senza far scegliere fra un'opzione sola
 * - più corsi → elenco
 * - nessuno   → campo del codice
 */
export default function Home() {
  const { status } = useSession();
  const { lang, t } = useLanguage();
  const router = useRouter();

  const [data, setData] = useState<MyCourses | null>(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    void (async () => {
      const result = await api<MyCourses>("/api/courses");
      if (cancelled || !result.ok) return;

      if (result.data.user.role === "relatore") {
        router.replace("/relatore");
        return;
      }
      if (result.data.courses.length === 1) {
        router.replace(`/corso/${result.data.courses[0].slug}`);
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

  if (!data) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-cream/50">{t.checkingSession}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-10 sm:px-8">
      <header className="mb-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Seal size={40} />
          <span className="font-serif text-lg text-cream/90">
            {t.courseTitle}
          </span>
        </div>
        <LanguageToggle />
      </header>

      <div className="rise-in flex flex-1 flex-col items-center">
        <p className="text-sm text-cream/45">
          {t.signedInAs} {data.user.email} ·{" "}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="underline underline-offset-2 hover:text-cream/70"
          >
            {t.signOut}
          </button>
        </p>

        {data.courses.length === 0 ? (
          <div className="mt-10 flex w-full flex-col items-center">
            <p className="mb-5 text-sm text-cream/60">{t.noCoursesYet}</p>
            <EnrollForm onEnrolled={() => setReloads((n) => n + 1)} />
          </div>
        ) : (
          <div className="mt-10 w-full">
            <h1 className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-gold/80">
              {t.myCourses}
            </h1>
            <ul className="flex flex-col gap-3">
              {data.courses.map((course) => (
                <li key={course.slug}>
                  <Link
                    href={`/corso/${course.slug}`}
                    className="card lift press flex items-center justify-between gap-4 p-5 transition-transform"
                  >
                    <span className="min-w-0">
                      <span className="block font-serif text-xl text-cream">
                        {pick(lang, course.titleIt, course.titleEn)}
                      </span>
                      <span className="block truncate text-xs text-cream/45">
                        {pick(lang, course.subtitleIt, course.subtitleEn)}
                      </span>
                    </span>
                    <ArrowRightIcon className="h-5 w-5 shrink-0 text-gold" />
                  </Link>
                </li>
              ))}
            </ul>

            <details className="mt-8">
              <summary className="cursor-pointer text-center text-sm text-cream/45 hover:text-cream/70">
                + {t.enrollTitle}
              </summary>
              <div className="mt-4 flex justify-center">
                <EnrollForm onEnrolled={() => setReloads((n) => n + 1)} />
              </div>
            </details>
          </div>
        )}
      </div>
    </main>
  );
}
