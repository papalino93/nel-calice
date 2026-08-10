import type { MetadataRoute } from "next";
import { siteHost } from "@/lib/site";

// Una sola voce, non per pigrizia: ogni altra pagina dell'app richiede un
// accesso (login, iscrizione, codice di sblocco) — Google la vedrebbe
// comunque solo come una schermata d'ingresso, mai il contenuto vero. La
// porta d'accesso è "/", ed è la sola pagina che vale la pena elencare.
export default function sitemap(): MetadataRoute.Sitemap {
  const host = `https://${siteHost()}`;
  return [
    {
      url: host,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
