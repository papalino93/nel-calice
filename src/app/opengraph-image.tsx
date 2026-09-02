import { ImageResponse } from "next/og";

// Anteprima quando un link al sito viene condiviso (WhatsApp, social).
//
// La prima versione riprendeva lo stile "pergamena" dell'attestato — un
// cartoncino color crema con cornice dorata e un grappolo che non compare da
// nessun'altra parte del sito. Nella miniatura vera di WhatsApp (segnalato
// dal committente) risultava spenta: un rettangolo beige su beige, senza
// legame visibile col resto del prodotto, che è sempre a fondo scuro
// (`html { color-scheme: dark }`, globals.css). Questa versione riusa lo
// stesso sigillo dentellato dell'intestazione (`Seal`, src/components/icons)
// e lo stesso fondo radiale carbone del sito — la prima cosa che chi apre
// l'app vede è già questa, quindi l'anteprima ora la promette per davvero.

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Nel Calice — Corso di Avvicinamento al Vino";

const GOLD = "#D4AF37";
const GOLD_DEEP = "#A9822A";
const GOLD_LIGHT = "#E9CE7E";
const BORDEAUX_DEEP = "#48181D";
const CREAM = "#F6F0E5";
const CHARCOAL = "#1E1F21";
const CHARCOAL_SOFT = "#2C2D30";

/** Lo stesso sigillo dentellato di `Seal` (src/components/icons.tsx),
    ridisegnato qui perché next/og non può importare quel componente React —
    Satori vuole SVG puro, calcolato allo stesso modo. */
function sealPoints() {
  const teeth = 40;
  const outer = 49;
  const inner = 44;
  return Array.from({ length: teeth * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / teeth - Math.PI / 2;
    return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

async function loadGoogleFont(family: string, weight: number, italic = false) {
  const axis = italic ? `ital,wght@1,${weight}` : `wght@${weight}`;
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:${axis}&display=swap`,
  ).then((r) => r.text());
  const match = css.match(/src: url\(([^)]+)\) format\('(opentype|truetype)'\)/);
  if (!match) throw new Error(`Font non trovato: ${family}`);
  const response = await fetch(match[1]);
  return response.arrayBuffer();
}

export default async function OpengraphImage() {
  const [cormorant, cormorantItalic, jost] = await Promise.all([
    loadGoogleFont("Cormorant Garamond", 600),
    loadGoogleFont("Cormorant Garamond", 500, true),
    loadGoogleFont("Jost", 500),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: `radial-gradient(120% 90% at 50% 0%, ${CHARCOAL_SOFT} 0%, ${CHARCOAL} 65%)`,
          fontFamily: "Jost",
          position: "relative",
        }}
      >
        {/* Bagliore bordeaux dietro il sigillo, come le card in evidenza del
            sito (`bg-bordeaux/35`), per dare peso al centro senza un bordo
            netto — sfuma da sé grazie al gradiente, non serve un blur. */}
        <div
          style={{
            position: "absolute",
            top: -260,
            width: 900,
            height: 900,
            borderRadius: 900,
            background: `radial-gradient(circle, ${BORDEAUX_DEEP} 0%, rgba(72,24,29,0.35) 55%, rgba(72,24,29,0) 75%)`,
          }}
        />

        <svg width="108" height="108" viewBox="0 0 100 100" style={{ position: "relative" }}>
          <defs>
            <linearGradient id="seal-gold" x1="0" y1="0" x2="0.6" y2="1">
              <stop offset="0%" stopColor={GOLD_LIGHT} />
              <stop offset="45%" stopColor={GOLD} />
              <stop offset="100%" stopColor={GOLD_DEEP} />
            </linearGradient>
          </defs>
          <polygon points={sealPoints()} fill="url(#seal-gold)" />
          <circle cx="50" cy="50" r="44" fill="url(#seal-gold)" />
          <circle cx="50" cy="50" r="35" fill={BORDEAUX_DEEP} />
          <circle cx="50" cy="50" r="35" fill="none" stroke="rgba(212,175,55,0.35)" strokeWidth="0.8" />
          {/* Stesso calice di GlassIcon (src/components/icons.tsx), solo
              riportato dal suo viewBox 24×24 al centro del sigillo. */}
          <g
            transform="translate(50 50) scale(1.35) translate(-12 -11.25)"
            stroke={GOLD_LIGHT}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <path d="M7 3h10v4c0 2.8-2.2 5-5 5s-5-2.2-5-5z" />
            <path d="M12 12v7" />
            <path d="M8.5 19.5h7" />
          </g>
        </svg>

        <div
          style={{
            marginTop: 18,
            fontFamily: "Cormorant Garamond",
            fontWeight: 600,
            fontStyle: "normal",
            fontSize: 28,
            color: CREAM,
            letterSpacing: 1,
          }}
        >
          Nel Calice
        </div>

        <div
          style={{
            marginTop: 30,
            fontFamily: "Cormorant Garamond",
            fontWeight: 600,
            fontSize: 68,
            lineHeight: 1.05,
            color: CREAM,
            textAlign: "center",
            padding: "0 80px",
          }}
        >
          Corso di Avvicinamento al Vino
        </div>

        <div
          style={{
            marginTop: 20,
            fontFamily: "Cormorant Garamond",
            fontStyle: "italic",
            fontSize: 32,
            color: GOLD_LIGHT,
            textAlign: "center",
          }}
        >
          Capire il vino, senza il tecnicismo del sommelier.
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginTop: 44,
          }}
        >
          <div style={{ width: 70, height: 1, background: `rgba(212,175,55,0.4)` }} />
          <div style={{ width: 6, height: 6, borderRadius: 6, background: GOLD }} />
          <div style={{ width: 70, height: 1, background: `rgba(212,175,55,0.4)` }} />
        </div>

        <div
          style={{
            marginTop: 18,
            fontSize: 20,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "rgba(246,240,229,0.55)",
          }}
        >
          L&apos;Angolo del Vino — Scandicci
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Cormorant Garamond", data: cormorant, weight: 600, style: "normal" },
        { name: "Cormorant Garamond", data: cormorantItalic, weight: 500, style: "italic" },
        { name: "Jost", data: jost, weight: 500, style: "normal" },
      ],
    },
  );
}
