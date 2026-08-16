import { CrudTable } from "../../components/CrudTable";
import { useOptions } from "../../lib/useOptions";

const BRANCH_TYPES = ["Head Office", "Outlet", "Central Kitchen", "Warehouse", "Franchise Outlet"];

export default function Branches() {
  const companyOptions = useOptions("/api/admin/companies", (c) => `${c.code} - ${c.name}`);

  return (
    <CrudTable
      title="Branches"
      description="Each branch belongs to exactly one company - outlets, central kitchens, franchise locations."
      basePath="/api/admin/branches"
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "branchType", label: "Type" },
        { key: "status", label: "Status" },
      ]}
      formFields={[
        { key: "companyId", label: "Company", type: "select", required: true, options: companyOptions },
        { key: "code", label: "Code", type: "text", required: true },
        { key: "name", label: "Name", type: "text", required: true },
        {
          key: "branchType",
          label: "Branch type",
          type: "select",
          required: true,
          options: BRANCH_TYPES.map((t) => ({ value: t, label: t })),
        },
      ]}
    />
  );
}
