import { useEffect, useState } from "react";
import { DocumentScreen } from "../../components/DocumentScreen";
import { SearchableSelect } from "../../components/SearchableSelect";
import { useOptions } from "../../lib/useOptions";
import { api, type ListResponse } from "../../lib/apiClient";

interface GrnPoolEntry {
  id: string;
  grnNo: string;
  vendorId: string;
  grnDate: string;
  value: number;
}

interface AdditionalCostRow {
  costTypeId: string;
  amount: number | "";
  remark: string;
}

/**
 * Lets the user pick which Posted GRNs this supplier invoice covers - one
 * invoice can settle several GRNs at once (see PurchaseInvoiceGrn). Only
 * offers GRNs for the vendor currently selected in the header, that aren't
 * already linked to a different invoice (no partial/repeat invoicing of the
 * same GRN in this first version).
 *
 * Picking a GRN pulls in every one of its own lines as a separate invoice
 * row (item, qty, price, discount, tax, line total - the same level of
 * detail as a Purchase Order), plus one row per additional cost the GRN
 * itself carries (freight/insurance/handling), rather than a single lumped
 * summary row per GRN. Every row from the same GRN shares that GRN's id, so
 * the backend can still tell which whole GRNs this invoice links to.
 */
function GrnPickerPanel({
  header,
  lines,
  addLines,
}: {
  header: Record<string, any>;
  lines: Record<string, any>[];
  addLines: (rows: Record<string, any>[]) => void;
}) {
  const [pool, setPool] = useState<GrnPoolEntry[]>([]);
  const [alreadyInvoiced, setAlreadyInvoiced] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [selectedGrnId, setSelectedGrnId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<ListResponse<any>>("/api/procurement/grns?status=Posted&pageSize=200"),
      api.get<ListResponse<any>>("/api/procurement/purchase-invoices?pageSize=200"),
    ])
      .then(([grnRes, invoiceRes]) => {
        const linked = new Set<string>();
        for (const inv of invoiceRes.data) {
          for (const bridge of inv.grns ?? []) linked.add(bridge.grnId);
        }
        setAlreadyInvoiced(linked);
        setPool(
          grnRes.data.map((g) => ({
            id: g.id,
            grnNo: g.grnNo,
            vendorId: g.vendorId,
            grnDate: g.grnDate,
            value:
              (g.lines ?? []).reduce((s: number, l: any) => s + Number(l.acceptedQty) * Number(l.unitCost ?? 0), 0) +
              (g.additionalCosts ?? []).reduce((s: number, c: any) => s + Number(c.amount), 0),
          }))
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedGrnIds = new Set(lines.map((l) => l.grnId).filter(Boolean));
  const availablePool = pool.filter(
    (g) => (!header.vendorId || g.vendorId === header.vendorId) && !alreadyInvoiced.has(g.id) && !selectedGrnIds.has(g.id)
  );
  const options = availablePool.map((g) => ({
    value: g.id,
    label: `${g.grnNo} - ${new Date(g.grnDate).toLocaleDateString()} - value ${g.value.toFixed(2)}`,
  }));

  async function pick(grnId: string) {
    if (!grnId) return;
    setError(null);
    setPulling(true);
    try {
      const grn = await api.get<any>(`/api/procurement/grns/${grnId}`);
      const goodsRows = (grn.lines ?? []).map((l: any) => {
        const qty = Number(l.acceptedQty);
        const unitPrice = l.poLine ? Number(l.poLine.unitPrice) : Number(l.unitCost ?? 0);
        const taxPct = l.poLine?.tax ? Number(l.poLine.tax.rate) : null;
        const taxAmount = l.poLine ? Number(l.poLine.taxAmount ?? 0) : 0;
        const discount = l.poLine?.discountPct
          ? `${Number(l.poLine.discountPct)}%`
          : l.poLine?.discountAmount
          ? Number(l.poLine.discountAmount).toFixed(2)
          : "-";
        const lineTotal = l.poLine ? Number(l.poLine.lineTotal) : qty * unitPrice;
        return {
          grnId,
          itemName: l.item?.name ?? l.item?.code ?? "-",
          qty,
          unitPrice,
          discountDisplay: discount,
          taxDisplay: taxPct !== null ? `${taxPct}% (${taxAmount.toFixed(2)})` : "-",
          lineTotal,
        };
      });
      const costRows = (grn.additionalCosts ?? []).map((c: any) => ({
        grnId,
        itemName: `${c.costType?.name ?? "Additional cost"} (GRN cost)`,
        qty: 1,
        unitPrice: Number(c.amount),
        discountDisplay: "-",
        taxDisplay: "-",
        lineTotal: Number(c.amount),
      }));
      const rows = [...goodsRows, ...costRows];
      if (rows.length === 0) {
        setError(`${grn.grnNo} has no lines or costs to pull in.`);
        return;
      }
      addLines(rows);
      setSelectedGrnId("");
    } catch (err) {
      setError("Could not load that GRN's lines - please try again.");
    } finally {
      setPulling(false);
    }
  }

  return (
    <div className="mb-5 rounded-xl border border-sky-100 bg-sky-50/40 p-4 shadow-sm">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-sky-700">Linked GRNs</div>
      {!header.vendorId ? (
        <p className="text-[11px] text-gray-500">Pick a Vendor above first to see their Posted GRNs.</p>
      ) : loading ? (
        <p className="text-[11px] text-gray-400">Loading Posted GRNs...</p>
      ) : (
        <>
          <SearchableSelect
            options={options}
            value={selectedGrnId}
            onChange={pick}
            disabled={pulling}
            placeholder={options.length ? "Add a Posted GRN to this invoice..." : "No un-invoiced Posted GRNs for this vendor"}
            className="w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
          />
          <p className="mt-1.5 text-[11px] text-gray-500">
            Adding a GRN pulls in every one of its lines (item, qty, price, discount, tax) plus its own additional
            costs - remove individual rows below if this invoice doesn't cover all of them.
          </p>
          {error && <p className="mt-1 text-[11px] font-medium text-red-600">{error}</p>}
        </>
      )}
    </div>
  );
}

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
          Additional Costs on this invoice (not tied to a specific GRN)
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
          None - use this only for a cost billed on this same invoice that wasn't already added to a GRN (e.g. a
          freight-forwarder's own line item).
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
      {total > 0 && <p className="mt-2 text-[11px] font-medium text-amber-700">Invoice-level additional costs total: {total.toFixed(2)}</p>}
    </div>
  );
}

