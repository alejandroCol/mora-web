import { Suspense } from "react";
import { CrmWorkspace } from "@/components/admin/crm/CrmWorkspace";
import { BrandLoader } from "@/components/brand/BrandLoader";

export default function CrmPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[50vh] place-items-center">
          <BrandLoader label="CRM" />
        </div>
      }
    >
      <CrmWorkspace />
    </Suspense>
  );
}
