import { CrudTable } from "../../components/CrudTable";
import { useOptions } from "../../lib/useOptions";

export default function ProductSubgroups() {
  const groupOptions = useOptions("/api/inventory/product-groups", (g) => `${g.code} - ${g.name}`);

  return (
    <CrudTable
      title="Product Subgroups"
      description="Sits under a Product Group (e.g. Food -> Bakery) - Families can narrow it one level further."
      basePath="/api/inventory/product-subgroups"
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "group", label: "Group", render: (row: any) => row.group?.name },
        { key: "status", label: "Status" },
      ]}
      formFields={[
        { key: "groupId", label: "Product group", type: "select", required: true, options: groupOptions },
        { key: "code", label: "Code", type: "text", required: true },
        { key: "name", label: "Name", type: "text", required: true },
      ]}
    />
  );
}
