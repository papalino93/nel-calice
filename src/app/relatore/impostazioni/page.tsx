"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, errorMessage, post } from "@/lib/api";
import { useLanguage } from "@/components/LanguageProvider";
import {
  AdminSection,
  AdminShell,
  Field,
  buttonClass,
  ghostButtonClass,
  inputClass,
} from "@/components/admin/AdminShell";

type Member = {
  email: string;
  role: "OWNER" | "RELATORE";
  source: "configurazione" | "area-relatore";
  removable: boolean;
};

type Settings = {
  currentEmail: string;
  canManage: boolean;
  members: Member[];
};

/** Punto unico per persone, accessi e regole che non appartengono a una
    singola lezione. Nessun PIN da conservare: l'identità è l'account Google. */
export default function SettingsPage() {
  const { lang, t } = useLanguage();
  const [data, setData] = useState<Settings | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Member["role"]>("RELATORE");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const result = await api<Settings>("/api/admin/settings");
    if (result.ok) setData(result.data);
    else setMessage(errorMessage(result, t));
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await api<Settings>("/api/admin/settings");
      if (cancelled) return;
      if (result.ok) setData(result.data);
      else setMessage(errorMessage(result, t));
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function saveMember() {
    // Se questa e-mail è già un proprietario e la si sta per rendere
    // Relatore, è una modifica che si può ritrovare a fare per sbaglio
    // (lo stesso campo serve sia per aggiungere sia per modificare) — merita
    // la stessa conferma esplicita che ha già la rimozione.
    const normalized = email.trim().toLowerCase();
    const existing = data?.members.find((m) => m.email === normalized);
    if (existing?.role === "OWNER" && role !== "OWNER") {
      const isSelf = normalized === data?.currentEmail.toLowerCase();
      const question = isSelf
        ? (lang === "en"
            ? "You are removing your own owner access. If you are the only owner left, you will lose access to this page. Continue?"
            : "Stai togliendo l'accesso da proprietario a te stesso. Se sei l'ultimo, perderai l'accesso a questa pagina. Continuare?")
        : (lang === "en"
            ? `Make ${existing.email} a host instead of an owner?`
            : `Rendere ${existing.email} relatore invece che proprietario?`);
      if (!window.confirm(question)) return;
    }

    setBusy(true);
    setMessage(null);
    const result = await post("/api/admin/settings", { email, role });
    setBusy(false);
    if (result.ok) {
      setEmail("");
      setRole("RELATORE");
      setMessage(lang === "en" ? "Access saved." : "Accesso salvato.");
      await reload();
    } else setMessage(errorMessage(result, t));
  }

  async function removeMember(member: Member) {
    if (!window.confirm(lang === "en" ? `Remove ${member.email} from the host area?` : `Togliere ${member.email} dall'Area Relatore?`)) return;
    setBusy(true);
    setMessage(null);
    const result = await api("/api/admin/settings", {
      method: "DELETE",
      body: JSON.stringify({ email: member.email }),
    });
    setBusy(false);
    if (result.ok) {
      setMessage(lang === "en" ? "Access removed." : "Accesso rimosso.");
      await reload();
    } else setMessage(errorMessage(result, t));
  }

  const copy = lang === "en"
    ? {
        title: "Settings", access: "Host access", accessHint: "No shared password or PIN: a host uses their own Google account. Add the e-mail address before their first login.", owner: "Owner", host: "Host", protected: "Protected", managed: "Managed here", add: "Add a host", email: "Google e-mail address", role: "Role", save: "Save access", codes: "Where the codes are", codesHint: "There is no general host code to remember. Course enrollment codes and evening codes belong to each course, where you can view and copy them.", courses: "Go to my courses", loading: "One moment…",
      }
    : {
        title: "Impostazioni", access: "Accesso dei relatori", accessHint: "Nessuna password o PIN condiviso: ogni relatore entra con il proprio account Google. Aggiungi qui la sua e-mail prima del primo accesso.", owner: "Proprietario", host: "Relatore", protected: "Protetto", managed: "Gestito qui", add: "Aggiungi un relatore", email: "Indirizzo e-mail Google", role: "Ruolo", save: "Salva accesso", codes: "Dove sono i codici", codesHint: "Non esiste un codice relatore generale da ricordare. Il codice di iscrizione e quello della serata appartengono al singolo corso: li vedi e copi dalla pagina del corso.", courses: "Vai ai miei corsi", loading: "Un momento…",
      };

  return (
    <AdminShell title={copy.title} backHref="/relatore" backLabel={t.adminArea}>
      <section className="card border-gold/35 bg-bordeaux/20 p-5">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-gold-light">{lang === "en" ? "Your access" : "Il tuo accesso"}</p>
        <p className="mt-1 font-serif text-xl text-cream">{data?.currentEmail ?? copy.loading}</p>
        <p className="mt-2 text-sm leading-relaxed text-cream/70">
          {lang === "en" ? "You are signed in with Google. This is the only identity you need to access the host area." : "Sei entrato con Google. È l'unica credenziale che ti serve per accedere all'Area Relatore."}
        </p>
      </section>

      <AdminSection title={copy.access} hint={copy.accessHint}>
        {!data ? (
          <p className="text-sm text-cream/55">{copy.loading}</p>
        ) : (
          <>
            <ul className="overflow-hidden rounded-card border border-cream/10">
              {data.members.map((member) => (
                <li key={member.email} className="flex flex-wrap items-center justify-between gap-3 border-b border-cream/10 p-4 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-cream">{member.email}</p>
                    <p className="mt-1 text-xs text-cream/55">
                      {member.role === "OWNER" ? copy.owner : copy.host} · {member.source === "configurazione" ? copy.protected : copy.managed}
                    </p>
                  </div>
                  {data.canManage && member.removable && (
                    <button onClick={() => void removeMember(member)} disabled={busy} className="press min-h-10 px-2 text-xs text-red-300 underline underline-offset-4">
                      {lang === "en" ? "Remove" : "Rimuovi"}
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {data.canManage ? (
              <div className="card mt-4 p-5">
                <h3 className="font-serif text-lg text-cream">{copy.add}</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-end">
                  <Field label={copy.email}>
                    <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="nome@gmail.com" className={inputClass} />
                  </Field>
                  <Field label={copy.role}>
                    <select value={role} onChange={(event) => setRole(event.target.value as Member["role"])} className={inputClass}>
                      <option value="RELATORE">{copy.host}</option>
                      <option value="OWNER">{copy.owner}</option>
                    </select>
                  </Field>
                  <button onClick={() => void saveMember()} disabled={!email.trim() || busy} className={buttonClass}>{copy.save}</button>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-cream/60">
                {lang === "en" ? "Only an owner can change access." : "Solo un proprietario può modificare gli accessi."}
              </p>
            )}
          </>
        )}
      </AdminSection>

      <AdminSection title={copy.codes} hint={copy.codesHint}>
        <Link href="/relatore" className={`${ghostButtonClass} inline-flex min-h-10 items-center`}>
          {copy.courses}
        </Link>
      </AdminSection>

      <AdminSection
        title={lang === "en" ? "Quick guide" : "Guida rapida: come funziona una serata"}
        hint={lang === "en"
          ? "The same sequence is always used. You do not need to remember a hidden procedure."
          : "La sequenza è sempre la stessa: non devi ricordare procedure nascoste."}
      >
        <ol className="overflow-hidden rounded-card border border-cream/10 text-sm text-cream/75">
          <li className="border-b border-cream/10 p-4">
            <span className="font-medium text-gold">1. {lang === "en" ? "Prepare the course" : "Prepara il corso"}</span>
            <p className="mt-1 text-xs leading-relaxed text-cream/55">
              {lang === "en"
                ? "Open a course, set the enrollment code and make enrollment open. Add or reuse the lessons you need."
                : "Apri un corso, imposta il codice di iscrizione e attiva le iscrizioni. Aggiungi o riusa le lezioni che ti servono."}
            </p>
          </li>
          <li className="border-b border-cream/10 p-4">
            <span className="font-medium text-gold">2. {lang === "en" ? "Let students in" : "Fai iscrivere i corsisti"}</span>
            <p className="mt-1 text-xs leading-relaxed text-cream/55">
              {lang === "en"
                ? "They sign in with Google, land in their personal area, and enter the course enrollment code once. Their progress is then saved there."
                : "Entrano con Google, arrivano nella propria area personale e inseriscono una sola volta il codice di iscrizione del corso. Da quel momento i loro progressi restano salvati lì."}
            </p>
          </li>
          <li className="border-b border-cream/10 p-4">
            <span className="font-medium text-gold">3. {lang === "en" ? "Run the evening" : "Svolgi la serata"}</span>
            <p className="mt-1 text-xs leading-relaxed text-cream/55">
              {lang === "en"
                ? "From the course page, copy or communicate that lesson's code. Students use it to unlock both the quiz and the handouts for that evening."
                : "Dalla pagina del corso copia o comunica il codice della lezione. I corsisti lo usano per sbloccare sia il quiz sia i materiali di quella serata."}
            </p>
          </li>
          <li className="p-4">
            <span className="font-medium text-gold">4. {lang === "en" ? "Check what happened" : "Controlla come è andata"}</span>
            <p className="mt-1 text-xs leading-relaxed text-cream/55">
              {lang === "en"
                ? "Use Class progress to see participation and results. Change times, enrollment and the course status from the course settings."
                : "Usa Andamento della classe per vedere partecipazione e risultati. Nelle impostazioni del corso modifichi tempi, iscrizioni e stato del corso."}
            </p>
          </li>
        </ol>
      </AdminSection>

      {message && <p className="mt-6 text-sm text-cream/75" role="status">{message}</p>}
    </AdminShell>
  );
}
