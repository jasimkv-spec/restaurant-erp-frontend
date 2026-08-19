import { DocumentScreen } from "../../components/DocumentScreen";
import { useOptions } from "../../lib/useOptions";

const SOURCE_TYPES = ["Branch", "Warehouse", "CentralKitchen", "Direct"];

export default function MaterialRequests() {
  const companyOptions = useOptions("/api/admin/companies", (c) => `${c.code} - ${c.name}`);
  const branchOptions = useOptions("/api/admin/branches", (b) => `${b.code} - ${b.name}`);
  const warehouseOptions = useOptions("/api/admin/warehouses", (w) => `${w.code} - ${w.name}`);
  const itemOptions = useOptions("/api/inventory/items", (i) => `${i.code} - ${i.name}`);
  const uomOptions = useOptions("/api/masters/uoms", (u) => `${u.code} - ${u.name}`);

  return (
    <DocumentScreen
      title="Material Requests"
      description="A branch or kitchen asking for stock to be sourced - the starting point of the procure-to-pay flow. Once approved it can be pulled into an MR Consolidation for buying or an internal transfer."
      basePath="/api/procurement/material-requests"
      createDefaults={{ sourceType: "Branch" }}
      listColumns={[
        { key: "mrNo", label: "MR No." },
        { key: "sourceType", label: "Source" },
        { key: "requiredDate", label: "Required date", render: (r) => (r.requiredDate ? new Date(r.requiredDate).toLocaleDateString() : "-") },
        { key: "lines", label: "Lines", render: (r) => r.lines?.length ?? 0 },
        { key: "status", label: "Status" },
      ]}
      headerFields={[
        { key: "companyId", label: "Company", type: "select", required: true, options: companyOptions },
        { key: "branchId", label: "Branch", type: "select", required: true, options: branchOptions },
        { key: "warehouseId", label: "Warehouse (optional)", type: "select", options: warehouseOptions },
        {
          key: "sourceType",
          label: "Source type",
          type: "select",
          required: true,
          options: SOURCE_TYPES.map((s) => ({ value: s, label: s })),
        },
        { key: "requiredDate", label: "Required date", type: "date" },
      ]}
      lineFields={[
        { key: "itemId", label: "Item", type: "select", required: true, options: itemOptions },
        { key: "requestedQty", label: "Qty", type: "number", required: true },
        { key: "uomId", label: "UOM", type: "select", required: true, options: uomOptions },
        { key: "requiredDate", label: "Required date", type: "date" },
      ]}
      emptyLine={{ itemId: "", requestedQty: "", uomId: "", requiredDate: "" }}
      lifecycle={[
        { fromStatus: "Draft", action: "submit", label: "Submit for Approval" },
        { fromStatus: "Submitted", action: "approve", label: "Approve", confirmMessage: "Approve this material request as requested?" },
      ]}
    />
  );
}
