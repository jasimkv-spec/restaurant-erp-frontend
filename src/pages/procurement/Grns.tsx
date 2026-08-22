import { useEffect, useState } from "react";
import { DocumentScreen } from "../../components/DocumentScreen";
import { SearchableSelect } from "../../components/SearchableSelect";
import { useOptions } from "../../lib/useOptions";
import { useAuth } from "../../context/AuthContext";
import { api, type ListResponse } from "../../lib/apiClient";

interface ItemIndexEntry {
  baseUomCode: string;
}

interface AvailablePo {
  id: string;
  poNo: string;
  vendorId: string;
  branchId: string;
  vendorName: string;
  poDate: string;
  status: string;
}

/**
 * Panel offering to recall a whole PO's outstanding lines into this GRN
 * ("Recall from PO" - same whole-document-pull pattern as PurchaseOrders.tsx's
 * "Recall from Material Request" panel). Unlike that one, a PO can be
 * received against more than once (Partially Received), so it isn't removed
 * from the pool the moment it's used - only once every line is fully
 * received does the PO stop being offered (server already tracks this via
 * its own status field). Only lines with a positive pending quantity
 * (ordered minus everything already received so far, across every GRN
 * raised against this PO - see GET /purchase-orders/:id) are pulled in.
 */
function PoPoolPanel({
  header,
  addLines,
  setHeaderFields,
}: {
  header: Record<string, any>;
  addLines: (rows: Record<string, any>[]) => void;
  setHeaderFields: (patch: Record<string, any>) => void;
}) {
  const [pool, setPool] = useState<AvailablePo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPoId, setSelectedPoId] = useState("");
  const [recalling, setRecalling] = useState(false);
  const [lastRecalled, setLastRecalled] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get<ListResponse<any>>("/api/procurement/purchase-orders?pageSize=200")
      .then((res) => {
        const eligible = res.data
          .filter((po) => po.status === "Approved" || po.status === "Partially Received")
          .map((po) => ({
            id: po.id,
            poNo: po.poNo,
            vendorId: po.vendorId,
            branchId: po.branchId,
            vendorName: po.vendor ? `${po.vendor.code} - ${po.vendor.name}` : "-",
            poDate: po.poDate,
            status: po.status,
          }));
        setPool(eligible);
      })
      .finally(() => setLoading(false));
  }, []);

  const poOptions = pool.map((po) => ({
    value: po.id,
    label: `${po.poNo} - ${po.vendorName} (${po.status}, ${new Date(po.poDate).toLocaleDateString()})`,
  }));

  async function recallSelected(poId: string) {
    if (!poId) return;
    setSelectedPoId(poId);
    setError(null);
    setRecalling(true);
    try {
      const po = await api.get<any>(`/api/procurement/purchase-orders/${poId}`);
      const rows = (po.lines ?? [])
        .map((line: any) => {
          const pending = Number(line.qty) - Number(line.receivedQty ?? 0);
          return { line, pending };
        })
        .filter((x: any) => x.pending > 1e-6)
        .map((x: any) => ({
          poLineId: x.line.id,
          itemId: x.line.itemId,
          receivedQty: x.pending,
          acceptedQty: x.pending,
          rejectedQty: 0,
          batchNo: "",
          expiryDate: "",
          unitCost: x.line.unitPrice,
        }));

      if (rows.length === 0) {
        setError(`${po.poNo} has nothing left to receive - every line is already fully received.`);
        setRecalling(false);
        return;
      }

      addLines(rows);
      setHeaderFields({ poId: po.id, vendorId: po.vendorId, branchId: po.branchId });
      setLastRecalled(po.poNo);
      setSelectedPoId("");
    } catch (err) {
      setError("Could not load that purchase order's lines - please try again.");
    } finally {
      setRecalling(false);
    }
  }

  return (
    <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-sm">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Recall from Purchase Order</div>
      {loading ? (
        <div className="py-2 text-sm text-gray-400">Loading approved purchase orders...</div>
      ) : (
        <>
          <SearchableSelect
            options={poOptions}
            value={selectedPoId}
            onChange={recallSelected}
            placeholder={poOptions.length ? "Type a PO number, or click to browse..." : "No Approved/Partially Received POs available"}
            disabled={recalling || poOptions.length === 0}
            className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
          />
          <p className="mt-1.5 text-[11px] text-gray-500">
            Selecting a PO pulls in every line still pending receipt (already-received quantity is excluded), and sets the
            vendor/branch above to match. Add, remove, or adjust lines afterward as needed - a partially received PO can be
            recalled again later for its remaining balance.
          </p>
          {lastRecalled && !error && (
            <p className="mt-1 text-[11px] font-medium text-emerald-700">Pulled outstanding lines from {lastRecalled}.</p>
          )}
          {error && <p className="mt-1 text-[11px] font-medium text-red-600">{error}</p>}
        </>
      )}
    </div>
  );
}