/**
 * Purchase Invoice - captures the vendor's own invoice (number, date,
 * received date, gross/tax amount) against one or more Posted GRNs, and,
 * once posted, runs a three-way match (PO price/qty vs GRN accepted qty vs
 * this invoice's gross, within the company's configured tolerance - see
 * resolvePolicy / PoGrnInvoiceTolerancePct) before booking Dr GRN-Clearing /
 * Cr Accounts Payable. The line grid mirrors a Purchase Order's own detail
 * (item, qty, unit price, discount, tax, line total) by pulling in every
 * line from each linked GRN, rather than one lumped row per GRN - so the
 * invoice's own total can be checked line-by-line against what was actually
 * ordered and received, not just as a single aggregate figure.
 */
export default function PurchaseInvoices() {
  const vendorOptions = useOptions("/api/procurement/vendors", (v) => `${v.code} - ${v.name}`);
  const costTypeOptions = useOptions("/api/procurement/additional-cost-types", (t) => `${t.code} - ${t.name}`);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <DocumentScreen
      title="Purchase Invoices"
      description="Records the vendor's own invoice against one or more Posted GRNs, with the same item/qty/price/tax/discount detail as a Purchase Order. Posting runs a three-way match and books the payable."
      basePath="/api/procurement/purchase-invoices"
      createDefaults={{ invoiceDate: today, invoiceReceivedDate: today, gross: "", tax: "0", additionalCosts: [] }}
      searchAccessor={(r) => `${r.invoiceNo ?? ""} ${r.vendor?.code ?? ""} ${r.vendor?.name ?? ""}`.toLowerCase()}
      searchPlaceholder="Search invoice no. or vendor..."
      filters={[{ key: "vendorId", label: "Vendor", type: "select", options: vendorOptions, accessor: (r) => r.vendorId }]}
      dateRangeFilter={{ key: "invoiceDate", label: "Invoice date" }}
      listColumns={[
        { key: "invoiceNo", label: "Invoice No." },
        { key: "vendor", label: "Vendor", render: (r) => (r.vendor ? `${r.vendor.code} - ${r.vendor.name}` : "-") },
        { key: "invoiceDate", label: "Invoice Date", render: (r) => (r.invoiceDate ? new Date(r.invoiceDate).toLocaleDateString() : "-") },
        { key: "gross", label: "Gross", render: (r) => Number(r.gross ?? 0).toFixed(2) },
        { key: "net", label: "Net", render: (r) => Number(r.net ?? 0).toFixed(2) },
        { key: "grns", label: "Linked GRNs", render: (r) => r.grns?.length ?? 0 },
        { key: "createdBy", label: "Created by", render: (r) => r.createdBy?.displayName ?? "-" },
        { key: "postingStatus", label: "Status" },
      ]}
      headerFields={[
        { key: "vendorId", label: "Vendor", type: "select", required: true, options: vendorOptions, section: "Invoice Details" },
        { key: "invoiceNo", label: "Supplier Invoice No.", type: "text", required: true, section: "Invoice Details" },
        { key: "invoiceDate", label: "Supplier Invoice Date", type: "date", required: true, section: "Invoice Details" },
        { key: "invoiceReceivedDate", label: "Invoice Received Date", type: "date", section: "Invoice Details" },
        { key: "gross", label: "Supplier Invoice Amount (Gross)", type: "number", required: true, section: "Amount" },
        { key: "tax", label: "Tax", type: "number", section: "Amount" },
        {
          key: "netDisplay",
          label: "Net (Gross + Tax)",
          type: "readonly",
          computed: (row) => (Number(row.gross || 0) + Number(row.tax || 0)).toFixed(2),
          section: "Amount",
        },
        // Set by the Additional Costs panel below - a plain array, carried
        // straight through to the saved payload (see DocFieldConfig.hidden).
        { key: "additionalCosts", label: "Additional Costs", type: "text", hidden: true },
      ]}
      linesExtra={({ header, lines, addLines, setHeaderFields }) => {
        const linesValue = lines.reduce((sum: number, l: any) => sum + Number(l.lineTotal || 0), 0);
        const invoiceCosts = (header.additionalCosts ?? []).reduce((s: number, c: any) => s + Number(c.amount), 0);
        const expected = linesValue + invoiceCosts;
        const gross = Number(header.gross || 0);
        const variance = expected > 0 ? ((gross - expected) / expected) * 100 : 0;
        const withinRoughTolerance = Math.abs(variance) <= 2;
        return (
          <>
            <GrnPickerPanel header={header} lines={lines} addLines={addLines} />
            <AdditionalCostsPanel header={header} setHeaderFields={setHeaderFields} costTypeOptions={costTypeOptions} />
            {(lines.length > 0 || invoiceCosts > 0) && (
              <div
                className={`mb-5 rounded-xl border p-4 text-sm shadow-sm ${
                  withinRoughTolerance ? "border-emerald-200 bg-emerald-50/50 text-emerald-800" : "border-amber-200 bg-amber-50/50 text-amber-800"
                }`}
              >
                <span className="font-semibold">Linked GRN + cost value: {expected.toFixed(2)}</span>
                {" · "}
                <span className="font-semibold">Invoice gross: {gross.toFixed(2)}</span>
                {expected > 0 && (
                  <span>
                    {" · "}Variance: {variance.toFixed(1)}%{!withinRoughTolerance && " - may exceed the posting tolerance"}
                  </span>
                )}
              </div>
            )}
          </>
        );
      }}
      lineFields={[
        { key: "grnId", label: "GRN", type: "text", hidden: true },
        { key: "itemNameDisplay", label: "Item", type: "readonly", computed: (row) => row.itemName ?? "-" },
        { key: "qtyDisplay", label: "Qty", type: "readonly", computed: (row) => String(row.qty ?? "-"), compact: true },
        { key: "unitPriceDisplay", label: "Unit Price", type: "readonly", computed: (row) => Number(row.unitPrice ?? 0).toFixed(2), compact: true },
        { key: "discountDisplayField", label: "Discount", type: "readonly", computed: (row) => row.discountDisplay ?? "-", compact: true },
        { key: "taxDisplayField", label: "Tax", type: "readonly", computed: (row) => row.taxDisplay ?? "-", compact: true },
        { key: "lineTotalDisplay", label: "Line Total", type: "readonly", computed: (row) => Number(row.lineTotal ?? 0).toFixed(2), compact: true },
      ]}
      emptyLine={{ grnId: "" }}
      lifecycle={[
        {
          fromStatus: "Draft",
          action: "post",
          label: "Post Invoice",
          confirmMessage: "Post this invoice? It will be matched against its linked GRNs and booked to Accounts Payable - this cannot be undone.",
        },
      ]}
      statusFlow={["Draft", "Posted"]}
      statusField="postingStatus"
    />
  );
}
