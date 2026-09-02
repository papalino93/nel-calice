import type { MetadataRoute } from "next";
import { siteHost } from "@/lib/site";

// L'app resta privata dopo l'accesso, ma la pagina dei prossimi corsi è una
// vera pagina pubblica: è la destinazione dei QR su locandine e condivisioni.
export default function sitemap(): MetadataRoute.Sitemap {
  const host = `https://${siteHost()}`;
  return [
    {
      url: host,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${host}/prossimi-corsi`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];
}
