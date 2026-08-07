import { NextResponse } from "next/server";
import { isDenied, requireUser } from "@/lib/guard";
import { myCourses } from "@/lib/enrollment";

/** I corsi a cui sono iscritto: è la schermata subito dopo il login. */
export async function GET() {
  const user = await requireUser();
  if (isDenied(user)) return user.response;

  const enrollments = await myCourses(user.id);

  return NextResponse.json({
    user: { name: user.name, email: user.email, role: user.role },
    courses: enrollments.map((e) => ({
      slug: e.course.slug,
      titleIt: e.course.titleIt,
      titleEn: e.course.titleEn,
      subtitleIt: e.course.subtitleIt,
      subtitleEn: e.course.subtitleEn,
      status: e.course.status,
      enrolledAt: e.enrolledAt.toISOString(),
    })),
  });
}
