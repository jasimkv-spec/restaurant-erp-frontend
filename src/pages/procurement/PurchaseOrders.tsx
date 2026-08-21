import { useEffect, useState } from "react";
import { DocumentScreen } from "../../components/DocumentScreen";
import { useOptions } from "../../lib/useOptions";
import { useAuth } from "../../context/AuthContext";
import { api, type ListResponse } from "../../lib/apiClient";

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
 * Purchase Orders. Most POs arrive here already created - from RFQ's
 * "Convert to Purchase Order" once winning quotes are picked - but this
 * screen also supports raising one directly (e.g. a repeat order with a
 * vendor you already have fixed pricing with, no RFQ needed).
 */
export default function PurchaseOrders() {
  const { user, activeCompanyScope } = useAuth();
  const allCompanyOptions = useOptions("/api/admin/companies", (c) => `${c.code} - ${c.name}`);
  const allBranchOptions = useOptions("/api/admin/branches", (b) => `${b.code} - ${b.name}`);
  const vendorOptions = useOptions("/api/procurement/vendors", (v) => `${v.code} - ${v.name}`);
  // Same "Purchase" flag filter as Material Requests - only items actually
  // meant to be bought show up on a PO line.
  const itemOptions = useOptions("/api/inventory/items", (i) => `${i.code} - ${i.name}`, "forPurchase=true");
  const uomOptions = useOptions("/api/masters/uoms", (u) => `${u.code} - ${u.name}`);
  const taxOptions = useOptions("/api/masters/taxes", (t) => `${t.code} - ${t.name} (${Number(t.rate)}%)`);
  const uomLabelById = Object.fromEntries(uomOptions.map((o) => [o.value, o.label.split(" - ")[0]]));

  const [itemsIndex, setItemsIndex] = useState<Record<string, ItemIndexEntry>>({});
  // Every configured packing conversion (item-specific or generic) - same
  // approach as Material Requests, so a PO line's Unit dropdown can offer
  // "Box"/"Carton"/"Dozen" etc. for the item on that specific line, not just
  // its base unit.
  const [allConversions, setAllConversions] = useState<ConversionEntry[]>([]);

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

  const scopedCompanyId = activeCompanyScope && activeCompanyScope !== "GLOBAL" ? activeCompanyScope : null;
  const myCompanies = user?.companies;
  const companyOptions = myCompanies && myCompanies.length > 0
    ? myCompanies.map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }))
    : allCompanyOptions;

  const myBranches = user?.branches?.filter((b) => !scopedCompanyId || b.companyId === scopedCompanyId);
  const singleBranch = myBranches && myBranches.length === 1 ? myBranches[0] : null;
  const branchOptions = myBranches && myBranches.length > 0
    ? myBranches.map((b) => ({ value: b.id, label: `${b.code} - ${b.name}` }))
    : allBranchOptions;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <DocumentScreen
      title="Purchase Orders"
      description="An order placed with a vendor for specific items, quantities and prices. Comes from converting an RFQ's winning quotes, or raised directly for a repeat/known-price order."
      basePath="/api/procurement/purchase-orders"
      createDefaults={{
        poDate: today,
        ...(singleBranch ? { branchId: singleBranch.id } : {}),
        ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}),
      }}
      searchAccessor={(r) => `${r.poNo ?? ""} ${r.vendor?.code ?? ""} ${r.vendor?.name ?? ""}`.toLowerCase()}
      searchPlaceholder="Search PO No. or vendor..."
      filters={[
        { key: "vendorId", label: "Vendor", type: "select", options: vendorOptions, accessor: (r) => r.vendorId },
        { key: "branchId", label: "Branch", type: "select", options: branchOptions, accessor: (r) => r.branchId },
      ]}
      dateRangeFilter={{ key: "poDate", label: "Transaction date" }}
      listColumns={[
        { key: "poNo", label: "PO No." },
        { key: "vendor", label: "Vendor", render: (r) => (r.vendor ? `${r.vendor.code} - ${r.vendor.name}` : "-") },
        { key: "branch", label: "Branch", render: (r) => (r.branch ? `${r.branch.code} - ${r.branch.name}` : "-") },
        { key: "poDate", label: "Date", render: (r) => (r.poDate ? new Date(r.poDate).toLocaleDateString() : "-") },
        { key: "lines", label: "Lines", render: (r) => r.lines?.length ?? 0 },
        { key: "totalAmount", label: "Total", render: (r) => Number(r.totalAmount ?? 0).toFixed(2) },
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
        { key: "poDate", label: "Transaction date", type: "date", required: true, section: "Transaction Details" },
        { key: "vendorId", label: "Vendor", type: "select", required: true, options: vendorOptions, section: "Vendor" },
      ]}
      lineFields={[
        { key: "itemId", label: "Item", type: "select", required: true, options: itemOptions },
        { key: "baseUomDisplay", label: "Base UOM", type: "readonly", computed: (row) => itemsIndex[row.itemId]?.baseUomCode || "-" },
        { key: "qty", label: "Qty", type: "number", required: true, compact: true },
        {
          key: "uomId",
          label: "Unit",
          type: "select",
          required: true,
          options: uomOptions,
          compact: true,
          optionsForRow: (row) => (row.itemId ? uomOptionsForItem(row.itemId) : uomOptions),
        },
        { key: "unitPrice", label: "Unit Price", type: "number", required: true, compact: true },
        { key: "taxId", label: "Tax (optional)", type: "select", options: taxOptions },
        {
          key: "lineTotalDisplay",
          label: "Line Total",
          type: "readonly",
          computed: (row) => {
            const qty = Number(row.qty);
            const price = Number(row.unitPrice);
            if (!qty || !price) return "-";
            return (qty * price).toFixed(2);
          },
        },
      ]}
      emptyLine={{ itemId: "", qty: "", uomId: "", unitPrice: "", taxId: "" }}
      lifecycle={[
        { fromStatus: "Draft", action: "submit", label: "Submit for Approval" },
        { fromStatus: "Submitted", action: "approve", label: "Approve", confirmMessage: "Approve this purchase order?" },
      ]}
      statusFlow={["Draft", "Submitted", "Approved"]}
      attachmentsModuleCode="Procurement.PurchaseOrder"
    />
  );
}
