"use client";

import { useRef, useState } from "react";
import {
  Certificate,
  type CertificateData,
} from "@/components/Certificate";
import { downloadSvgAsPng } from "@/lib/svgToPng";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * L'attestato a schermo, con i suoi due modi di portarselo via.
 *
 * Sia il PNG che la stampa partono dallo stesso nodo SVG qui sotto: non
 * esiste una seconda versione da tenere allineata (§7.11).
 */
export function CertificateView({
  data,
  showShare = true,
}: {
  data: CertificateData;
  showShare?: boolean;
}) {
  const { lang } = useLanguage();
  const wrapper = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileName = `attestato-${data.name.toLowerCase().replace(/\s+/g, "-")}.png`;

  async function download() {
    const svg = wrapper.current?.querySelector("svg");
    if (!svg) return;

    setBusy(true);
    setError(null);
    try {
      await downloadSvgAsPng(svg as SVGSVGElement, fileName);
    } catch {
      setError(
        lang === "en"
          ? "Could not create the image. Try printing instead."
          : "Non è stato possibile creare l'immagine. Prova con la stampa.",
      );
    }
    setBusy(false);
  }

  const shareText =
    lang === "en"
      ? `I took part in "${data.courseTitle}" and earned the title of ${data.meritTitle}! 🍷`
      : `Ho partecipato al corso "${data.courseTitle}" e mi sono meritato il titolo di ${data.meritTitle}! 🍷`;

  return (
    <div>
      <div
        ref={wrapper}
        className="certificate-sheet overflow-hidden rounded-[16px] border border-gold/35 shadow-xl shadow-black/30"
      >
        <Certificate data={data} />
      </div>

      <div className="no-print mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={download}
          disabled={busy}
          className="press lift rounded-full bg-gold px-6 py-3 text-sm font-medium text-charcoal transition-transform disabled:opacity-50"
        >
          {lang === "en" ? "Download image" : "Scarica la pergamena"}
        </button>

        <button
          onClick={() => window.print()}
          className="press rounded-full border border-gold/40 px-6 py-3 text-sm text-gold transition-colors hover:bg-gold/10"
        >
          {lang === "en" ? "Print" : "Stampa"}
        </button>

        {showShare && (
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="press rounded-full border border-cream/20 px-6 py-3 text-sm text-cream/70 transition-colors hover:text-cream"
          >
            {lang === "en" ? "Share on WhatsApp" : "Condividi su WhatsApp"}
          </a>
        )}
      </div>

      {error && (
        <p className="no-print mt-3 text-center text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
