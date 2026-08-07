import { NextResponse } from "next/server";
import {
  handleUploadPresigned,
  type HandleUploadPresignedBody,
} from "@vercel/blob/client";
import { issueSignedToken } from "@vercel/blob";
import { currentUser } from "@/lib/session";

/**
 * Caricamento diretto dal browser allo storage.
 *
 * Questa route non riceve mai il file: emette un permesso firmato a tempo, e
 * il browser carica direttamente sullo store. È ciò che supera il limite di
 * ~4MB dell'app attuale (§7.14), dove il file passava in base64 dentro il
 * corpo della richiesta e quindi attraverso la funzione serverless.
 *
 * Si usa il flusso *presigned* e non quello ordinario perché lo store è
 * privato: il flusso ordinario fa scrivere il browser sul piano di controllo
 * di Vercel, che dal browser non è raggiungibile (il CORS lo blocca).
 * Qui invece il browser riceve un URL già firmato su cui può scrivere.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadPresignedBody;

  try {
    const result = await handleUploadPresigned({
      body,
      request,
      // Chiamata prima di firmare: è qui che si verifica chi sta caricando.
      // Senza questo controllo chiunque userebbe lo store come spazio proprio.
      getSignedToken: async (pathname) => {
        const user = await currentUser();
        if (user?.role !== "relatore") {
          throw new Error("non autorizzato");
        }

        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          validUntil: Date.now() + 10 * 60 * 1000,
          allowedContentTypes: [
            "application/pdf",
            "image/png",
            "image/jpeg",
            "image/webp",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          ],
          maximumSizeInBytes: 50 * 1024 * 1024,
        });

        // Il carattere privato viene dallo store, non da qui. Il suffisso
        // casuale evita che due dispense con lo stesso nome di file si
        // sovrascrivano a vicenda.
        return { token, urlOptions: { addRandomSuffix: true } };
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "caricamento fallito" },
      { status: 400 },
    );
  }
}
