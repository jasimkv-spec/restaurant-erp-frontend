import { CrudTable } from "../../components/CrudTable";
import { useOptions } from "../../lib/useOptions";

export default function CostCentres() {
  const companyOptions = useOptions("/api/admin/companies", (c) => `${c.code} - ${c.name}`);

  return (
    <CrudTable
      title="Cost Centres"
      description="Where expenses get tagged for reporting - can nest under a parent cost centre."
      basePath="/api/admin/cost-centres"
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "status", label: "Status" },
      ]}
      formFields={[
        { key: "companyId", label: "Company", type: "select", required: true, options: companyOptions },
        { key: "code", label: "Code", type: "text", required: true },
        { key: "name", label: "Name", type: "text", required: true },
      ]}
    />
  );
}
