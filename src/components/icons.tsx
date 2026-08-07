import type { SVGProps } from "react";

// SVG disegnati a mano, nessuna libreria esterna (§6). Il calice è l'icona
// identitaria: torna nel sigillo, nella favicon e nel pulsante donazione.

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function GlassIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 3h10v4c0 2.8-2.2 5-5 5s-5-2.2-5-5z" />
      <path d="M12 12v7" />
      <path d="M8.5 19.5h7" />
    </Icon>
  );
}

/**
 * Tastevin: la coppa bassa e sbalzata con l'anello laterale, usata da sempre
 * per guardare il vino contro la luce. Sull'attestato prende il posto del
 * calice — che è già l'icona di tutto il resto dell'app — così la pergamena
 * ha un emblema suo.
 */
export function TastevinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <TastevinShape />
    </Icon>
  );
}

/**
 * Il disegno vero e proprio, senza contenitore: serve identico anche
 * sull'attestato, dove va inserito dentro l'SVG della pergamena.
 *
 * Visto dall'alto, perché è così che un tastevin si riconosce: la cupola
 * centrale e la corona di bugne sbalzate — quelle che spezzano la luce e
 * fanno vedere il colore del vino in una coppa bassa — con l'anello per il
 * pollice sul fianco. Di profilo sembrerebbe una tazza qualsiasi.
 */
export function TastevinShape({
  accent = "currentColor",
}: {
  /** Colore delle parti piene (cupola e bugne). */
  accent?: string;
}) {
  const cx = 10;
  const cy = 12;
  const bossRing = 5.4;
  // Sei bugne e non otto: a dimensione da sigillo, otto diventano un
  // tratteggio indistinto. Meglio poche e leggibili.
  const bosses = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    return {
      x: cx + bossRing * Math.cos(a),
      y: cy + bossRing * Math.sin(a),
    };
  });

  return (
    <>
      {/* Anello per il pollice, agganciato al bordo */}
      <circle cx="20.2" cy="12" r="2.6" />
      <path d="M17.6 12h-0.8" />

      {/* Bordo della coppa */}
      <circle cx={cx} cy={cy} r="8.2" />

      {/* Cupola centrale e bugne sbalzate: piene, perché a contorno
          sparirebbero appena l'attestato viene rimpicciolito. */}
      <circle cx={cx} cy={cy} r="2.3" fill={accent} stroke="none" />
      {bosses.map((b, i) => (
        <circle
          key={i}
          cx={b.x.toFixed(2)}
          cy={b.y.toFixed(2)}
          r="1.25"
          fill={accent}
          stroke="none"
        />
      ))}
    </>
  );
}

export function GrapesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 9V4" />
      <path d="M12 5c1.6-1.6 3.4-2 4.8-1.6C17.2 4.8 16 6.6 14 7" />
      <circle cx="8.6" cy="10.6" r="2.1" />
      <circle cx="15.4" cy="10.6" r="2.1" />
      <circle cx="12" cy="14" r="2.1" />
      <circle cx="8.6" cy="17.4" r="2.1" />
      <circle cx="15.4" cy="17.4" r="2.1" />
    </Icon>
  );
}

export function MedalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 3l2.5 6M16 3l-2.5 6" />
      <circle cx="12" cy="15" r="6" />
      <path d="M12 12.2l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z" />
    </Icon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <path d="M12 14.5v2" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 12.5l5 5 10-11" />
    </Icon>
  );
}

export function CrossIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12h15" />
      <path d="M13 6l6 6-6 6" />
    </Icon>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9-5.3-2.9-5.3 2.9 1.1-5.9L3.5 9.7l5.9-.8z" />
    </Icon>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.2 2" />
    </Icon>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5.5A2 2 0 0 1 6 3.5h6v17H6a2 2 0 0 0-2 2z" />
      <path d="M20 5.5a2 2 0 0 0-2-2h-6v17h6a2 2 0 0 1 2 2z" />
    </Icon>
  );
}

/**
 * Sigillo circolare dentellato con icona al centro — il contenitore
 * identitario del corso: compare nella schermata di accesso, nel risultato e
 * sull'attestato.
 */
