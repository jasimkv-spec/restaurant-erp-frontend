import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { DocumentScreen } from "../../components/DocumentScreen";
import { SearchableSelect } from "../../components/SearchableSelect";
import { useOptions } from "../../lib/useOptions";
import { useAuth } from "../../context/AuthContext";
import { api, type ListResponse } from "../../lib/apiClient";

interface ItemIndexEntry {
  baseUomCode: string;
}

interface AdditionalCostRow {
  costTypeId: string;
  amount: number | "";
  remark: string;
}

/**
 * A GRN line's monetary value, for display and for the PO-comparison
 * summary panel below - never what actually gets posted to stock/GL (that
 * stays acceptedQty x unitCost, pre-tax - see /grns/:id/post). Three cases,
 * checked in order: a saved line already carries the backend's own
 * authoritative `lineTotal` (tax/discount-inclusive when tied to a PO - see
 * GrnLine.lineTotal's doc comment in schema.prisma); a line still being
 * edited after a PO recall carries `poUnitValue` (that PO line's per-unit
 * value) instead, so the figure stays accurate as the qty is adjusted before
 * saving; anything else (a manually added line, no PO reference) falls back
 * to plain acceptedQty x unitCost, matching the backend's own no-PO formula.
 *
 * `lineTotal` defaults to 0 on the database column (added after this app had
 * already been live for a while), so a line saved before this feature
 * existed carries a real, but meaningless, stored 0 - checking `> 0` rather
 * than just "is it set" means those older GRNs still fall through to the
 * acceptedQty x unitCost estimate instead of wrongly showing zero.
 */
function grnLineAmount(row: Record<string, any>): number {
  if (row.lineTotal != null && Number(row.lineTotal) > 0) return Number(row.lineTotal);
  if (row.poUnitValue != null) return Number(row.acceptedQty || 0) * Number(row.poUnitValue);
  return Number(row.acceptedQty || 0) * Number(row.unitCost || 0);
}

/**
 * Freight/Insurance/Handling lines added to this GRN's own amount - saved
 * separately from the goods lines (GrnAdditionalCost, not GrnLine), so a
 * cost-only GRN (no items, just a freight invoice) is possible too. Stored
 * as a hidden "additionalCosts" header field (see DocumentScreen's `hidden`
 * flag) since DocumentScreen's own line grid is shaped for item rows, not
 * this - the value here is a plain array, passed straight through to the
 * save payload untouched.
 *
 * Kept as its own local rows[] state (rather than writing straight into the
 * header on every keystroke) so a row can sit half-filled while the user is
 * still typing - only rows with both a cost type AND a positive amount are
 * ever synced up into header.additionalCosts, which is what actually gets
 * saved.
 */
