import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DocumentScreen, PriorityBadge } from "../../components/DocumentScreen";
import { useOptions } from "../../lib/useOptions";
import { useAuth } from "../../context/AuthContext";
import { api, hasPermission, type ListResponse } from "../../lib/apiClient";

const SOURCE_TYPES = ["Branch", "Warehouse", "CentralKitchen", "Direct"];
const PRIORITIES = ["Low", "Normal", "High", "Urgent"];

interface ItemIndexEntry {
  baseUomId: string | null;
  baseUomCode: string;
}

interface ConversionEntry {
  itemId: string | null;
  fromUomId: string;
  toUomId: string;
  factor: number;
}

/**
 * Client-side mirror of the backend's resolveUomQty (src/utils/uomConversion.ts)
 * - same lookup order (same unit -> item-specific -> generic -> reverse
 * factor) - so the line grid can show a live "Total (base unit)" figure as
 * the user types, without a round trip per keystroke. The server always
 * recomputes baseQty itself on save regardless, so this is a preview only.
 */
function resolveQtyClient(
  conversions: ConversionEntry[],
  params: { itemId: string; fromUomId: string; toUomId: string; qty: number }
): number | null {
  const { itemId, fromUomId, toUomId, qty } = params;
  if (!fromUomId || !toUomId) return null;
  if (fromUomId === toUomId) return qty;
  const forward = conversions.find(
    (c) => c.fromUomId === fromUomId && c.toUomId === toUomId && (c.itemId === itemId || c.itemId === null)
  );
  if (forward) return qty * forward.factor;
  const reverse = conversions.find(
    (c) => c.fromUomId === toUomId && c.toUomId === fromUomId && (c.itemId === itemId || c.itemId === null)
  );
  if (reverse && reverse.factor !== 0) return qty / reverse.factor;
  return null;
}

