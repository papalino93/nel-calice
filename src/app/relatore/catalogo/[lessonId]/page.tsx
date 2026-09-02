"use client";

import { use } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { AdminShell } from "@/components/admin/AdminShell";
import { CatalogueMasterDetail } from "@/components/admin/CatalogueMasterDetail";

export default function LessonEditorPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = use(params);
  const { t } = useLanguage();

  return (
    <AdminShell
      title="Catalogo lezioni"
      backHref="/relatore"
      backLabel={t.adminArea}
    >
      <CatalogueMasterDetail selectedId={Number(lessonId)} />
    </AdminShell>
  );
}
