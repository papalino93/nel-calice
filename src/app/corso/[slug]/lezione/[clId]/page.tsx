"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { pick } from "@/lib/i18n";
import type { LessonCard } from "@/lib/course";
import { LanguageToggle, useLanguage } from "@/components/LanguageProvider";
import { ArrowRightIcon, BookIcon, Seal } from "@/components/icons";

type Material = {
  id: string;
  type: string;
  titleIt: string;
  titleEn: string | null;
  url: string;
  notes: string | null;
};

type LessonDetail = { lesson: LessonCard; materials: Material[] };

export default function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; clId: string }>;
}) {
  const { slug, clId } = use(params);
  const { lang, t } = useLanguage();
  const [detail, setDetail] = useState<LessonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await api<LessonDetail>(
        `/api/courses/${slug}/lessons/${clId}`,
      );
      if (cancelled) return;

      if (result.ok) setDetail(result.data);
      else setError(result.offline ? t.networkError : t.genericError);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, clId, t]);

  if (error) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm text-cream/70">{error}</p>
        <Link
          href={`/corso/${slug}`}
          className="text-sm text-gold underline underline-offset-4"
        >
          {t.backToLessons}
        </Link>
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-cream/50">{t.checkingSession}</p>
      </main>
    );
  }

  const { lesson, materials } = detail;
  const title = pick(lang, lesson.titleIt, lesson.titleEn);
  const subtitle = pick(lang, lesson.subtitleIt, lesson.subtitleEn);
  const done = lesson.status === "fatto";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8">
      <header className="mb-8 flex items-center justify-between gap-4">
        <Link
          href={`/corso/${slug}`}
          className="press text-sm text-cream/55 transition-colors hover:text-cream"
        >
          ← {t.backToLessons}
        </Link>
        <LanguageToggle />
      </header>

      <div className="rise-in flex flex-col items-center text-center">
        <Seal size={72}>
          <span className="grid h-full w-full place-items-center font-serif text-2xl">
            {lesson.isExam ? "★" : lesson.position}
          </span>
        </Seal>
        <p className="mt-4 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-gold/70">
          {lesson.isExam ? t.finalExam : `${t.lesson} ${lesson.position}`}
        </p>
        <h1 className="mt-1 font-serif text-3xl leading-tight text-cream sm:text-4xl">
          {title}
        </h1>
        {subtitle && <p className="mt-2 text-sm text-cream/50">{subtitle}</p>}
      </div>

      <section className="card rise-in mt-8 flex flex-col items-center p-6 text-center">
        {done ? (
          <>
            <p className="text-xs uppercase tracking-[0.18em] text-gold/80">
              {t.yourScore}
            </p>
            <p className="mt-2 font-serif text-4xl text-cream">
              {lesson.score}
              <span className="text-cream/35">/{lesson.maxScore}</span>
            </p>
            <Link
              href={`/corso/${slug}/lezione/${clId}/risultato`}
              className="press lift mt-5 inline-flex items-center gap-2 rounded-full border border-gold/40 px-6 py-3 text-sm text-gold transition-transform"
            >
              {t.seeResult}
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <Link
            href={`/corso/${slug}/lezione/${clId}/quiz`}
            className="press lift inline-flex items-center gap-2 rounded-full bg-gold px-8 py-3.5 font-medium text-charcoal transition-transform"
          >
            {lesson.inProgress ? t.resume : t.start}
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        )}
      </section>

      {/* Dispense della lezione, nella stessa pagina del quiz (§3.3) */}
      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-gold/80">
          <BookIcon className="h-4 w-4" />
          {t.materials}
        </h2>

        {materials.length === 0 ? (
          <p className="card p-5 text-sm text-cream/45">{t.noMaterials}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {materials.map((material) => (
              <li key={material.id}>
                <a
                  href={material.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card lift press flex items-center justify-between gap-3 p-4 transition-transform"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-cream">
                      {pick(lang, material.titleIt, material.titleEn)}
                    </span>
                    {material.notes && (
                      <span className="block truncate text-xs text-cream/45">
                        {material.notes}
                      </span>
                    )}
                  </span>
                  <span className="pill shrink-0 bg-cream/8 text-cream/50">
                    {material.type}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
