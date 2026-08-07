import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { currentUser } from "@/lib/session";

/**
 * Caricamento diretto dal browser allo storage.
 *
 * Questa route non riceve mai il file: emette solo un permesso a tempo, e il
 * browser carica direttamente sullo store. È ciò che supera il limite di
 * ~4MB dell'app attuale (§7.14), dove il file passava in base64 dentro il
 * corpo della richiesta e quindi attraverso la funzione serverless.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      // Chiamata prima di emettere il permesso: è qui che si verifica chi
      // sta caricando. Senza questo controllo chiunque potrebbe usare lo
      // store come spazio proprio.
      onBeforeGenerateToken: async () => {
        const user = await currentUser();
        if (user?.role !== "relatore") {
          throw new Error("non autorizzato");
        }
        return {
          allowedContentTypes: [
            "application/pdf",
            "image/png",
            "image/jpeg",
            "image/webp",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          ],
          maximumSizeInBytes: 50 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      // Chiamata dallo store a caricamento finito. In sviluppo non arriva
      // (lo store non raggiunge localhost): la riga viene creata comunque
      // dalla chiamata successiva del pannello.
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "caricamento fallito" },
      { status: 400 },
    );
  }
}
