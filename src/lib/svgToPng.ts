/**
 * Converte un SVG già presente nella pagina in un PNG ad alta risoluzione.
 *
 * È il pezzo che rende possibile la "sorgente unica" (§7.11): invece di
 * ridisegnare l'attestato su canvas con codice parallelo — che poi diverge da
 * quello a schermo — si prende esattamente il nodo che l'utente sta vedendo e
 * lo si rasterizza. Se il disegno cambia, il PNG cambia con lui, per
 * costruzione.
 *
 * Il fattore 3 serve alla stampa: 3000×2100 px su un foglio A4 orizzontale
 * sono circa 250 dpi.
 */
export async function downloadSvgAsPng(
  svg: SVGSVGElement,
  fileName: string,
  scale = 3,
): Promise<void> {
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

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}
