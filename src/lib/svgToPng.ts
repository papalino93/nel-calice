/**
 * Converte un SVG già presente nella pagina in un PNG ad alta risoluzione.
 *
 * È il pezzo che rende possibile la "sorgente unica" (§7.11): invece di
 * ridisegnare l'attestato su canvas con codice parallelo — che poi diverge da
 * quello a schermo — si prende esattamente il nodo che l'utente sta vedendo e
 * lo si rasterizza. Se il disegno cambia, il PNG cambia con lui, per
 * costruzione.
 *
 * Il fattore 3 serve alla stampa: a 1000×760 di pergamena fa 3000×2280 px,
 * circa 250 dpi su un foglio A4 orizzontale.
 */
export async function svgToPngBlob(
  svg: SVGSVGElement,
  scale = 3,
): Promise<Blob> {
  const viewBox = svg.viewBox.baseVal;
  const width = viewBox.width || svg.clientWidth;
  const height = viewBox.height || svg.clientHeight;

  // Si lavora su una copia: al nodo mostrato non si tocca nulla.
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const source = new XMLSerializer().serializeToString(clone);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("SVG non convertibile"));
    img.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas non disponibile");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("PNG non generato");
  return blob;
}

/**
 * Fa scaricare un blob col nome scelto, tramite un link temporaneo con
 * `download`. Funziona su desktop; su Safari iOS l'attributo `download` su
 * un `blob:` non è affidabile — è il motivo per cui `CertificateView` prova
 * prima `navigator.share` quando disponibile, e usa questo solo come
 * ripiego (§7.17).
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  // Il link va attaccato al documento: Firefox ignora il click su un nodo
  // che non è nel DOM, e il salvataggio non partiva — silenziosamente.
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // E l'indirizzo si revoca DOPO, non nello stesso giro: revocarlo subito
  // correva contro la lettura del blob da parte del browser, che a volte
  // arrivava a mani vuote.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
