import { ImageResponse } from "next/og";

// Anteprima quando un link al sito viene condiviso (WhatsApp, social):
// prima non c'era nessuna immagine, e il link usciva spoglio (§ pulizia,
// STATO.md). Non riusa l'SVG dell'attestato: quello ha un filtro di
// texture (`feTurbulence`) che il renderer di questa immagine non sa
// disegnare — qui sono solo forme semplici, gli stessi colori e lo stesso
// grappolo del sigillo, ridisegnato senza il filtro.

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Corso di Avvicinamento al Vino — L'Angolo del Vino";

const GOLD = "#D4AF37";
const GOLD_DEEP = "#A9822A";
const GOLD_LIGHT = "#E9CE7E";
const BORDEAUX = "#722F37";
const BORDEAUX_DEEP = "#48181D";
const CREAM = "#F6F0E5";
const INK = "#3A3128";

const BERRIES: [number, number][] = [
  [-11, -6], [0, -6], [11, -6],
  [-16.5, 3], [-5.5, 3], [5.5, 3], [16.5, 3],
  [-11, 12], [0, 12], [11, 12],
  [-5.5, 21], [5.5, 21],
  [0, 29.5],
];

async function loadGoogleFont(family: string, weight: number) {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`,
  ).then((r) => r.text());
  const match = css.match(/src: url\(([^)]+)\) format\('(opentype|truetype)'\)/);
  if (!match) throw new Error(`Font non trovato: ${family}`);
  const response = await fetch(match[1]);
  return response.arrayBuffer();
}

export default async function OpengraphImage() {
  const [cormorant, jost] = await Promise.all([
    loadGoogleFont("Cormorant Garamond", 700),
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
          background: CREAM,
          fontFamily: "Jost",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 28,
            left: 28,
            right: 28,
            bottom: 28,
            border: `3px solid ${GOLD}`,
            borderRadius: 6,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 44,
            left: 44,
            right: 44,
            bottom: 44,
            border: `1px dashed ${GOLD_DEEP}`,
            borderRadius: 4,
          }}
        />

        <svg width="112" height="112" viewBox="0 0 112 112">
          <circle cx="56" cy="56" r="52" fill={GOLD} />
          <circle cx="56" cy="56" r="41" fill={BORDEAUX_DEEP} />
          <g transform="translate(56 56)">
            <path d="M0 -14 v-8" fill="none" stroke={GOLD_LIGHT} strokeWidth={2.4} strokeLinecap="round" />
            <path
              d="M-2 -19 C -10 -27, -22 -25, -25 -18 C -28 -11, -20 -5, -12 -8 C -6 -10, -3 -15, -2 -19 Z"
              fill={GOLD_LIGHT}
            />
            {BERRIES.map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r={5.6} fill={GOLD_LIGHT} />
            ))}
          </g>
        </svg>

        <div
          style={{
            marginTop: 40,
            fontFamily: "Cormorant Garamond",
            fontSize: 64,
            fontWeight: 700,
            color: BORDEAUX,
            textAlign: "center",
          }}
        >
          Corso di Avvicinamento al Vino
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginTop: 26,
          }}
        >
          <div style={{ width: 90, height: 1, background: GOLD }} />
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 8,
              background: GOLD,
            }}
          />
          <div style={{ width: 90, height: 1, background: GOLD }} />
        </div>

        <div
          style={{
            marginTop: 22,
            fontSize: 26,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: INK,
            opacity: 0.7,
          }}
        >
          L&apos;Angolo del Vino
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Cormorant Garamond", data: cormorant, weight: 700, style: "normal" },
        { name: "Jost", data: jost, weight: 500, style: "normal" },
      ],
    },
  );
}
