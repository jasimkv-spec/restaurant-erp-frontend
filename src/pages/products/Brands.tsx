import { CrudTable } from "../../components/CrudTable";

export default function Brands() {
  return (
    <CrudTable
      title="Brands"
      description="Manufacturer or house brand an item is sold or bought under."
      basePath="/api/inventory/brands"
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
