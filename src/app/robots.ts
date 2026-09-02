import type { MetadataRoute } from "next";
import { siteHost } from "@/lib/site";

// L'area relatore e le API non hanno senso indicizzate: la prima è
// riservata (login richiesto, e ogni contenuto è privato di un corso), la
// seconda non è mai una pagina da mostrare a chi cerca su Google.
// /verifica/<codice> porta il nome vero di una persona: ha già un
// `noindex` proprio (src/app/verifica/[code]/page.tsx, deliberato), che
// basta a tenerla fuori dall'indice; escluderla anche qui evita pure la
// scansione, non solo l'indicizzazione — nessun motivo di sprecare quel
// giro su una pagina che non deve comunque comparire nei risultati.
export default function robots(): MetadataRoute.Robots {
  const host = `https://${siteHost()}`;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // `/corso/<slug>` è un muro di login: a chi non è iscritto mostra la
      // schermata d'accesso, quindi non ha contenuto da indicizzare — e
      // scansionarlo produrrebbe tante copie della stessa pagina d'ingresso
      // quante sono le edizioni. Chi cerca deve trovare "/" o
      // "/prossimi-corsi", che sono le due pagine scritte per essere lette
      // da fuori.
      disallow: ["/relatore", "/api", "/verifica", "/corso"],
    },
    sitemap: `${host}/sitemap.xml`,
  };
}
