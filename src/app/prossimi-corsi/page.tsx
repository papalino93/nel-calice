import type { Metadata } from "next";
import Link from "next/link";
import { GrapesIcon, GlassIcon, Seal } from "@/components/icons";

export const metadata: Metadata = {
  title: "Prossimi corsi in partenza",
  description:
    "Nel Calice - Corso di Avvicinamento al Vino. Sei serate a tema, prova finale e degustazioni guidate. Prima edizione a 120 euro.",
  alternates: { canonical: "/prossimi-corsi" },
};

const contacts = [
  { name: "Andrea", phone: "338 787 1358", href: "tel:+393387871358" },
  { name: "Andrea", phone: "338 327 7053", href: "tel:+393383277053" },
  { name: "Manuel", phone: "347 855 1060", href: "tel:+393478551060" },
];

/** Pagina pubblica: la destinazione dei QR sulle locandine e dei link
    condivisi. Non richiede Google: serve prima di decidere di partecipare. */
export default function UpcomingCoursesPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-28 pt-8 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className="press inline-flex items-center gap-3 text-cream/90 hover:text-cream"
        >
          <Seal size={42} />
          <span className="font-serif text-xl">Nel Calice</span>
        </Link>
        <Link
          href="/"
          className="press text-sm text-cream/60 underline underline-offset-4 hover:text-cream"
        >
          Accedi
        </Link>
      </header>

      <section className="rise-in mt-12 overflow-hidden rounded-card border border-gold/45 bg-bordeaux/35 px-6 py-10 text-center shadow-[0_18px_48px_rgba(0,0,0,0.24)] sm:px-12 sm:py-14">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-gold/70 bg-bordeaux text-gold-light">
          <GrapesIcon className="h-9 w-9" />
        </span>
        <p className="mt-6 text-xs font-medium uppercase tracking-[0.2em] text-gold-light">
          Prossimo corso in partenza
        </p>
        <h1 className="mt-3 font-serif text-4xl leading-[1.02] text-cream sm:text-6xl">
          Corso di Avvicinamento al Vino
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-cream/80 sm:text-lg">
          Sei serate a tema, degustazioni guidate e prova finale per imparare
          a leggere il vino con occhi, naso e palato. Un percorso pratico,
          amatoriale e accessibile.
        </p>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="card p-6 sm:p-7">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold/80">
            Cosa trovi nel percorso
          </p>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {[
              ["Degustazioni guidate", "Per riconoscere cosa senti davvero nel calice."],
              ["Quiz e materiali personali", "Li ritrovi sempre nella tua area con Google."],
              ["Sei serate a tema", "Sensi, stili, territori e storie del vino."],
              ["Attestato di partecipazione", "Il ricordo di un percorso amatoriale, non professionale."],
            ].map(([title, text]) => (
              <li key={title} className="rounded-xl border border-cream/10 bg-charcoal/25 p-4">
                <GlassIcon className="h-5 w-5 text-gold" />
                <h2 className="mt-3 font-serif text-xl text-cream">{title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-cream/60">{text}</p>
              </li>
            ))}
          </ul>
        </div>

        <aside className="rounded-card border border-gold/40 bg-cream-soft p-6 text-charcoal sm:p-7">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-bordeaux">
            Prima edizione
          </p>
          <p className="mt-3 font-serif text-3xl leading-none text-bordeaux">
            Prezzo di lancio
          </p>
          <div className="mt-5 flex items-end gap-3">
            <span className="pb-1 text-lg text-charcoal/55 line-through">150 €</span>
            <span className="font-serif text-6xl leading-none text-bordeaux">120 €</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-charcoal/70">
            Riservato alla prima classe. Per iscrizioni, informazioni e
            prossima edizione contatta direttamente il team.
          </p>

          <div className="mt-6 border-t border-bordeaux/15 pt-5">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-bordeaux">
              Informazioni e iscrizioni
            </p>
            <ul className="mt-3 space-y-2">
              {contacts.map((contact) => (
                <li key={contact.href}>
                  <a
                    href={contact.href}
                    className="press flex min-h-10 items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm font-medium text-charcoal underline decoration-bordeaux/30 underline-offset-4 hover:bg-bordeaux/8"
                  >
                    <span>{contact.name}</span>
                    <span className="font-serif text-lg text-bordeaux">{contact.phone}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>

      <section className="mt-6 rounded-card border border-gold/25 bg-charcoal-soft/70 p-6 text-center sm:p-8">
        <p className="font-serif text-2xl text-cream">Hai già il tuo posto?</p>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-cream/65">
          Dopo aver ricevuto il codice del corso, entra con Google: quiz,
          materiali e risultati resteranno sempre nella tua area personale.
        </p>
        <Link
          href="/"
          className="press lift mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-medium text-charcoal transition-transform"
        >
          Vai alla piattaforma
          <span aria-hidden>→</span>
        </Link>
      </section>
    </main>
  );
}
