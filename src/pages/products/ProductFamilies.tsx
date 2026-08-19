import { CrudTable } from "../../components/CrudTable";
import { useOptions } from "../../lib/useOptions";

export default function ProductFamilies() {
  const subgroupOptions = useOptions("/api/inventory/product-subgroups", (s) => `${s.code} - ${s.name}`);

  return (
    <CrudTable
      title="Product Families"
      description="Most specific level of item classification, under a Subgroup - optional, use it if Group/Subgroup alone isn't specific enough."
      basePath="/api/inventory/product-families"
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "subgroup", label: "Subgroup", render: (row: any) => row.subgroup?.name },
        { key: "status", label: "Status" },
      ]}
      formFields={[
        { key: "subgroupId", label: "Product subgroup", type: "select", options: subgroupOptions },
        { key: "code", label: "Code", type: "text", required: true },
        { key: "name", label: "Name", type: "text", required: true },
      ]}
    />
  );
}
