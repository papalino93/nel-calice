import { issueSignedToken, presignUrl } from "@vercel/blob";

/**
 * Firma un permesso di scrittura a tempo per un unico percorso dello store.
 * Il file non passa mai dal server: il permesso basta al browser per
 * caricarlo direttamente, il che è ciò che toglie il limite di ~4MB
 * dell'app attuale (§7.14), dove il file viaggiava in base64 dentro il
 * corpo della richiesta e quindi attraverso la funzione serverless.
 *
 * Firmato a mano invece di usare `handleUploadPresigned` dell'SDK: quello
 * pretende una chiave pubblica per verificare le notifiche di caricamento
 * completato — notifiche che qui non si usano, e la cui chiave Vercel non
 * fornisce per gli store creati da riga di comando. Il pezzo che serve
 * davvero, `presignUrl`, è esportato e funziona da solo.
 *
 * Condiviso fra dispense e loghi: sono due usi dello stesso store con
 * vincoli diversi (tipo di file, dimensione), non due meccanismi diversi.
 */
export async function issuePutPermission(input: {
  pathname: string;
  contentType: string;
  maxBytes: number;
  validForMs?: number;
}): Promise<string> {
  const validUntil = Date.now() + (input.validForMs ?? 10 * 60 * 1000);

  // Il permesso è ristretto a questo preciso percorso, a questo tipo di
  // file e a questa dimensione: anche intercettandolo non si può usare
  // per scrivere altro nello store.
  const token = await issueSignedToken({
    pathname: input.pathname,
    operations: ["put"],
    validUntil,
    allowedContentTypes: [input.contentType],
    maximumSizeInBytes: input.maxBytes,
  });

  const { presignedUrl } = await presignUrl(token, {
    operation: "put",
    pathname: input.pathname,
    validUntil,
    allowedContentTypes: [input.contentType],
    maximumSizeInBytes: input.maxBytes,
    // Va disattivato esplicitamente: di default lo storage aggiunge un
    // suffisso casuale *dopo* la firma, e il percorso salvato non
    // combacerebbe più con quello reale. L'unicità la garantisce il nome
    // composto dal client.
    addRandomSuffix: false,
    access: "private",
  });

  return presignedUrl;
}
