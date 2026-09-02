// Lato client: nessun import da qui verso Prisma o altro codice server-only.
// Il numero deve restare uguale a `MAX_INLINE_BYTES` in `src/lib/materials.ts`
// — quello lato server è la verifica che conta davvero, questo è solo per
// dare un errore chiaro prima di provare a caricare.
export const MAX_UPLOAD_MB = 3;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** Legge un file scelto dall'utente come base64, senza il prefisso data URL. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Lettura del file fallita."));
    reader.readAsDataURL(file);
  });
}
