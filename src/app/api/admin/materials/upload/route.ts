import { NextResponse } from "next/server";
import { issueSignedToken, presignUrl } from "@vercel/blob";
import { isDenied, requireAdmin } from "@/lib/guard";

/**
 * Firma un indirizzo su cui il browser può scrivere il file, e basta.
 *
 * Il file non passa mai da qui: questa route emette solo un permesso a
 * tempo. È ciò che supera il limite di ~4MB dell'app attuale (§7.14), dove
 * il file viaggiava in base64 dentro il corpo della richiesta e quindi
 * attraverso la funzione serverless.
 *
 * Si firma a mano invece di usare `handleUploadPresigned` dell'SDK: quello
 * pretende una chiave pubblica per verificare le notifiche di caricamento
 * completato — notifiche che qui non si usano, e la cui chiave Vercel non
 * fornisce per gli store creati da riga di comando. Il pezzo che serve
 * davvero, `presignUrl`, è esportato e funziona da solo.
 */

const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

const MAX_BYTES = 50 * 1024 * 1024;
const PERMESSO_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const body = await request.json().catch(() => null);
  const pathname = typeof body?.pathname === "string" ? body.pathname : "";
  const contentType =
    typeof body?.contentType === "string" ? body.contentType : "";

  if (!pathname || !ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json(
      { error: "Tipo di file non ammesso." },
      { status: 400 },
    );
  }

  const validUntil = Date.now() + PERMESSO_MS;

  try {
    // Il permesso è ristretto a questo preciso percorso, a questo tipo di
    // file e a questa dimensione: anche intercettandolo non si può usare
    // per scrivere altro nello store.
    const token = await issueSignedToken({
      pathname,
      operations: ["put"],
      validUntil,
      allowedContentTypes: [contentType],
      maximumSizeInBytes: MAX_BYTES,
    });

    const { presignedUrl } = await presignUrl(token, {
      operation: "put",
      pathname,
      validUntil,
      allowedContentTypes: [contentType],
      maximumSizeInBytes: MAX_BYTES,
      addRandomSuffix: true,
      access: "private",
    });

    return NextResponse.json({ presignedUrl });
  } catch (error) {
    console.error("[materiali/upload]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "firma fallita" },
      { status: 400 },
    );
  }
}
