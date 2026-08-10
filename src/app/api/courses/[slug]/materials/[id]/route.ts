import { NextResponse } from "next/server";
import { isDenied, requireEnrollment } from "@/lib/guard";
import { courseOverview } from "@/lib/course";
import { prisma } from "@/lib/prisma";
import { readStoredFile } from "@/lib/materials";
import { readerLabel, stampPdf } from "@/lib/watermark";

/**
 * Serve una dispensa a un iscritto.
 *
 * Il controllo avviene ad **ogni** lettura, non una volta sola: chi non è
 * iscritto, o ha la lezione ancora bloccata, non riceve il file. Copiare
 * questo indirizzo e girarlo non serve a nulla senza la propria sessione —
 * ed è ciò che rende vero il §3.7d.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;

  const ctx = await requireEnrollment(slug);
  if (isDenied(ctx)) return ctx.response;

  const material = await prisma.material.findUnique({
    where: { id },
    select: { url: true, lessonId: true, courseId: true },
  });
  if (!material) {
    return NextResponse.json({ error: "dispensa inesistente" }, { status: 404 });
  }

  // Deve appartenere a questo corso, direttamente o tramite una sua lezione.
  const overview = await courseOverview(ctx.enrollment);
  if (!overview) {
    return NextResponse.json({ error: "corso inesistente" }, { status: 404 });
  }

  if (material.courseId && material.courseId !== ctx.enrollment.courseId) {
    return NextResponse.json({ error: "non disponibile" }, { status: 403 });
  }

  if (material.lessonId !== null) {
    // La dispensa segue il blocco della lezione a cui appartiene: si guarda
    // lo sblocco vero, non lo stato mostrato, che per una lezione ancora
    // senza domande dice "vuoto" anche a serata chiusa.
    const courseLesson = await prisma.courseLesson.findFirst({
      where: { courseId: ctx.enrollment.courseId, lessonId: material.lessonId },
      select: { id: true },
    });
    const card = overview.lessons.find(
      (l) => l.courseLessonId === courseLesson?.id,
    );
    if (!card || !card.unlocked) {
      return NextResponse.json({ error: "non disponibile" }, { status: 403 });
    }
  } else if (material.courseId === null) {
    // Senza proprietario non c'è niente da verificare, quindi non si serve:
    // oggi il caso è impedito da un vincolo del database, ma quel vincolo
    // vive solo nella migrazione e non nello schema Prisma. Se un giorno
    // venisse ricreato senza, qui si aprirebbe una dispensa leggibile da
    // qualunque iscritto di qualunque corso.
    return NextResponse.json({ error: "non disponibile" }, { status: 403 });
  }

  const file = await readStoredFile(material.url);
  if (!file) {
    return NextResponse.json({ error: "file inesistente" }, { status: 404 });
  }

  // Contatore visualizzazioni e registro delle letture: né l'uno né l'altro
  // deve far fallire la lettura se va storto — la dispensa resta più
  // importante di chi la sta guardando.
  void prisma.material
    .update({ where: { id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});
  void prisma.materialView
    .create({ data: { materialId: id, enrollmentId: ctx.enrollment.id } })
    .catch(() => {});

  const contentType = file.blob.contentType ?? "application/octet-stream";

  const headers = {
    // `no-store` e non `no-cache`: quest'ultimo lascia comunque il file sul
    // disco del browser, e su un computer condiviso resterebbe leggibile
    // dopo l'uscita.
    "Cache-Control": "private, no-store",
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    // Si apre dentro l'app invece di scendere nella cartella dei download:
    // non impedisce niente, ma toglie il gesto automatico che trasforma una
    // dispensa in un file da inoltrare.
    "Content-Disposition": "inline",
  };

  // I PDF escono firmati con il nome di chi li sta aprendo (vedi
  // src/lib/watermark.ts). Se la firma non riesce si serve l'originale:
  // meglio una dispensa senza firma che un corsista senza dispensa.
  if (contentType === "application/pdf") {
    const original = new Uint8Array(await new Response(file.stream).arrayBuffer());
    const label = readerLabel(ctx.user, new Date());
    const stamped = await stampPdf(original, label);
    const body = stamped ?? original;

    return new NextResponse(
      body.buffer.slice(
        body.byteOffset,
        body.byteOffset + body.byteLength,
      ) as ArrayBuffer,
      { headers },
    );
  }

  return new NextResponse(file.stream, { headers });
}
