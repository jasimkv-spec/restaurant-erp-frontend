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

interface VendorIndexEntry {
  currencyId: string | null;
  paymentTermsId: string | null;
}

interface PoPoolRow {
  mrLineId: string;
  mrId: string;
  mrNo: string;
  branchId: string;
  branchName: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  uomId: string;
  uomCode: string;
  qty: number;
}

// Kept short since this renders inside a native <select> - the closed box
// only has room for a few words before the browser clips it. The field's
// own label ("VAT / Exempt") already carries the rest of the context.
const TAX_MODE_OPTIONS = [
  { value: "Vatable", label: "Vatable" },
  { value: "Exempt", label: "Exempt" },
];

const YES_NO = [
  { value: "false", label: "No" },
  { value: "true", label: "Yes" },
];

/**
 * Panel offering to pull lines straight from the Approved MR pool into this
 * PO (task: "Option to retrieve MR from approved MR list for direct PO
 * creation") - rendered above the line grid only while the form is open.
 * Excludes lines already sitting in a live consolidation or already on any
 * PO (server-side, via GET .../po-pool), and additionally hides whatever's
 * already been pulled into *this* form so the same MR line can't be added
 * twice in one go.
 */
function MrPoolPanel({
  header,
  lines,
  addLines,
}: {
  header: Record<string, any>;
  lines: Record<string, any>[];
  addLines: (rows: Record<string, any>[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pool, setPool] = useState<PoPoolRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get<{ data: PoPoolRow[] }>("/api/procurement/material-requests/po-pool")
      .then((res) => setPool(res.data))
      .finally(() => setLoading(false));
  }, [open]);

  const alreadyOnForm = new Set(lines.map((l) => l.sourceMrLineId).filter(Boolean));
  const visiblePool = pool.filter(
    (r) => !alreadyOnForm.has(r.mrLineId) && (!header.branchId || r.branchId === header.branchId)
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addSelected() {
    const rows = visiblePool
      .filter((r) => selected.has(r.mrLineId))
      .map((r) => ({
        itemId: r.itemId,
        qty: r.qty,
        uomId: r.uomId,
        unitPrice: "",
        sourceMrId: r.mrId,
        sourceMrLineId: r.mrLineId,
      }));
    addLines(rows);
    setSelected(new Set());
  }

  return (
    <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left text-[11px] font-semibold uppercase tracking-wide text-emerald-700"
      >
        <span>Pull lines from Approved Material Requests</span>
        <span className="text-emerald-600">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="mt-3">
          {loading ? (
            <div className="py-4 text-center text-sm text-gray-400">Loading approved MR lines...</div>
          ) : visiblePool.length === 0 ? (
            <div className="py-4 text-center text-sm text-gray-400">
              No unassigned Approved MR lines{header.branchId ? " for this branch" : ""}.
            </div>
          ) : (
            <>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-emerald-100 bg-white">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-emerald-50">
                    <tr>
                      <th className="w-8 px-2 py-1.5"></th>
                      <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-emerald-700">MR No.</th>
                      <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-emerald-700">Branch</th>
                      <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-emerald-700">Item</th>
                      <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wide text-emerald-700">Qty</th>
                      <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-emerald-700">UOM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePool.map((r) => (
                      <tr key={r.mrLineId} className="border-t border-emerald-50">
                        <td className="px-2 py-1.5">
                          <input type="checkbox" checked={selected.has(r.mrLineId)} onChange={() => toggle(r.mrLineId)} />
                        </td>
                        <td className="px-2 py-1.5">{r.mrNo}</td>
                        <td className="px-2 py-1.5">{r.branchName}</td>
                        <td className="px-2 py-1.5">
                          {r.itemCode} - {r.itemName}
                        </td>
                        <td className="px-2 py-1.5 text-right">{r.qty}</td>
                        <td className="px-2 py-1.5">{r.uomCode}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={addSelected}
                disabled={selected.size === 0}
                className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                Add {selected.size > 0 ? `${selected.size} selected` : "selected"} line{selected.size === 1 ? "" : "s"}
              </button>
              <p className="mt-1.5 text-[11px] text-gray-500">
                Unit price isn't carried over from the MR - fill it in on each added line before saving.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Purchase Orders. Most POs arrive here already created - from RFQ's
 * "Convert to Purchase Order" once winning quotes are picked - but this
 * screen also supports raising one directly (e.g. a repeat order with a
 * vendor you already have fixed pricing with, no RFQ needed, or pulling
 * lines straight out of the Approved MR pool via the panel above the grid).
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
  const currencyOptions = useOptions("/api/masters/currencies", (c) => `${c.code} - ${c.name}`);
  const paymentTermsOptions = useOptions("/api/masters/terms", (t) => `${t.code} - ${t.name} (${t.days}d)`);
  const shipmentTypeOptions = useOptions("/api/masters/shipment-types", (s) => `${s.code} - ${s.name}`);
  const uomLabelById = Object.fromEntries(uomOptions.map((o) => [o.value, o.label.split(" - ")[0]]));

  const [itemsIndex, setItemsIndex] = useState<Record<string, ItemIndexEntry>>({});
  // Every configured packing conversion (item-specific or generic) - same
  // approach as Material Requests, so a PO line's Unit dropdown can offer
  // "Box"/"Carton"/"Dozen" etc. for the item on that specific line, not just
  // its base unit.
  const [allConversions, setAllConversions] = useState<ConversionEntry[]>([]);
  const [vendorIndex, setVendorIndex] = useState<Record<string, VendorIndexEntry>>({});
  const [currencyRateById, setCurrencyRateById] = useState<Record<string, number>>({});
  const [taxRateById, setTaxRateById] = useState<Record<string, number>>({});

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
    api.get<ListResponse<any>>("/api/procurement/vendors?pageSize=500").then((res) => {
      setVendorIndex(
        Object.fromEntries(
          res.data.map((v) => [v.id, { currencyId: v.currencyId ?? null, paymentTermsId: v.paymentTermsId ?? null }])
        )
      );
    });
    api.get<ListResponse<any>>("/api/masters/currencies?pageSize=200").then((res) => {
      setCurrencyRateById(Object.fromEntries(res.data.map((c) => [c.id, Number(c.exchangeRate ?? 1)])));
    });
    api.get<ListResponse<any>>("/api/masters/taxes?pageSize=200").then((res) => {
      setTaxRateById(Object.fromEntries(res.data.map((t) => [t.id, Number(t.rate ?? 0)])));
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

  function isFocRow(row: Record<string, any>): boolean {
    return row.isFocLine === "true" || row.isFocLine === true;
  }

  // Preview-only math mirroring poCalc.ts's per-line logic (gross -> less
  // line discount -> tax on what's left), so the user can see roughly what
  // they'll get back after saving. Deliberately does NOT prorate the header
  // discount across lines here (that needs every line's numbers at once,
  // not just this one row) - the real, header-discount-aware figures come
  // back from the server once the document is saved.
  function lineNet(row: Record<string, any>): number {
    const gross = isFocRow(row) ? 0 : (Number(row.qty) || 0) * (Number(row.unitPrice) || 0);
    const discAmt = row.discountAmount !== "" && row.discountAmount != null
      ? Number(row.discountAmount)
      : row.discountPct
        ? (gross * Number(row.discountPct)) / 100
        : 0;
    return Math.max(0, gross - discAmt);
  }

  function lineTaxPreview(row: Record<string, any>): number {
    const net = lineNet(row);
    const rate = row.taxId ? taxRateById[row.taxId] ?? 0 : 0;
    return (net * rate) / 100;
  }

  // This line's proportional share of the header-level discount (allocated
  // by its share of the pre-header-discount subtotal) - the figure the user
  // asked to see at line level so it can feed GRN/ledger costing later.
  // Mirrors poCalc.ts's own math exactly, using the live rows/header passed
  // in via DocFieldConfig.computed's context so it's accurate while still
  // editing, not just after the PO is saved. Falls back to the persisted
  // headerDiscountShare (from the server) if no live context is given.
  function lineHeaderDiscountShare(row: Record<string, any>, ctx?: { rows: Record<string, any>[]; header: Record<string, any> }): number {
    if (!ctx) return Number(row.headerDiscountShare) || 0;
    const { rows, header } = ctx;
    const subtotal = rows.reduce((sum, r) => sum + lineNet(r), 0);
    const headerDiscAmt = header.discountAmount !== "" && header.discountAmount != null
      ? Number(header.discountAmount)
      : header.discountPct
        ? (subtotal * Number(header.discountPct)) / 100
        : 0;
    const net = lineNet(row);
    return subtotal > 0 ? (net / subtotal) * headerDiscAmt : 0;
  }

  // Full totals - unlike lineNet/lineTaxPreview above (deliberately simple,
  // per-line-only previews for the grid's own Tax Amt/Line Total columns),
  // this mirrors poCalc.ts's complete order of operations including the
  // header discount's proration across every line, so the summary panel's
  // numbers actually match what the server will (or already did) compute.
  function computePoTotals(rows: Record<string, any>[], header: Record<string, any>) {
    const grossByLine = rows.map((r) => {
      const isFoc = r.isFocLine === "true" || r.isFocLine === true;
      return isFoc ? 0 : (Number(r.qty) || 0) * (Number(r.unitPrice) || 0);
    });
    const grossTotal = grossByLine.reduce((sum, g) => sum + g, 0);

    const netByLine = rows.map((r, i) => {
      const discAmt = r.discountAmount !== "" && r.discountAmount != null
        ? Number(r.discountAmount)
        : r.discountPct
          ? (grossByLine[i] * Number(r.discountPct)) / 100
          : 0;
      return Math.max(0, grossByLine[i] - discAmt);
    });
    const subtotal = netByLine.reduce((sum, n) => sum + n, 0);

    const headerDiscAmt = header.discountAmount !== "" && header.discountAmount != null
      ? Number(header.discountAmount)
      : header.discountPct
        ? (subtotal * Number(header.discountPct)) / 100
        : 0;

    let taxTotal = 0;
    let grandTotal = 0;
    rows.forEach((r, i) => {
      const net = netByLine[i];
      const headerShare = subtotal > 0 ? (net / subtotal) * headerDiscAmt : 0;
      const taxable = Math.max(0, net - headerShare);
      const rate = r.taxId ? taxRateById[r.taxId] ?? 0 : 0;
      const taxAmt = header.taxMode === "Exempt" ? 0 : (taxable * rate) / 100;
      taxTotal += taxAmt;
      grandTotal += taxable + taxAmt;
    });

    return {
      grossTotal,
      discountTotal: grossTotal - subtotal + headerDiscAmt,
      taxTotal,
      grandTotal,
    };
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
      description="An order placed with a vendor for specific items, quantities and prices. Comes from converting an RFQ's winning quotes, raised directly for a repeat/known-price order, or pulled straight from Approved Material Requests."
      basePath="/api/procurement/purchase-orders"
      createDefaults={{
        poDate: today,
        taxMode: "Vatable",
        exchangeRate: "1",
        ...(singleBranch ? { branchId: singleBranch.id } : {}),
        ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}),
      }}
      onHeaderFieldChange={(key, value, header) => {
        if (key === "vendorId") {
          const v = vendorIndex[value];
          if (!v) return;
          const overrides: Record<string, any> = {};
          if (v.currencyId) {
            overrides.currencyId = v.currencyId;
            overrides.exchangeRate = String(currencyRateById[v.currencyId] ?? 1);
          }
          if (v.paymentTermsId) overrides.paymentTermsId = v.paymentTermsId;
          return overrides;
        }
        if (key === "currencyId") {
          return { exchangeRate: String(currencyRateById[value] ?? 1) };
        }
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
        {
          key: "validityDate",
          label: "Valid till",
          render: (r) => {
            if (!r.validityDate) return "-";
            const expired = new Date(r.validityDate).getTime() < Date.now();
            return (
              <span className={expired ? "font-semibold text-red-600" : ""}>
                {new Date(r.validityDate).toLocaleDateString()}
                {expired ? " (expired)" : ""}
              </span>
            );
          },
        },
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
        { key: "poDate", label: "Order Date", type: "date", required: true, section: "Transaction Details" },
        { key: "requiredDate", label: "Required Date", type: "date", section: "Transaction Details" },
        { key: "validityDate", label: "Valid Until", type: "date", section: "Transaction Details" },

        { key: "vendorId", label: "Vendor", type: "select", required: true, options: vendorOptions, section: "Vendor & Currency" },
        { key: "currencyId", label: "Currency", type: "select", options: currencyOptions, section: "Vendor & Currency" },
        { key: "exchangeRate", label: "Exch. Rate", type: "number", section: "Vendor & Currency" },
        { key: "paymentTermsId", label: "Pay Terms", type: "select", options: paymentTermsOptions, section: "Vendor & Currency" },

        // Hidden from the printout - the totals box after the Line Items
        // grid already surfaces Tax (VAT) and the combined discount, so
        // repeating the raw settings here would just be redundant on paper.
        { key: "taxMode", label: "Tax Mode", type: "select", required: true, options: TAX_MODE_OPTIONS, section: "Pricing", hideInPrint: true },
        { key: "discountPct", label: "Discount %", type: "number", section: "Pricing", hideInPrint: true },
        { key: "discountAmount", label: "Discount Amt", type: "number", section: "Pricing", hideInPrint: true },

        { key: "shipmentTypeId", label: "Shipment", type: "select", options: shipmentTypeOptions, section: "Logistics" },
        { key: "shippingTerms", label: "Ship Terms", type: "text", placeholder: "e.g. FOB, CIF...", section: "Logistics" },
        { key: "deliveryInstructions", label: "Delivery Note", type: "textarea", section: "Logistics" },
      ]}
      linesExtra={({ header, lines, addLines }) => <MrPoolPanel header={header} lines={lines} addLines={addLines} />}
      lineFields={[
        { key: "itemId", label: "Item", type: "select", required: true, options: itemOptions },
        { key: "instructions", label: "Instruction", type: "text" },
        { key: "baseUomDisplay", label: "Base UOM", type: "readonly", computed: (row) => itemsIndex[row.itemId]?.baseUomCode || "-" },
        {
          key: "qty",
          label: "Qty",
          type: "number",
          required: true,
          compact: true,
          // A fully-FOC line is entirely free - showing its stored qty here
          // (unchanged, still needed for receiving) would read as a charged
          // quantity, so the read-only views show 0 and let FOC Qty below
          // carry the actual free quantity instead.
          displayValue: (row) => (isFocRow(row) ? "0" : String(row.qty ?? "-")),
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
        { key: "unitPrice", label: "Unit Price", type: "number", required: true, compact: true },
        { key: "discountPct", label: "Disc %", type: "number", compact: true },
        { key: "discountAmount", label: "Disc Amt", type: "number", compact: true },
        // The Yes/No toggle itself stays on the editable form (it's what
        // actually flags a line as free) but is redundant on paper once FOC
        // Qty already shows the free quantity, so it's dropped from print.
        { key: "isFocLine", label: "FOC line?", type: "select", options: YES_NO, compact: true, hideInPrint: true },
        {
          key: "focQty",
          label: "FOC Qty",
          type: "number",
          compact: true,
          // For a fully-FOC line the free quantity is what's stored in qty
          // (see the qty column above); for an ordinary line it's this
          // field. Blank when there's nothing free, so the column reads at
          // a glance instead of a row of zeroes.
          displayValue: (row) => {
            const val = isFocRow(row) ? Number(row.qty) || 0 : Number(row.focQty) || 0;
            return val > 0 ? String(val) : "-";
          },
        },
        {
          key: "taxId",
          label: "Tax",
          type: "select",
          options: taxOptions,
          // Read-only views show just the rate - the full tax name/code is
          // only needed while picking the right one on the editable form.
          displayValue: (row) => (row.taxId ? `${taxRateById[row.taxId] ?? 0}%` : "-"),
        },
        {
          key: "headerDiscountShareDisplay",
          label: "Header Disc. Share",
          type: "readonly",
          computed: (row, ctx) => lineHeaderDiscountShare(row, ctx).toFixed(2),
          // Kept on screen for GRN/ledger reference, but dropped from print -
          // the printed totals box already shows header + line discount
          // combined into a single Discount figure.
          hideInPrint: true,
        },
        {
          key: "taxAmountDisplay",
          label: "Tax Amt (est.)",
          type: "readonly",
          computed: (row) => lineTaxPreview(row).toFixed(2),
        },
        {
          key: "lineTotalDisplay",
          label: "Line Total (est.)",
          type: "readonly",
          computed: (row) => (lineNet(row) + lineTaxPreview(row)).toFixed(2),
        },
      ]}
      emptyLine={{
        itemId: "",
        qty: "",
        uomId: "",
        unitPrice: "",
        discountPct: "",
        discountAmount: "",
        isFocLine: "false",
        focQty: "",
        taxId: "",
        instructions: "",
      }}
      summary={({ header, lines, savedTotal }) => {
        const { grossTotal, discountTotal, taxTotal, grandTotal } = computePoTotals(lines, header);
        const total = savedTotal ?? grandTotal;
        return (
          <div className="mb-5 flex justify-end">
            <div className="w-full space-y-1.5 rounded-xl border border-gray-200 bg-white p-4 text-sm shadow-sm sm:w-80">
              <div className="flex justify-between">
                <span className="text-gray-500">PO Amount</span>
                <span className="font-semibold text-navy-900">{grossTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Discount</span>
                <span className="font-semibold text-red-600">{discountTotal > 0 ? `-${discountTotal.toFixed(2)}` : "0.00"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tax (VAT)</span>
                <span className="font-semibold text-navy-900">{taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1.5 text-base">
                <span className="font-bold text-navy-900">Total (incl. VAT)</span>
                <span className="font-bold text-brand-700">{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        );
      }}
      printSummaryRows={(record) => {
        const { grossTotal, discountTotal, taxTotal } = computePoTotals(record.lines ?? [], record);
        const total = record.totalAmount != null ? Number(record.totalAmount) : grossTotal - discountTotal + taxTotal;
        const ccy = record.currency?.code ? ` ${record.currency.code}` : "";
        return [
          { label: "PO Amount", value: `${grossTotal.toFixed(2)}${ccy}` },
          { label: "Discount", value: discountTotal > 0 ? `-${discountTotal.toFixed(2)}${ccy}` : `0.00${ccy}` },
          { label: "Tax (VAT)", value: `${taxTotal.toFixed(2)}${ccy}` },
          { label: "Total (incl. VAT)", value: `${total.toFixed(2)}${ccy}`, emphasize: true },
        ];
      }}
      // Configured per company via Setup > Companies ("PO Terms & Conditions") -
      // each client/tenant can set their own standing wording. Only wired up
      // here, not on Material Requests.
      printTerms={(record) => record.branch?.company?.poTermsConditions ?? null}
      lifecycle={[
        { fromStatus: "Draft", action: "submit", label: "Submit for Approval" },
        { fromStatus: "Submitted", action: "approve", label: "Approve", confirmMessage: "Approve this purchase order?" },
      ]}
      statusFlow={["Draft", "Submitted", "Approved"]}
      attachmentsModuleCode="Procurement.PurchaseOrder"
    />
  );
}
