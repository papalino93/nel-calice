import type { MetadataRoute } from "next";
import { siteHost } from "@/lib/site";

// L'area relatore e le API non hanno senso indicizzate: la prima è
// riservata (login richiesto, e ogni contenuto è privato di un corso), la
// seconda non è mai una pagina da mostrare a chi cerca su Google.
export default function robots(): MetadataRoute.Robots {
  const host = `https://${siteHost()}`;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/relatore", "/api"],
    },
    sitemap: `${host}/sitemap.xml`,
  };
}
