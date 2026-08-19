import { CrudTable } from "../../components/CrudTable";

export default function ProductGroups() {
  return (
    <CrudTable
      title="Product Groups"
      description="Top level of item classification (e.g. Food, Beverage, Packaging) - Subgroups and Families narrow it further."
      basePath="/api/inventory/product-groups"
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "status", label: "Status" },
      ]}
      formFields={[
        { key: "code", label: "Code", type: "text", required: true },
        { key: "name", label: "Name", type: "text", required: true },
      ]}
    />
  );
}
