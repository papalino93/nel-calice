"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { AdminShell } from "@/components/admin/AdminShell";
import { CatalogueMasterDetail } from "@/components/admin/CatalogueMasterDetail";

export default function CataloguePage() {
  const { t } = useLanguage();

  return (
    <AdminShell
      title="Catalogo lezioni"
      backHref="/relatore"
      backLabel={t.adminArea}
    >
      <CatalogueMasterDetail selectedId={null} />
    </AdminShell>
  );
}