/**
 * Goods Receipt Note - records what actually arrived from a vendor (against
 * a PO, or received directly with no PO reference), how much of it was
 * accepted vs. rejected on inspection, and posts stock + a provisional GL
 * accrual once confirmed. A single "Post" step (no separate Submit/Approve)
 * since receiving goods is a one-shot confirmation, not a multi-stage
 * request - but posting is still gated by the same manager-chain approval
 * rule as Material Requests and Purchase Orders (see assertCanApprove).
 */
export default function Grns() {
  const { user, activeCompanyScope } = useAuth();
  const allCompanyOptions = useOptions("/api/admin/companies", (c) => `${c.code} - ${c.name}`);
  const allBranchOptions = useOptions("/api/admin/branches", (b) => `${b.code} - ${b.name}`);
  const allWarehouseOptions = useOptions("/api/admin/warehouses", (w) => `${w.code} - ${w.name}`);
  const vendorOptions = useOptions("/api/procurement/vendors", (v) => `${v.code} - ${v.name}`);
  const itemOptions = useOptions("/api/inventory/items", (i) => `${i.code} - ${i.name}`, "forPurchase=true");

  const [itemsIndex, setItemsIndex] = useState<Record<string, ItemIndexEntry>>({});
  const [warehouseBranchById, setWarehouseBranchById] = useState<Record<string, string>>({});
  // Tracked from onHeaderFieldChange below so the Warehouse dropdown can be
  // narrowed to the currently-picked Branch's own warehouses (client-side,
  // same convention MrPoolPanel uses for branch-scoped filtering - no
  // dedicated backend query param needed).
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  useEffect(() => {
    api.get<ListResponse<any>>("/api/inventory/items?pageSize=500").then((res) => {
      setItemsIndex(Object.fromEntries(res.data.map((i) => [i.id, { baseUomCode: i.baseUom?.code ?? "" }])));
    });
    api.get<ListResponse<any>>("/api/admin/warehouses?pageSize=200").then((res) => {
      setWarehouseBranchById(Object.fromEntries(res.data.map((w) => [w.id, w.branchId])));
    });
  }, []);

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

  const warehouseOptions = selectedBranchId
    ? allWarehouseOptions.filter((w) => warehouseBranchById[w.value] === selectedBranchId)
    : allWarehouseOptions;

  return (
    <DocumentScreen
      title="Goods Receipt (GRN)"
      description="Records what actually arrived from a vendor - against a Purchase Order, or received directly - and how much of it was accepted vs. rejected. Posting updates stock and books a provisional accrual to Finance."
      basePath="/api/procurement/grns"
      createDefaults={{
        grnDate: today,
        ...(singleBranch ? { branchId: singleBranch.id, warehouseId: singleBranch.defaultWarehouseId ?? "" } : {}),
        ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}),
      }}
      onHeaderFieldChange={(key, value, header) => {
        if (key === "branchId") {
          setSelectedBranchId(value ?? "");
          // Default to that branch's own warehouse, still editable afterward -
          // same convenience as PurchaseOrders' vendor->currency auto-fill.
          const branch = myBranches?.find((b) => b.id === value);
          if (branch?.defaultWarehouseId) return { warehouseId: branch.defaultWarehouseId };
        }
      }}
      searchAccessor={(r) => `${r.grnNo ?? ""} ${r.vendor?.code ?? ""} ${r.vendor?.name ?? ""}`.toLowerCase()}
      searchPlaceholder="Search GRN No. or vendor..."
      filters={[
        { key: "vendorId", label: "Vendor", type: "select", options: vendorOptions, accessor: (r) => r.vendorId },
        { key: "branchId", label: "Branch", type: "select", options: branchOptions, accessor: (r) => r.branchId },
      ]}
      dateRangeFilter={{ key: "grnDate", label: "Transaction date" }}
      listColumns={[
        { key: "grnNo", label: "GRN No." },
        { key: "vendor", label: "Vendor", render: (r) => (r.vendor ? `${r.vendor.code} - ${r.vendor.name}` : "-") },
        { key: "branch", label: "Branch", render: (r) => (r.branch ? `${r.branch.code} - ${r.branch.name}` : "-") },
        { key: "warehouse", label: "Warehouse", render: (r) => r.warehouse?.name ?? "-" },
        { key: "grnDate", label: "Date", render: (r) => (r.grnDate ? new Date(r.grnDate).toLocaleDateString() : "-") },
        { key: "lines", label: "Lines", render: (r) => r.lines?.length ?? 0 },
        { key: "createdBy", label: "Created by", render: (r) => r.createdBy?.displayName ?? "-" },
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
        {
          key: "warehouseId",
          label: "Warehouse",
          type: "select",
          required: true,
          options: warehouseOptions,
          section: "Transaction Details",
        },
        { key: "grnDate", label: "Receipt Date", type: "date", required: true, section: "Transaction Details" },
        { key: "vendorId", label: "Vendor", type: "select", required: true, options: vendorOptions, section: "Vendor" },
        // Set by the Recall-from-PO panel below, not directly editable -
        // carries the link through to the saved payload without its own
        // form input (see DocFieldConfig.hidden).
        { key: "poId", label: "Purchase Order", type: "text", hidden: true },
      ]}
      linesExtra={({ header, addLines, setHeaderFields }) => (
        <PoPoolPanel header={header} addLines={addLines} setHeaderFields={setHeaderFields} />
      )}
      lineFields={[
        { key: "itemId", label: "Item", type: "select", required: true, options: itemOptions },
        { key: "baseUomDisplay", label: "Base UOM", type: "readonly", computed: (row) => itemsIndex[row.itemId]?.baseUomCode || "-" },
        { key: "receivedQty", label: "Received Qty", type: "number", required: true, compact: true },
        { key: "acceptedQty", label: "Accepted Qty", type: "number", required: true, compact: true },
        { key: "rejectedQty", label: "Rejected Qty", type: "number", compact: true },
        { key: "batchNo", label: "Batch No.", type: "text", compact: true },
        { key: "expiryDate", label: "Expiry Date", type: "date", compact: true },
        { key: "unitCost", label: "Unit Cost", type: "number", compact: true },
        // Carries the PO line link through to the save when recalled from a
        // PO - no grid column of its own (see DocFieldConfig.hidden).
        { key: "poLineId", label: "PO Line", type: "text", hidden: true },
      ]}
      emptyLine={{
        itemId: "",
        receivedQty: "",
        acceptedQty: "",
        rejectedQty: "0",
        batchNo: "",
        expiryDate: "",
        unitCost: "",
      }}
      lineWarnings={undefined}
      lifecycle={[
        {
          fromStatus: "Draft",
          action: "post",
          label: "Post GRN",
          confirmMessage: "Post this GRN? This updates stock and books the accrual - it cannot be undone.",
        },
      ]}
      statusFlow={["Draft", "Posted"]}
      attachmentsModuleCode="Procurement.Grn"
    />
  );
}
