import { PaymentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { isDenied, requireAdmin } from "@/lib/guard";
import { prisma } from "@/lib/prisma";

/**
 * Aggiorna solo la scheda interna di un iscritto: pagamento e nota. Il
 * pagamento non viene mai dedotto da un dato del browser, perché nella
 * pratica può avvenire in contanti, con bonifico o fuori dalla piattaforma.
 */
export async function PATCH(
  request: Request,
  {
    params,
  }: { params: Promise<{ slug: string; enrollmentId: string }> },
) {
  const admin = await requireAdmin();
  if (isDenied(admin)) return admin.response;

  const body = await request.json().catch(() => null);
  const hasPaymentStatus =
    body?.paymentStatus === PaymentStatus.TO_VERIFY ||
    body?.paymentStatus === PaymentStatus.PAID;
  const hasNotes = typeof body?.adminNotes === "string";

  if (!hasPaymentStatus && !hasNotes) {
    return NextResponse.json({ error: "Dati non validi." }, { status: 400 });
  }
  if (hasNotes && body.adminNotes.length > 2000) {
    return NextResponse.json(
      { error: "La nota può contenere al massimo 2.000 caratteri." },
      { status: 400 },
    );
  }

  const { slug, enrollmentId } = await params;
  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, course: { slug } },
    select: { paymentStatus: true },
  });
  if (!enrollment) {
    return NextResponse.json({ error: "Iscritto non trovato." }, { status: 404 });
  }

  const paymentStatus = hasPaymentStatus
    ? body.paymentStatus
    : enrollment.paymentStatus;
  const updated = await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      ...(hasNotes
        ? { adminNotes: body.adminNotes.trim() || null }
        : {}),
      ...(hasPaymentStatus
        ? {
            paymentStatus,
            paidAt:
              paymentStatus === PaymentStatus.PAID
                ? enrollment.paymentStatus === PaymentStatus.PAID
                  ? undefined
                  : new Date()
                : null,
          }
        : {}),
    },
    select: { paymentStatus: true, paidAt: true, adminNotes: true },
  });

  return NextResponse.json({
    paymentStatus: updated.paymentStatus,
    paidAt: updated.paidAt?.toISOString() ?? null,
    adminNotes: updated.adminNotes,
  });
}
