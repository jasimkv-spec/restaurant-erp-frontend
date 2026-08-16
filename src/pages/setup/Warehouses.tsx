import { CrudTable } from "../../components/CrudTable";
import { useOptions } from "../../lib/useOptions";

const WAREHOUSE_TYPES = ["Raw Material", "Kitchen", "Finished Goods", "Dispatch", "Quarantine", "Rejected", "In-Transit"];

export default function Warehouses() {
  const branchOptions = useOptions("/api/admin/branches", (b) => `${b.code} - ${b.name}`);

  return (
    <CrudTable
      title="Warehouses"
      description="Physical or logical stock locations within a branch - stock balances and every posting live here."
      basePath="/api/admin/warehouses"
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "warehouseType", label: "Type" },
        { key: "status", label: "Status" },
      ]}
      formFields={[
        { key: "branchId", label: "Branch", type: "select", required: true, options: branchOptions },
        { key: "code", label: "Code", type: "text", required: true },
        { key: "name", label: "Name", type: "text", required: true },
        {
          key: "warehouseType",
          label: "Warehouse type",
          type: "select",
          required: true,
          options: WAREHOUSE_TYPES.map((t) => ({ value: t, label: t })),
        },
        { key: "isQuarantine", label: "Quarantine warehouse", type: "checkbox" },
        { key: "isInTransit", label: "In-transit warehouse", type: "checkbox" },
      ]}
    />
  );
}
