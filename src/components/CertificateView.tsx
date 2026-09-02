"use client";

import { useRef, useState } from "react";
import {
  Certificate,
  type CertificateData,
} from "@/components/Certificate";
import { downloadBlob, svgToPngBlob } from "@/lib/svgToPng";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * Safari iOS non è affidabile con `<a download>` su un blob (§7.17): a
 * volte non salva nulla, senza nemmeno un errore visibile — è il difetto
 * segnalato dal committente provando da telefono. Il foglio di
 * condivisione nativo (`navigator.share`) non ha questo problema, ha
 * "Salva immagine" già fra le opzioni, e in più mette WhatsApp a
 * disposizione con il file vero attaccato, non solo un testo. Si prova
 * prima con un file finto: `canShare` può esistere ma rifiutare i file su
 * alcuni browser (soprattutto desktop), e va scoperto senza già aver
 * ridisegnato la pergamena su canvas per niente.
 */
function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  try {
    const probe = new File([""], "probe.png", { type: "image/png" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/**
 * Il foglio di condivisione va preferito solo dove serve davvero, cioè sul
 * telefono. Su Chrome desktop `canShare` con i file risponde sì, quindi un
 * pulsante che dice «Scarica la pergamena» apriva il pannello di
 * condivisione del sistema — la stessa cosa del pulsante WhatsApp accanto,
 * e nessun modo di ottenere il file su disco. Il puntatore grosso distingue
 * il telefono meglio di qualunque elenco di browser.
 */
function prefersShareSheet(): boolean {
  if (!canShareFiles()) return false;
  try {
    return window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

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

  async function pngFile(): Promise<File | null> {
    const svg = wrapper.current?.querySelector("svg");
    if (!svg) return null;
    const blob = await svgToPngBlob(svg as SVGSVGElement);
    return new File([blob], fileName, { type: "image/png" });
  }

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const file = await pngFile();
      if (!file) {
        // Senza questo il click non produceva nulla e nessun messaggio:
        // impossibile capire se stesse lavorando o fosse rotto.
        setError(
          lang === "en"
            ? "Could not create the image. Try printing instead."
            : "Non è stato possibile creare l'immagine. Prova con la stampa.",
        );
        setBusy(false);
        return;
      }
      if (prefersShareSheet()) {
        await navigator.share({ files: [file] });
      } else {
        downloadBlob(file, fileName);
      }
    } catch (err) {
      // L'utente ha chiuso il foglio di condivisione senza scegliere nulla:
      // non è un errore da mostrare, è esattamente come non aver cliccato.
      if (err instanceof Error && err.name === "AbortError") {
        setBusy(false);
        return;
      }
      setError(
        lang === "en"
          ? "Could not create the image. Try printing instead."
          : "Non è stato possibile creare l'immagine. Prova con la stampa.",
      );
    }
    setBusy(false);
  }

  const courseTitle = lang === "en" ? data.courseTitleEn : data.courseTitleIt;
  const meritTitle = lang === "en" ? data.meritTitleEn : data.meritTitleIt;
  const shareText =
    lang === "en"
      ? `I took part in "${courseTitle}" and earned the title of ${meritTitle}! 🍷`
      : `Ho partecipato al corso "${courseTitle}" e mi sono meritato il titolo di ${meritTitle}! 🍷`;

  async function shareWhatsApp() {
    // Dove il foglio di condivisione nativo può portare il file vero, lo fa:
    // WhatsApp compare come uno dei destinatari possibili, pergamena
    // allegata. Dove non può (soprattutto desktop), resta il link di prima
    // — solo testo, perché non c'è un modo per attaccare un file a un
    // messaggio WhatsApp da browser senza quel foglio.
    if (!canShareFiles()) {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const file = await pngFile();
      if (!file) {
        setError(
          lang === "en"
            ? "Could not create the image. Try printing instead."
            : "Non è stato possibile creare l'immagine. Prova con la stampa.",
        );
        setBusy(false);
        return;
      }
      await navigator.share({ files: [file], text: shareText });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setBusy(false);
        return;
      }
      setError(
        lang === "en"
          ? "Could not create the image. Try printing instead."
          : "Non è stato possibile creare l'immagine. Prova con la stampa.",
      );
    }
    setBusy(false);
  }

  return (
    <div>
      <div
        ref={wrapper}
        // Scorre in orizzontale invece di rimpicciolire oltre la soglia di
        // leggibilità (§ resa responsive): sotto i 720px il certificato
        // sporge dal contenitore apposta, ed è così che si legge sul
        // telefono senza scritte a 3-6px.
        className="certificate-sheet overflow-x-auto rounded-[16px] border border-gold/35 shadow-xl shadow-black/30"
      >
        <Certificate data={data} lang={lang} />
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
          <button
            onClick={shareWhatsApp}
            disabled={busy}
            className="press rounded-full border border-cream/20 px-6 py-3 text-sm text-cream/70 transition-colors hover:text-cream disabled:opacity-50"
          >
            {lang === "en" ? "Share on WhatsApp" : "Condividi su WhatsApp"}
          </button>
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