export function Seal({
  size = 96,
  children,
  className = "",
}: {
  size?: number;
  children?: React.ReactNode;
  className?: string;
}) {
  // Bordo dentellato: raggio alternato lungo la circonferenza, come la
  // ceralacca di un sigillo.
  const teeth = 40;
  const outer = 49;
  const inner = 44;
  const points = Array.from({ length: teeth * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / teeth - Math.PI / 2;
    return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");

  return (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0" aria-hidden="true">
        <defs>
          <linearGradient id="seal-gold" x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0%" stopColor="var(--color-gold-light)" />
            <stop offset="45%" stopColor="var(--color-gold)" />
            <stop offset="100%" stopColor="var(--color-gold-deep)" />
          </linearGradient>
        </defs>

        {/* Corona dentellata e anello, entrambi in oro pieno. */}
        <polygon points={points} fill="url(#seal-gold)" />
        <circle cx="50" cy="50" r="44" fill="url(#seal-gold)" />

        {/* Cuore bordeaux: è ciò che dà al sigillo il suo peso visivo. */}
        <circle cx="50" cy="50" r="35" className="fill-bordeaux-deep" />
        <circle
          cx="50"
          cy="50"
          r="35"
          className="fill-none stroke-gold/35"
          strokeWidth="0.8"
        />
      </svg>
      <span className="relative text-gold-light" style={{ width: size * 0.38 }}>
        {children ?? <GlassIcon className="h-full w-full" strokeWidth={1.4} />}
      </span>
    </span>
  );
}

/** Anello di progresso SVG per i punti totali (§3.2). */
export function ProgressRing({
  value,
  max,
  size = 132,
}: {
  value: number;
  max: number;
  size?: number;
}) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;

  // Pallino oro alla punta dell'arco: segna a che punto si è arrivati, e a
  // zero resta in cima come segno di partenza.
  const angle = ratio * 2 * Math.PI - Math.PI / 2;
  const markerX = 50 + radius * Math.cos(angle);
  const markerY = 50 + radius * Math.sin(angle);

  return (
    <svg
      viewBox="0 0 100 100"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${value} punti su ${max}`}
    >
      <defs>
        <linearGradient id="ring-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-gold-deep)" />
          <stop offset="55%" stopColor="var(--color-gold)" />
          <stop offset="100%" stopColor="var(--color-gold-light)" />
        </linearGradient>
      </defs>

      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        className="stroke-cream/12"
        strokeWidth="6"
      />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke="url(#ring-gold)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - ratio)}
        transform="rotate(-90 50 50)"
        style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
      />
      <circle
        cx={markerX}
        cy={markerY}
        r="3.4"
        className="fill-gold-light"
        style={{ transition: "cx 0.6s ease-out, cy 0.6s ease-out" }}
      />

      <text
        x="50"
        y="49"
        textAnchor="middle"
        className="fill-cream font-serif"
        style={{ fontSize: "30px", fontWeight: 600 }}
      >
        {value}
      </text>
      <text
        x="50"
        y="65"
        textAnchor="middle"
        className="fill-cream/45"
        style={{ fontSize: "11px" }}
      >
        / {max}
      </text>
    </svg>
  );
}

/** La G ufficiale a colori di Google, su fondo bianco (§3.1). */
export function GoogleG(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.9 2.6 13.7l7.8 6c1.9-5.6 7.2-10.2 13.6-10.2z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.4z"
      />
      <path
        fill="#FBBC05"
        d="M10.4 28.3c-.5-1.4-.8-2.8-.8-4.3s.3-3 .8-4.3l-7.8-6C1 16.8 0 20.3 0 24s1 7.2 2.6 10.3l7.8-6z"
      />
      <path
        fill="#34A853"
        d="M24 47.5c6.2 0 11.5-2 15.3-5.6l-7.6-5.9c-2.1 1.4-4.8 2.3-7.7 2.3-6.4 0-11.7-4.6-13.6-10.2l-7.8 6C6.5 42.1 14.6 47.5 24 47.5z"
      />
    </svg>
  );
}
