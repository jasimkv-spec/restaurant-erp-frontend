import { CrudTable } from "../../components/CrudTable";
import { useOptions } from "../../lib/useOptions";

export default function ProfitCentres() {
  const companyOptions = useOptions("/api/admin/companies", (c) => `${c.code} - ${c.name}`);
  const branchOptions = useOptions("/api/admin/branches", (b) => `${b.code} - ${b.name}`);

  return (
    <CrudTable
      title="Profit Centres"
      description="Where revenue gets tagged for reporting - usually one per branch, but not required to be."
      basePath="/api/admin/profit-centres"
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "status", label: "Status" },
      ]}
      formFields={[
        { key: "companyId", label: "Company", type: "select", required: true, options: companyOptions },
        { key: "branchId", label: "Branch", type: "select", options: branchOptions },
        { key: "code", label: "Code", type: "text", required: true },
        { key: "name", label: "Name", type: "text", required: true },
      ]}
    />
  );
}