function AdditionalCostsPanel({
  header,
  setHeaderFields,
  costTypeOptions,
}: {
  header: Record<string, any>;
  setHeaderFields: (patch: Record<string, any>) => void;
  costTypeOptions: { value: string; label: string }[];
}) {
  const [rows, setRows] = useState<AdditionalCostRow[]>(
    header.additionalCosts?.length ? header.additionalCosts : []
  );

  useEffect(() => {
    const valid = rows
      .filter((r) => r.costTypeId && Number(r.amount) > 0)
      .map((r) => ({ costTypeId: r.costTypeId, amount: Number(r.amount), remark: r.remark || undefined }));
    setHeaderFields({ additionalCosts: valid });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  function update(index: number, patch: Partial<AdditionalCostRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { costTypeId: "", amount: "", remark: "" }]);
  }
  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return (
    <div className="mb-5 rounded-xl border border-amber-100 bg-amber-50/40 p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
          Additional Costs (Transportation, Insurance, Handling, ...)
        </div>
        <button
          type="button"
          onClick={addRow}
          className="rounded-md border border-amber-300 bg-white px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
        >
          + Add cost
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-[11px] text-gray-500">
          None yet - add freight, insurance, or handling costs here to include them in this GRN's own amount.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={row.costTypeId}
                onChange={(e) => update(i, { costTypeId: e.target.value })}
                className="w-52 rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
              >
                <option value="">Select cost type...</option>
                {costTypeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={row.amount}
                onChange={(e) => update(i, { amount: e.target.value === "" ? "" : Number(e.target.value) })}
                placeholder="Amount"
                className="w-28 rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
              />
              <input
                type="text"
                value={row.remark}
                onChange={(e) => update(i, { remark: e.target.value })}
                placeholder="Remark (optional)"
                className="flex-1 rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="px-1 text-sm text-red-500 hover:text-red-700"
                aria-label="Remove cost line"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {total > 0 && <p className="mt-2 text-[11px] font-medium text-amber-700">Additional costs total: {total.toFixed(2)}</p>}
    </div>
  );
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
  autoRecallId,
  onAutoRecallHandled,
  onPoLoaded,
}: {
  header: Record<string, any>;
  addLines: (rows: Record<string, any>[]) => void;
  setHeaderFields: (patch: Record<string, any>) => void;
  /** Auto-pull this one PO in as soon as the pool has loaded - set when this screen was opened via a PO detail view's "Create GRN" button (see PurchaseOrders.tsx's convertActions). Falls back to a normal manual pick if the id isn't (or is no longer) Approved/Partially Received. */
  autoRecallId?: string;
  /** Fires once the auto-recall attempt above has resolved - lets the parent screen clear its own seed id, so a later manual "+ New" (a freshly-mounted panel instance) doesn't repeat the same auto-pull. */
  onAutoRecallHandled?: () => void;
  /** Fires with the full PO record once it's been fetched to recall its lines - lets the parent screen show a live "PO Amount vs. This GRN's Amount" comparison (see Grns()'s own `summary` prop) without a second fetch. */
  onPoLoaded?: (po: any) => void;
}) {
  const [pool, setPool] = useState<AvailablePo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPoId, setSelectedPoId] = useState("");
  const [recalling, setRecalling] = useState(false);
  const [lastRecalled, setLastRecalled] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoFired, setAutoFired] = useState(false);

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

  useEffect(() => {
    if (loading || !autoRecallId || autoFired) return;
    setAutoFired(true);
    onAutoRecallHandled?.();
    if (pool.some((po) => po.id === autoRecallId)) {
      recallSelected(autoRecallId);
    } else {
      setError("This purchase order isn't available to receive against anymore - it may already be fully received, or no longer Approved.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, autoRecallId, autoFired]);

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
          // This PO line's own tax/discount-inclusive value, per unit of its
          // ordered qty - baked on here (not a declared lineField, so never
          // sent to the server) purely so the Amount column below can show
          // a live, edit-aware preview (acceptedQty x poUnitValue) while
          // this form is still being filled in. The backend recomputes and
          // stores the authoritative per-line lineTotal itself on save
          // using the exact same math (see GrnLine.lineTotal's own doc
          // comment in schema.prisma) - this is display-only.
          poUnitValue: Number(x.line.qty) > 0 ? Number(x.line.lineTotal) / Number(x.line.qty) : 0,
        }));

      if (rows.length === 0) {
        setError(`${po.poNo} has nothing left to receive - every line is already fully received.`);
        setRecalling(false);
        return;
      }

      addLines(rows);
      setHeaderFields({ poId: po.id, vendorId: po.vendorId, branchId: po.branchId });
      onPoLoaded?.(po);
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
  const navigate = useNavigate();
  const location = useLocation();
  // Set when this screen was opened via an Approved/Partially Received PO's
  // "Create GRN" button (see PurchaseOrders.tsx's convertActions) - pulls
  // that one PO's outstanding lines straight into a fresh form (see
  // PoPoolPanel's autoRecallId handling below).
  const [seedPoId, setSeedPoId] = useState<string | undefined>((location.state as any)?.poId);
  // The full PO record, fetched once by PoPoolPanel when its lines get
  // recalled into this form - used only to show a live "PO Amount vs. This
  // GRN's Amount" comparison while creating (see the `summary` prop below).
  // Guarded there by header.poId === recalledPo.id so a stale value from a
  // cancelled/earlier create never gets shown against an unrelated one.
  const [recalledPo, setRecalledPo] = useState<any | null>(null);
  // Drives the "Close PO / Keep PO Open" prompt shown when posting a GRN
  // that only partially receives its linked PO (see the lifecycle post
  // step's onConflict below) - window.confirm can't relabel its own OK/
  // Cancel buttons, so this is a small custom modal instead. `resolve` is
  // the pending lifecycle action's own promise callback; setting it back to
  // null both closes the modal and (via onConflict awaiting that promise)
  // lets the post request actually fire with the chosen disposition.
  const [poDecisionPrompt, setPoDecisionPrompt] = useState<{
    poNo?: string;
    resolve: (choice: "close" | "keep-open") => void;
  } | null>(null);
  const { user, activeCompanyScope } = useAuth();
  const allCompanyOptions = useOptions("/api/admin/companies", (c) => `${c.code} - ${c.name}`);
  const allBranchOptions = useOptions("/api/admin/branches", (b) => `${b.code} - ${b.name}`);
  const allWarehouseOptions = useOptions("/api/admin/warehouses", (w) => `${w.code} - ${w.name}`);
  const vendorOptions = useOptions("/api/procurement/vendors", (v) => `${v.code} - ${v.name}`);
  const itemOptions = useOptions("/api/inventory/items", (i) => `${i.code} - ${i.name}`, "forPurchase=true");
  const costTypeOptions = useOptions("/api/procurement/additional-cost-types", (t) => `${t.code} - ${t.name}`);

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
    <>
    <DocumentScreen
      title="Goods Receipt (GRN)"
      description="Records what actually arrived from a vendor - against a Purchase Order, or received directly - and how much of it was accepted vs. rejected. Posting updates stock and books a provisional accrual to Finance."
      basePath="/api/procurement/grns"
      createDefaults={{
        grnDate: today,
        additionalCosts: [],
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
      searchAccessor={(r) => `${r.grnNo ?? ""} ${r.vendorRefNo ?? ""} ${r.vendor?.code ?? ""} ${r.vendor?.name ?? ""}`.toLowerCase()}
      searchPlaceholder="Search GRN No. or vendor..."
      filters={[
        { key: "vendorId", label: "Vendor", type: "select", options: vendorOptions, accessor: (r) => r.vendorId },
        { key: "branchId", label: "Branch", type: "select", options: branchOptions, accessor: (r) => r.branchId },
      ]}
      dateRangeFilter={{ key: "grnDate", label: "Transaction date" }}
      listColumns={[
        { key: "grnNo", label: "GRN No." },
        { key: "vendorRefNo", label: "Vendor DO / Invoice No.", render: (r) => r.vendorRefNo || "-" },
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
        {
          key: "vendorRefNo",
          label: "Vendor DO / Invoice No.",
          type: "text",
          placeholder: "e.g. this delivery's DO or invoice number",
          section: "Vendor",
        },
        // Set by the Recall-from-PO panel below, not directly editable -
        // carries the link through to the saved payload without its own
        // form input (see DocFieldConfig.hidden).
        { key: "poId", label: "Purchase Order", type: "text", hidden: true },
        // Set by the Additional Costs panel below - a plain array, carried
        // straight through to the saved payload (see DocFieldConfig.hidden).
        { key: "additionalCosts", label: "Additional Costs", type: "text", hidden: true },
      ]}
      autoOpenCreate={!!seedPoId}
      linesExtra={({ header, addLines, setHeaderFields }) => (
        <>
          <div className="mb-5 rounded-xl border border-sky-100 bg-sky-50/50 p-3 text-[12px] text-sky-800 shadow-sm">
            Recording the supplier's own invoice (invoice no., invoice date, received date, amount)? That's done on
            the{" "}
            <Link to="/procurement/purchase-invoices" className="font-semibold underline hover:text-sky-900">
              Purchase Invoices
            </Link>{" "}
            screen, once this GRN is Posted - not here. This GRN only records what physically arrived.
          </div>
          <PoPoolPanel
            header={header}
            addLines={addLines}
            setHeaderFields={setHeaderFields}
            autoRecallId={seedPoId}
            onAutoRecallHandled={() => setSeedPoId(undefined)}
            onPoLoaded={setRecalledPo}
          />
          <AdditionalCostsPanel header={header} setHeaderFields={setHeaderFields} costTypeOptions={costTypeOptions} />
        </>
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
        {
          key: "amountDisplay",
          label: "Amount",
          type: "readonly",
          compact: true,
          computed: (row) => grnLineAmount(row).toFixed(2),
        },
        // Carries the PO line link through to the save when recalled from a
        // PO - no grid column of its own (see DocFieldConfig.hidden).
        { key: "poLineId", label: "PO Line", type: "text", hidden: true },
      ]}
      emptyLine={{
        itemId: "",
        receivedQty: "",
        acceptedQty: "",
        // Must be "" (not "0") - DocumentScreen's addLines() only treats this
        // starter row as replaceable when every field is falsy/blank; a
        // non-empty "0" string made it look "filled in", so recalling a PO
        // appended its lines after this row instead of replacing it, leaving
        // a stray empty line. The backend already defaults rejectedQty to 0
        // when it's omitted (see grnLineSchema), so an empty string here has
        // no effect on what actually gets saved.
        rejectedQty: "",
        batchNo: "",
        expiryDate: "",
        unitCost: "",
      }}
      lineWarnings={undefined}
      summary={({ header, lines }) => {
        const linesValue = lines.reduce((s: number, l: any) => s + grnLineAmount(l), 0);
        const costsValue = (header.additionalCosts ?? []).reduce((s: number, c: any) => s + Number(c.amount), 0);
        const grnTotal = linesValue + costsValue;
        // Detail view: the linked PO is already included on the saved
        // record itself. Still creating: fall back to whichever PO was
        // just recalled (guarded against showing a stale one left over from
        // an earlier, cancelled create - see recalledPo's own comment).
        const linkedPo = header.po ?? (header.poId && recalledPo?.id === header.poId ? recalledPo : null);
        return (
          <div className="mb-5 flex justify-end">
            <div className="w-full space-y-1.5 rounded-xl border border-gray-200 bg-white p-4 text-sm shadow-sm sm:w-80">
              <div className="flex justify-between">
                <span className="text-gray-500">Goods Value</span>
                <span className="font-semibold text-navy-900">{linesValue.toFixed(2)}</span>
              </div>
              {costsValue > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Additional Costs</span>
                  <span className="font-semibold text-navy-900">{costsValue.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-200 pt-1.5 text-base">
                <span className="font-bold text-navy-900">This GRN's Amount</span>
                <span className="font-bold text-brand-700">{grnTotal.toFixed(2)}</span>
              </div>
              {linkedPo && (
                <div className="mt-2 border-t border-gray-100 pt-2 text-[12px] text-gray-500">
                  <div className="flex justify-between">
                    <span>{linkedPo.poNo} Amount</span>
                    <span className="font-semibold text-gray-700">{Number(linkedPo.totalAmount ?? 0).toFixed(2)}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400">
                    Only matches exactly when this GRN covers the whole PO in one go - a partial delivery's own amount will be less.
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      }}
      printSummaryRows={(record) => {
        const linesValue = (record.lines ?? []).reduce((s: number, l: any) => s + grnLineAmount(l), 0);
        const costsValue = (record.additionalCosts ?? []).reduce((s: number, c: any) => s + Number(c.amount), 0);
        const rows: { label: string; value: string; emphasize?: boolean }[] = [
          { label: "Goods Value", value: linesValue.toFixed(2) },
        ];
        if (costsValue > 0) rows.push({ label: "Additional Costs", value: costsValue.toFixed(2) });
        rows.push({ label: "GRN Amount", value: (linesValue + costsValue).toFixed(2), emphasize: true });
        if (record.po) rows.push({ label: `${record.po.poNo} Amount`, value: Number(record.po.totalAmount ?? 0).toFixed(2) });
        return rows;
      }}
      lifecycle={[
        {
          fromStatus: "Draft",
          action: "post",
          label: "Post GRN",
          confirmMessage: "Post this GRN? This updates stock and books the accrual - it cannot be undone.",
          // Fired when the backend reports this GRN would leave its linked
          // PO partially received (409 with requiresPoDecision) - asks the
          // user whether to keep the PO open for the remaining items or
          // close it early, then retries the post with that choice.
          onConflict: async (details) => {
            if (!details?.requiresPoDecision) return null;
            const choice = await new Promise<"close" | "keep-open">((resolve) => {
              setPoDecisionPrompt({ poNo: details.poNo, resolve });
            });
            return { poDisposition: choice };
          },
        },
      ]}
      statusFlow={["Draft", "Posted"]}
      attachmentsModuleCode="Procurement.Grn"
      convertActions={[
        {
          label: "Create Purchase Invoice",
          fromStatuses: ["Posted"],
          onClick: (rec) => navigate("/procurement/purchase-invoices", { state: { grnId: rec.id } }),
        },
      ]}
    />
    {poDecisionPrompt && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <h3 className="text-base font-semibold text-gray-900">Partial receipt against {poDecisionPrompt.poNo ?? "this Purchase Order"}</h3>
          <p className="mt-2 text-sm text-gray-600">
            This GRN doesn't fully receive {poDecisionPrompt.poNo ?? "its linked Purchase Order"}. Do you want to close the
            PO now, or keep it open so more GRNs can be raised against the remaining items later?
          </p>
          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              onClick={() => {
                poDecisionPrompt.resolve("keep-open");
                setPoDecisionPrompt(null);
              }}
            >
              Keep PO Open
            </button>
            <button
              type="button"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              onClick={() => {
                poDecisionPrompt.resolve("close");
                setPoDecisionPrompt(null);
              }}
            >
              Close PO
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
