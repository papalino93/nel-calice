// Attestato di partecipazione.
//
// **Una sola sorgente.** Questo SVG è l'unico disegno che esiste: la pagina
// lo mostra così com'è, il download lo converte in PNG, la stampa stampa lo
// stesso nodo. Nell'app attuale l'attestato è disegnato tre volte — HTML,
// canvas e stampa — con codice duplicato da tenere allineato a mano, ed è
// il difetto §7.11.
//
// Da qui discende una scelta tipografica: il font è uno stack di sistema e
// non il Cormorant del resto dell'app. Un font caricato dal browser non
// arriva dentro il canvas quando l'SVG viene convertito in immagine, e il
// PNG uscirebbe con un carattere diverso da quello a schermo. Meglio un
// serif presente ovunque, uguale in tutti e tre i casi, che un carattere
// più bello che si rompe proprio nella copia che l'utente conserva.
//
// Vincolo di contenuto (§2.2): è un attestato di *partecipazione* a un corso
// amatoriale. Niente che suggerisca una qualifica professionale.

import { GrapesEmblem } from "./icons";

export const CERTIFICATE_WIDTH = 1000;
export const CERTIFICATE_HEIGHT = 700;

const SERIF =
  "Georgia, 'Iowan Old Style', 'Palatino Linotype', Palatino, 'Times New Roman', serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const GOLD = "#D4AF37";
const GOLD_DEEP = "#A9822A";
const GOLD_LIGHT = "#E9CE7E";
const BORDEAUX = "#722F37";
const BORDEAUX_DEEP = "#48181D";
const CREAM = "#F6F0E5";
const INK = "#3A3128";

export type CertificateData = {
  name: string;
  courseTitle: string;
  meritTitle: string;
  meritSubtitle: string;
  date: string;
  issuer: string;
};

