"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { CertificateData } from "@/components/Certificate";
import { CertificateView } from "@/components/CertificateView";
import { LanguageToggle, useLanguage } from "@/components/LanguageProvider";

type Status =
  | { earned: true; data: CertificateData }
  | { earned: false; done: number; required: number };

export default function CertificatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { lang, t } = useLanguage();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await api<Status>(`/api/courses/${slug}/certificate`);
      if (cancelled) return;
      if (result.ok) setStatus(result.data);
      else setError(result.offline ? t.networkError : t.genericError);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, t]);

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

  if (!status) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-cream/50">{t.checkingSession}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-8">
      <header className="no-print mb-8 flex items-center justify-between gap-4">
        <Link
          href={`/corso/${slug}`}
          className="press text-sm text-cream/55 transition-colors hover:text-cream"
        >
          ← {t.backToLessons}
        </Link>
        <LanguageToggle />
      </header>

      {status.earned ? (
        <div className="rise-in">
          <CertificateView data={status.data} />
        </div>
      ) : (
        <div className="card mx-auto max-w-md p-6 text-center">
          <p className="font-serif text-2xl text-cream">
            {lang === "en" ? "Almost there" : "Ci siamo quasi"}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-cream/60">
            {lang === "en"
              ? `You have completed ${status.done} of ${status.required} lessons. The certificate arrives when you finish them all.`
              : `Hai completato ${status.done} lezioni su ${status.required}. L'attestato arriva quando le hai fatte tutte.`}
          </p>
          <Link
            href={`/corso/${slug}`}
            className="press lift mt-5 inline-block rounded-full border border-gold/40 px-6 py-3 text-sm text-gold transition-transform"
          >
            {t.backToLessons}
          </Link>
        </div>
      )}
    </main>
  );
}
