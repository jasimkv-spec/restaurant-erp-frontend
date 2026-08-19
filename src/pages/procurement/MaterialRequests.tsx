import { useEffect, useState } from "react";
import { DocumentScreen, PriorityBadge } from "../../components/DocumentScreen";
import { useOptions } from "../../lib/useOptions";
import { useAuth } from "../../context/AuthContext";
import { api, type ListResponse } from "../../lib/apiClient";

const SOURCE_TYPES = ["Branch", "Warehouse", "CentralKitchen", "Direct"];
const PRIORITIES = ["Low", "Normal", "High", "Urgent"];

interface ItemIndexEntry {
  baseUomId: string | null;
  baseUomCode: string;
}

export default function MaterialRequests() {
  const { user } = useAuth();
  const companyOptions = useOptions("/api/admin/companies", (c) => `${c.code} - ${c.name}`);
  const allBranchOptions = useOptions("/api/admin/branches", (b) => `${b.code} - ${b.name}`);
  const warehouseOptions = useOptions("/api/admin/warehouses", (w) => `${w.code} - ${w.name}`);
  const itemOptions = useOptions("/api/inventory/items", (i) => `${i.code} - ${i.name}`);
  const uomOptions = useOptions("/api/masters/uoms", (u) => `${u.code} - ${u.name}`);
  const uomLabelById = Object.fromEntries(uomOptions.map((o) => [o.value, o.label.split(" - ")[0]]));

  // Item's base UOM + every configured packing conversion (item-specific or
  // generic) - fetched once and combined client-side, so a line's Unit
  // dropdown can offer "Box"/"Carton"/"Dozen" etc. for that specific item
  // without an extra round trip per row. See uom-conversions master screen
  // for where these get configured (Masters > UOM conversions).
  const [itemsIndex, setItemsIndex] = useState<Record<string, ItemIndexEntry>>({});
  const [allConversions, setAllConversions] = useState<{ itemId: string | null; fromUomId: string; toUomId: string }[]>([]);

  useEffect(() => {
    api.get<ListResponse<any>>("/api/inventory/items?pageSize=500").then((res) => {
      setItemsIndex(
        Object.fromEntries(
          res.data.map((i) => [i.id, { baseUomId: i.baseUomId ?? null, baseUomCode: i.baseUom?.code ?? "" }])
        )
      );
    });
    api.get<ListResponse<any>>("/api/masters/uom-conversions?pageSize=500").then((res) => {
      setAllConversions(res.data.map((c) => ({ itemId: c.itemId ?? null, fromUomId: c.fromUomId, toUomId: c.toUomId })));
    });
  }, []);

  function uomOptionsForItem(itemId: string) {
    if (!itemId) return [];
    const ids = new Set<string>();
    const base = itemsIndex[itemId]?.baseUomId;
    if (base) ids.add(base);
    for (const c of allConversions) {
      if (c.itemId === itemId || c.itemId === null) {
        ids.add(c.fromUomId);
        ids.add(c.toUomId);
      }
    }
    return Array.from(ids).map((id) => ({ value: id, label: uomLabelById[id] ?? id }));
  }

  // Branch scoping from login (see auth.routes.ts): a user restricted to one
  // branch never has to pick it - the field locks to that branch the same
  // way a locked auto-code field does. A user with several (or with no
  // restriction at all, i.e. head office) still chooses, just from the
  // right list instead of every branch in the system.
  const myBranches = user?.branches;
  const singleBranch = myBranches && myBranches.length === 1 ? myBranches[0] : null;
  const branchOptions = myBranches && myBranches.length > 0
    ? myBranches.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` }))
    : allBranchOptions;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <DocumentScreen
      title="Material Requests"
      description="A branch or kitchen asking for stock or a service to be sourced - the starting point of the procure-to-pay flow. Once approved it can be pulled into an MR Consolidation for buying or an internal transfer."
      basePath="/api/procurement/material-requests"
      createDefaults={{
        requestType: "Material",
        priority: "Normal",
        sourceType: "Branch",
        requestDate: today,
        ...(singleBranch ? { branchId: singleBranch.id } : {}),
      }}
      listColumns={[
        { key: "mrNo", label: "MR No." },
        { key: "title", label: "Title" },
        { key: "requestType", label: "Type" },
        { key: "priority", label: "Priority", render: (r) => <PriorityBadge priority={r.priority ?? "Normal"} /> },
        { key: "branch", label: "Branch", render: (r) => (r.branch ? `${r.branch.code} - ${r.branch.name}` : "-") },
        { key: "requestDate", label: "Date", render: (r) => (r.requestDate ? new Date(r.requestDate).toLocaleDateString() : "-") },
        { key: "lines", label: "Lines", render: (r) => r.lines?.length ?? 0 },
        { key: "status", label: "Status" },
      ]}
      headerFields={[
        { key: "companyId", label: "Company", type: "select", required: true, options: companyOptions },
        {
          key: "branchId",
          label: "Branch",
          type: "select",
          required: true,
          options: branchOptions,
          disabled: !!singleBranch,
        },
        { key: "warehouseId", label: "Warehouse (optional)", type: "select", options: warehouseOptions },
        { key: "title", label: "MR title", type: "text", required: true, placeholder: "Shown on every RFQ/PO/GRN raised from this MR" },
        {
          key: "requestType",
          label: "Request type",
          type: "select",
          options: [
            { value: "Material", label: "Material Request" },
            { value: "Service", label: "Service Request" },
          ],
        },
        { key: "priority", label: "Priority", type: "select", options: PRIORITIES.map((p) => ({ value: p, label: p })) },
        {
          key: "sourceType",
          label: "Source type (optional)",
          type: "select",
          options: SOURCE_TYPES.map((s) => ({ value: s, label: s })),
        },
        { key: "requestDate", label: "Transaction date", type: "date", required: true },
        { key: "requiredDate", label: "Requested by date (optional)", type: "date" },
        {
          key: "validityDate",
          label: "Valid until (optional)",
          type: "date",
          placeholder: "After this date it drops out of Consolidation/RFQ/PO",
        },
        { key: "notes", label: "Narration", type: "textarea", placeholder: "Optional notes for whoever reviews or actions this MR" },
      ]}
      lineFields={[
        { key: "itemId", label: "Item", type: "select", required: true, options: itemOptions },
        { key: "baseUomDisplay", label: "Base UOM", type: "readonly", computed: (row) => itemsIndex[row.itemId]?.baseUomCode || "-" },
        { key: "requestedQty", label: "Qty", type: "number", required: true },
        {
          key: "uomId",
          label: "Unit",
          type: "select",
          required: true,
          options: uomOptions,
          optionsForRow: (row) => (row.itemId ? uomOptionsForItem(row.itemId) : uomOptions),
        },
      ]}
      emptyLine={{ itemId: "", requestedQty: "", uomId: "" }}
      lifecycle={[
        { fromStatus: "Draft", action: "submit", label: "Submit for Approval" },
        { fromStatus: "Submitted", action: "approve", label: "Approve", confirmMessage: "Approve this material request as requested?" },
      ]}
    />
  );
}