/** Sigillo dentellato, lo stesso dell'app ma ridisegnato in coordinate SVG. */
function sealPoints(cx: number, cy: number, outer: number, inner: number) {
  const teeth = 40;
  return Array.from({ length: teeth * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / teeth - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

/** Fregio ad angolo: due segmenti e un rombo, ripetuto ai quattro angoli. */
function CornerOrnament({
  x,
  y,
  flipX,
  flipY,
}: {
  x: number;
  y: number;
  flipX: boolean;
  flipY: boolean;
}) {
  const sx = flipX ? -1 : 1;
  const sy = flipY ? -1 : 1;
  return (
    <g transform={`translate(${x} ${y}) scale(${sx} ${sy})`}>
      <path
        d="M0 26 L0 6 Q0 0 6 0 L26 0"
        fill="none"
        stroke={GOLD_DEEP}
        strokeWidth="1.6"
      />
      <path d="M8 8 l5 -5 5 5 -5 5 z" fill={GOLD} />
    </g>
  );
}

/** Tralcio di vite stilizzato, ai lati del sigillo. */
function Vine({ x, y, mirrored }: { x: number; y: number; mirrored: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${mirrored ? -1 : 1} 1)`}>
      <path
        d="M0 0 C 20 -8, 42 -6, 60 2"
        fill="none"
        stroke={GOLD_DEEP}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="18" cy="-2" r="3.2" fill={BORDEAUX} opacity="0.75" />
      <circle cx="27" cy="-5" r="3.2" fill={BORDEAUX} opacity="0.75" />
      <circle cx="36" cy="-3" r="3.2" fill={BORDEAUX} opacity="0.75" />
      <circle cx="24" cy="3" r="3.2" fill={BORDEAUX} opacity="0.6" />
      <circle cx="33" cy="4" r="3.2" fill={BORDEAUX} opacity="0.6" />
    </g>
  );
}

export function Certificate({
  data,
  id = "attestato",
}: {
  data: CertificateData;
  id?: string;
}) {
  const cx = CERTIFICATE_WIDTH / 2;

  return (
    <svg
      id={id}
      viewBox={`0 0 ${CERTIFICATE_WIDTH} ${CERTIFICATE_HEIGHT}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`Attestato di partecipazione per ${data.name}`}
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      <defs>
        {/* Carta invecchiata: una texture leggera, non un effetto vistoso. */}
        <filter id={`${id}-paper`} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="4"
            result="noise"
          />
          <feColorMatrix
            in="noise"
            type="saturate"
            values="0"
            result="mono"
          />
          <feComponentTransfer in="mono" result="soft">
            <feFuncA type="linear" slope="0.05" />
          </feComponentTransfer>
          <feBlend in="SourceGraphic" in2="soft" mode="multiply" />
        </filter>

        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor={GOLD_LIGHT} />
          <stop offset="45%" stopColor={GOLD} />
          <stop offset="100%" stopColor={GOLD_DEEP} />
        </linearGradient>
      </defs>

      {/* Pergamena */}
      <rect width="100%" height="100%" fill={CREAM} />
      <rect
        width="100%"
        height="100%"
        fill={CREAM}
        filter={`url(#${id}-paper)`}
      />

      {/* Filigrana: un calice appena accennato, dietro il testo */}
      <g opacity="0.05" transform={`translate(${cx - 110} 180) scale(9)`}>
        <path
          d="M7 3h10v4c0 2.8-2.2 5-5 5s-5-2.2-5-5z M12 12v7 M8.5 19.5h7"
          fill="none"
          stroke={BORDEAUX}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </g>

      {/* Cornice doppia */}
      <rect
        x="26"
        y="26"
        width={CERTIFICATE_WIDTH - 52}
        height={CERTIFICATE_HEIGHT - 52}
        fill="none"
        stroke={`url(#${id}-gold)`}
        strokeWidth="3"
        rx="4"
      />
      <rect
        x="40"
        y="40"
        width={CERTIFICATE_WIDTH - 80}
        height={CERTIFICATE_HEIGHT - 80}
        fill="none"
        stroke={GOLD_DEEP}
        strokeWidth="1"
        strokeDasharray="1 5"
        strokeLinecap="round"
        rx="2"
      />

      <CornerOrnament x={54} y={54} flipX={false} flipY={false} />
      <CornerOrnament
        x={CERTIFICATE_WIDTH - 54}
        y={54}
        flipX
        flipY={false}
      />
      <CornerOrnament
        x={54}
        y={CERTIFICATE_HEIGHT - 54}
        flipX={false}
        flipY
      />
      <CornerOrnament
        x={CERTIFICATE_WIDTH - 54}
        y={CERTIFICATE_HEIGHT - 54}
        flipX
        flipY
      />

      {/* Sigillo con tralci */}
      <Vine x={cx - 62} y={112} mirrored />
      <Vine x={cx + 62} y={112} mirrored={false} />

      <g>
        <polygon
          points={sealPoints(cx, 112, 46, 41)}
          fill={`url(#${id}-gold)`}
        />
        <circle cx={cx} cy={112} r="41" fill={`url(#${id}-gold)`} />
        <circle cx={cx} cy={112} r="32" fill={BORDEAUX_DEEP} />
        <circle
          cx={cx}
          cy={112}
          r="32"
          fill="none"
          stroke={GOLD}
          strokeWidth="0.8"
          opacity="0.5"
        />
        {/* Grappolo: sull'attestato al posto del calice, che è già l'icona
            di tutto il resto dell'app. Così la pergamena ha un emblema suo. */}
        <g transform={`translate(${cx - 24} ${112 - 26}) scale(1.05)`}>
          <GrapesEmblem accent={GOLD_LIGHT} />
        </g>
      </g>

      {/* Nastro */}
      <g transform={`translate(${cx} 200)`}>
        <path
          d="M-190 -17 L190 -17 L172 0 L190 17 L-190 17 L-172 0 Z"
          fill={BORDEAUX}
        />
        <text
          x="0"
          y="5"
          textAnchor="middle"
          fill={CREAM}
          fontFamily={SANS}
          fontSize="14"
          letterSpacing="4.5"
        >
          ATTESTATO DI PARTECIPAZIONE
        </text>
      </g>

      {/* Corso */}
      <text
        x={cx}
        y="258"
        textAnchor="middle"
        fill={INK}
        fontFamily={SERIF}
        fontSize="21"
      >
        {data.courseTitle}
      </text>

      <text
        x={cx}
        y="303"
        textAnchor="middle"
        fill={INK}
        fontFamily={SERIF}
        fontSize="17"
        opacity="0.62"
      >
        Si attesta che
      </text>

      {/* Il nome: l'elemento più grande della pergamena */}
      <text
        x={cx}
        y="372"
        textAnchor="middle"
        fill={BORDEAUX}
        fontFamily={SERIF}
        fontSize="56"
        fontStyle="italic"
      >
        {data.name}
      </text>

      <text
        x={cx}
        y="410"
        textAnchor="middle"
        fill={INK}
        fontFamily={SERIF}
        fontSize="17"
        opacity="0.62"
      >
        ha partecipato al corso, meritandosi il titolo di
      </text>

      {/* Separatore con rombo */}
      <g transform={`translate(${cx} 436)`}>
        <line x1="-120" y1="0" x2="-14" y2="0" stroke={GOLD} strokeWidth="1" />
        <path d="M0 -6 l6 6 -6 6 -6 -6 z" fill={GOLD} />
        <line x1="14" y1="0" x2="120" y2="0" stroke={GOLD} strokeWidth="1" />
      </g>

      {/* Titolo di merito — informale e giocoso (§2.2) */}
      <text
        x={cx}
        y="492"
        textAnchor="middle"
        fill={BORDEAUX}
        fontFamily={SERIF}
        fontSize="38"
        fontWeight="bold"
      >
        {data.meritTitle}
      </text>

      <text
        x={cx}
        y="521"
        textAnchor="middle"
        fill={GOLD_DEEP}
        fontFamily={SANS}
        fontSize="12"
        letterSpacing="2.6"
      >
        {data.meritSubtitle.toUpperCase()}
      </text>

      {/* Solo la data: niente numero. Il titolo di merito già dice come è
          andata, in una forma che non mette mai in imbarazzo — un
          "26/100" stampato su un ricordo da appendere lo farebbe, un
          "Amico del Calice" no. */}
      <text
        x={cx}
        y="574"
        textAnchor="middle"
        fill={INK}
        fontFamily={SANS}
        fontSize="14"
      >
        {data.date}
      </text>

      <text
        x={cx}
        y="628"
        textAnchor="middle"
        fill={GOLD_DEEP}
        fontFamily={SANS}
        fontSize="11"
        letterSpacing="3.4"
      >
        {data.issuer.toUpperCase()}
      </text>

      <text
        x={cx}
        y="650"
        textAnchor="middle"
        fill={INK}
        fontFamily={SANS}
        fontSize="9"
        opacity="0.4"
      >
        Corso amatoriale · non costituisce qualifica professionale
      </text>
    </svg>
  );
}