export default function MaterialRequests() {
  const navigate = useNavigate();
  const { user, activeCompanyScope } = useAuth();
  const allCompanyOptions = useOptions("/api/admin/companies", (c) => `${c.code} - ${c.name}`);
  const allBranchOptions = useOptions("/api/admin/branches", (b) => `${b.code} - ${b.name}`);
  const warehouseOptions = useOptions("/api/admin/warehouses", (w) => `${w.code} - ${w.name}`);
  // Only items flagged "Purchase" on their product record show up here -
  // that flag now actually means something (see inventory.routes.ts's
  // listFilters + crudFactory's boolean coercion).
  const itemOptions = useOptions("/api/inventory/items", (i) => `${i.code} - ${i.name}`, "forPurchase=true");
  const uomOptions = useOptions("/api/masters/uoms", (u) => `${u.code} - ${u.name}`);
  const uomLabelById = Object.fromEntries(uomOptions.map((o) => [o.value, o.label.split(" - ")[0]]));

  // Item's base UOM + every configured packing conversion (item-specific or
  // generic) - fetched once and combined client-side, so a line's Unit
  // dropdown can offer "Box"/"Carton"/"Dozen" etc. for that specific item
  // without an extra round trip per row, and so the "Total (base unit)"
  // column can be computed live via resolveQtyClient above. See
  // uom-conversions master screen for where these get configured.
  const [itemsIndex, setItemsIndex] = useState<Record<string, ItemIndexEntry>>({});
  const [allConversions, setAllConversions] = useState<ConversionEntry[]>([]);

  // Best-effort stock lookup, keyed by "warehouseId:itemId" so switching
  // branch/warehouse doesn't show a stale number from a different location.
  // Only ever populated for users who actually hold
  // Inventory.StockBalance.View - see canViewStock below - so this is purely
  // a nice-to-have, never a blocker if the permission or the stock module
  // isn't set up for this tenant yet.
  const [availableQtyByKey, setAvailableQtyByKey] = useState<Record<string, number | null>>({});
  // "This item already has an open MR for this branch" - keyed by line
  // index, populated from the check-duplicate endpoint whenever the item on
  // a line changes.
  const [lineWarnings, setLineWarnings] = useState<Record<number, string>>({});

  useEffect(() => {
    api.get<ListResponse<any>>("/api/inventory/items?pageSize=500").then((res) => {
      setItemsIndex(
        Object.fromEntries(
          res.data.map((i) => [i.id, { baseUomId: i.baseUomId ?? null, baseUomCode: i.baseUom?.code ?? "" }])
        )
      );
    });
    api.get<ListResponse<any>>("/api/masters/uom-conversions?pageSize=500").then((res) => {
      setAllConversions(
        res.data.map((c) => ({ itemId: c.itemId ?? null, fromUomId: c.fromUomId, toUomId: c.toUomId, factor: Number(c.factor) }))
      );
    });
  }, []);

  // A candidate Unit is only offered if it's the item's own base UOM, or a
  // conversion (item-specific or generic) directly connects it to that base
  // UOM - matching exactly what resolveUomQty (src/utils/uomConversion.ts,
  // mirrored client-side by resolveQtyClient above) can actually resolve at
  // save time (a single forward-or-reverse hop against the item's base
  // UOM, never a chain of hops through some other unit). Previously this
  // pulled in the fromUomId/toUomId of *every* generic conversion
  // regardless of whether it had anything to do with this item's base UOM
  // - so a GR-based item would incorrectly offer LTR just because some
  // unrelated LTR<->ML conversion existed in the system.
  function uomOptionsForItem(itemId: string) {
    if (!itemId) return [];
    const base = itemsIndex[itemId]?.baseUomId;
    const ids = new Set<string>();
    if (!base) return [];
    ids.add(base);
    for (const c of allConversions) {
      if (c.itemId !== itemId && c.itemId !== null) continue;
      if (c.fromUomId === base) ids.add(c.toUomId);
      else if (c.toUomId === base) ids.add(c.fromUomId);
    }
    return Array.from(ids).map((id) => ({ value: id, label: uomLabelById[id] ?? id }));
  }

  // Company scope is decided once, right after login (see ChooseCompany.tsx
  // / AuthContext) - "GLOBAL" means the user deliberately wants every
  // transaction to ask for its own Company, same as this screen behaved
  // before company scoping existed. A real company id means everything on
  // this screen - the Company field, the Branch choices, masters - narrows
  // to just that company for the rest of the session.
  const scopedCompanyId = activeCompanyScope && activeCompanyScope !== "GLOBAL" ? activeCompanyScope : null;

  // Company options are restricted to what this user can actually access
  // (from login), same principle as branch scoping below - falls back to
  // every tenant company only for a user with no restriction recorded at all.
  const myCompanies = user?.companies;
  const companyOptions = myCompanies && myCompanies.length > 0
    ? myCompanies.map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }))
    : allCompanyOptions;

  // Branch scoping from login (see auth.routes.ts): a user restricted to one
  // branch never has to pick it - the field locks to that branch the same
  // way a locked auto-code field does. When a specific company is active,
  // branches from any other company are dropped from the list entirely -
  // no point offering a branch the current transaction can't use.
  const myBranches = user?.branches?.filter((b) => !scopedCompanyId || b.companyId === scopedCompanyId);
  const singleBranch = myBranches && myBranches.length === 1 ? myBranches[0] : null;
  const branchOptions = myBranches && myBranches.length > 0
    ? myBranches.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` }))
    : allBranchOptions;

  const canViewStock = hasPermission(user, "Inventory.StockBalance.View");

  // Tracks the header's current branchId/warehouseId (DocumentScreen owns
  // the actual header state - this is just this page's own shadow copy,
  // updated via onHeaderFieldChange) so a line-level lookup like available
  // stock or the duplicate-MR check knows which branch/warehouse to ask
  // about without needing DocumentScreen to expose its whole header object.
  const [currentBranchId, setCurrentBranchId] = useState<string>(singleBranch?.id ?? "");
  const [currentWarehouseId, setCurrentWarehouseId] = useState<string>("");

  function effectiveWarehouseId(): string {
    if (currentWarehouseId) return currentWarehouseId;
    const branch = myBranches?.find((b) => b.id === currentBranchId);
    return branch?.defaultWarehouseId ?? "";
  }

  function fetchAvailableQty(itemId: string) {
    if (!canViewStock || !itemId) return;
    const warehouseId = effectiveWarehouseId();
    if (!warehouseId) return;
    const key = `${warehouseId}:${itemId}`;
    if (key in availableQtyByKey) return;
    api
      .get<ListResponse<any>>(`/api/inventory/stock-balances?itemId=${itemId}&warehouseId=${warehouseId}`)
      .then((res) => {
        const total = res.data.reduce((sum, b) => sum + Number(b.quantity ?? 0), 0);
        setAvailableQtyByKey((prev) => ({ ...prev, [key]: total }));
      })
      .catch(() => {
        // No permission, no stock module set up yet, or a transient error -
        // either way this is a nice-to-have, so fail quietly and just leave
        // the Available column blank for this item.
      });
  }

  function checkDuplicate(itemId: string, index: number, excludeId: string | null) {
    if (!itemId || !currentBranchId) return;
    const params = new URLSearchParams({ itemId, branchId: currentBranchId });
    if (excludeId) params.set("excludeId", excludeId);
    api
      .get<{ data: any[] }>(`/api/procurement/material-requests/check-duplicate?${params}`)
      .then((res) => {
        if (res.data.length === 0) {
          setLineWarnings((prev) => {
            if (!(index in prev)) return prev;
            const next = { ...prev };
            delete next[index];
            return next;
          });
          return;
        }
        const first = res.data[0];
        const extra = res.data.length > 1 ? ` (+${res.data.length - 1} more)` : "";
        setLineWarnings((prev) => ({
          ...prev,
          [index]: `Already requested in ${first.mrNo} - ${first.status}, ${first.requestedQty} ${first.uomCode} on ${new Date(first.requestDate).toLocaleDateString()}${extra}`,
        }));
      })
      .catch(() => {});
  }

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
        ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}),
      }}
      onHeaderFieldChange={(key, value) => {
        if (key === "branchId") setCurrentBranchId(value);
        if (key === "warehouseId") setCurrentWarehouseId(value);
      }}
      onLineFieldChange={(index, key, value, _row, editingId) => {
        if (key !== "itemId") return;
        setLineWarnings((prev) => {
          if (!(index in prev)) return prev;
          const next = { ...prev };
          delete next[index];
          return next;
        });
        if (!value) return;
        fetchAvailableQty(value);
        checkDuplicate(value, index, editingId);
      }}
      lineWarnings={lineWarnings}
      searchAccessor={(r) => `${r.mrNo ?? ""} ${r.title ?? ""}`.toLowerCase()}
      searchPlaceholder="Search MR No. or title..."
      filters={[
        { key: "branchId", label: "Branch", type: "select", options: branchOptions, accessor: (r) => r.branchId },
        { key: "priority", label: "Priority", type: "select", options: PRIORITIES.map((p) => ({ value: p, label: p })), accessor: (r) => r.priority },
      ]}
      dateRangeFilter={{ key: "requestDate", label: "Transaction date" }}
      listColumns={[
        { key: "mrNo", label: "MR No." },
        { key: "title", label: "Title" },
        { key: "requestType", label: "Type" },
        { key: "priority", label: "Priority", render: (r) => <PriorityBadge priority={r.priority ?? "Normal"} /> },
        { key: "branch", label: "Branch", render: (r) => (r.branch ? `${r.branch.code} - ${r.branch.name}` : "-") },
        { key: "requestDate", label: "Date", render: (r) => (r.requestDate ? new Date(r.requestDate).toLocaleDateString() : "-") },
        { key: "requester", label: "Created by", render: (r) => r.requester?.displayName ?? "-" },
        { key: "lines", label: "Lines", render: (r) => r.lines?.length ?? 0 },
        { key: "status", label: "Status" },
      ]}
      headerFields={[
        {
          key: "companyId",
          label: "Company",
          type: "select",
          required: true,
          options: companyOptions,
          disabled: !!scopedCompanyId,
          section: "Transaction Details",
        },
        {
          key: "branchId",
          label: "Branch",
          type: "select",
          required: true,
          options: branchOptions,
          disabled: !!singleBranch,
          section: "Transaction Details",
        },
        { key: "warehouseId", label: "Warehouse (optional)", type: "select", options: warehouseOptions, section: "Transaction Details" },
        { key: "requestDate", label: "Transaction date", type: "date", required: true, section: "Transaction Details" },
        { key: "title", label: "MR title", type: "text", required: true, placeholder: "Shown on every RFQ/PO/GRN raised from this MR", section: "Request Details" },
        {
          key: "requestType",
          label: "Request type",
          type: "select",
          options: [
            { value: "Material", label: "Material Request" },
            { value: "Service", label: "Service Request" },
          ],
          section: "Request Details",
        },
        { key: "priority", label: "Priority", type: "select", options: PRIORITIES.map((p) => ({ value: p, label: p })), section: "Request Details" },
        {
          key: "sourceType",
          label: "Source type (optional)",
          type: "select",
          options: SOURCE_TYPES.map((s) => ({ value: s, label: s })),
          section: "Request Details",
        },
        { key: "requiredDate", label: "Requested by date (optional)", type: "date", section: "Schedule & Validity" },
        {
          key: "validityDate",
          label: "Valid until (optional)",
          type: "date",
          placeholder: "After this date it drops out of Consolidation/RFQ/PO",
          section: "Schedule & Validity",
        },
        { key: "notes", label: "Remark", type: "textarea", placeholder: "Optional notes for whoever reviews or actions this MR", section: "Notes" },
      ]}
      lineFields={[
        { key: "itemId", label: "Item", type: "select", required: true, options: itemOptions },
        { key: "baseUomDisplay", label: "Base UOM", type: "readonly", computed: (row) => itemsIndex[row.itemId]?.baseUomCode || "-" },
        {
          key: "requestedQty",
          label: "Qty",
          type: "number",
          required: true,
          compact: true,
        },
        {
          key: "uomId",
          label: "Unit",
          type: "select",
          required: true,
          options: uomOptions,
          compact: true,
          optionsForRow: (row) => (row.itemId ? uomOptionsForItem(row.itemId) : uomOptions),
        },
        {
          key: "totalBaseQtyDisplay",
          label: "Total (base unit)",
          type: "readonly",
          computed: (row) => {
            const baseUomId = itemsIndex[row.itemId]?.baseUomId;
            const qty = Number(row.requestedQty);
            if (!row.itemId || !baseUomId || !row.uomId || !qty) return "-";
            const total = resolveQtyClient(allConversions, { itemId: row.itemId, fromUomId: row.uomId, toUomId: baseUomId, qty });
            return total != null ? `${total} ${itemsIndex[row.itemId]?.baseUomCode ?? ""}` : "-";
          },
        },
        ...(canViewStock
          ? [
              {
                key: "availableQtyDisplay",
                label: "Available",
                type: "readonly" as const,
                computed: (row: Record<string, any>) => {
                  if (!row.itemId) return "-";
                  const warehouseId = effectiveWarehouseId();
                  if (!warehouseId) return "select a branch";
                  const key = `${warehouseId}:${row.itemId}`;
                  const qty = availableQtyByKey[key];
                  return qty === undefined ? "..." : qty === null ? "-" : `${qty} ${itemsIndex[row.itemId]?.baseUomCode ?? ""}`;
                },
              },
            ]
          : []),
        { key: "remark", label: "Remark (optional)", type: "text", placeholder: "Note on this line" },
      ]}
      emptyLine={{ itemId: "", requestedQty: "", uomId: "", remark: "" }}
      lifecycle={[
        { fromStatus: "Draft", action: "submit", label: "Submit for Approval" },
        { fromStatus: "Submitted", action: "approve", label: "Approve", confirmMessage: "Approve this material request as requested?" },
      ]}
      statusFlow={["Draft", "Submitted", "Approved"]}
      attachmentsModuleCode="Procurement.MaterialRequest"
      convertActions={[
        {
          label: "Create Purchase Order",
          fromStatuses: ["Approved"],
          onClick: (rec) => navigate("/procurement/purchase-orders", { state: { mrId: rec.id } }),
        },
      ]}
    />
  );
}
