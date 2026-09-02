import { NextResponse } from "next/server";
import { decryptCode } from "@/lib/codes";
import { isDenied, requireAdmin } from "@/lib/guard";
import { prisma } from "@/lib/prisma";

/** Casa del relatore: i corsi che gestisce e la dimensione del catalogo. */
export async function GET() {
  const user = await requireAdmin();
  if (isDenied(user)) return user.response;

  const [courses, catalogueSize] = await Promise.all([
    prisma.course.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        slug: true,
        titleIt: true,
        titleEn: true,
        subtitleIt: true,
        subtitleEn: true,
        status: true,
        enrollmentOpen: true,
        enrollmentCodeEncrypted: true,
        _count: { select: { lessons: true, enrollments: true } },
      },
    }),
    prisma.lesson.count(),
  ]);

  return NextResponse.json({
    user: { name: user.name, email: user.email },
    catalogueSize,
    courses: courses.map((c) => ({
      slug: c.slug,
      titleIt: c.titleIt,
      titleEn: c.titleEn,
      subtitleIt: c.subtitleIt,
      subtitleEn: c.subtitleEn,
      status: c.status,
      enrollmentOpen: c.enrollmentOpen,
      enrollmentCode: decryptCode(c.enrollmentCodeEncrypted),
      lessonCount: c._count.lessons,
      enrolledCount: c._count.enrollments,
    })),
  });
}
