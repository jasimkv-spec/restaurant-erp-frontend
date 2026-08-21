import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, Plus, Send, Trophy, ShoppingCart, X, Download, Upload, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { api, ApiError, type ListResponse } from "../../lib/apiClient";
import { useAuth } from "../../context/AuthContext";
import { useOptions } from "../../lib/useOptions";
import { FIELD_CLASS, LABEL_CLASS } from "../../components/CrudTable";
import { StatusBadge } from "../../components/DocumentScreen";
import { ListFilterBar } from "../../components/ListFilterBar";
import { matchesRowFilters, exportRowsToExcel, type ListFilterConfig } from "../../lib/listFilters";

// Column headers used both when generating the blank template and when
// reading a vendor's completed one back - keeping these as named constants
// (rather than repeating the literal strings) means a header tweak only
// has to happen in one place.
const TEMPLATE_HEADERS = {
  itemCode: "Item Code",
  itemName: "Item Name",
  qty: "Qty",
  unit: "Unit",
  price: "Price",
  leadTime: "Lead Time (Days)",
} as const;

interface RfqListRow {
  id: string;
  rfqNo: string;
  rfqDate: string;
  status: string;
  branchId?: string | null;
  branch?: { code: string; name: string };
  lines: { id: string }[];
}

interface RfqQuote {
  id: string;
  rfqLineId: string;
  vendorId: string;
  quotedPrice: number;
  leadTimeDays: number | null;
  isSelected: boolean;
  vendor?: { code: string; name: string };
}

interface RfqLine {
  id: string;
  itemId: string;
  qty: number;
  uomId: string;
  item?: { code: string; name: string };
  uom?: { code: string };
  quotes: RfqQuote[];
}

interface RfqDetail {
  id: string;
  rfqNo: string;
  rfqDate: string;
  status: string;
  notes?: string | null;
  branchId?: string | null;
  lines: RfqLine[];
}

/**
 * RFQ (Request for Quotation): send a set of lines to be priced, record what
 * each vendor quotes per line, pick the winning quote per line, then convert
 * the winners into one Purchase Order per vendor. RFQs mostly arrive here
 * already created - from MR Consolidation's "Convert to RFQ" action - but
 * this screen also lets you start one from scratch for a one-off need.
 */
export default function Rfqs() {
  const { user, activeCompanyScope } = useAuth();
  const [view, setView] = useState<"list" | "new" | "detail">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rows, setRows] = useState<RfqListRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const allBranchOptions = useOptions("/api/admin/branches", (b) => `${b.code} - ${b.name}`);
  const allCompanyOptions = useOptions("/api/admin/companies", (c) => `${c.code} - ${c.name}`);
  const itemOptions = useOptions("/api/inventory/items", (i) => `${i.code} - ${i.name}`, "forPurchase=true");
  const uomOptions = useOptions("/api/masters/uoms", (u) => `${u.code} - ${u.name}`);
  const vendorOptions = useOptions("/api/procurement/vendors", (v) => `${v.code} - ${v.name}`);

  const scopedCompanyId = activeCompanyScope && activeCompanyScope !== "GLOBAL" ? activeCompanyScope : null;
  const myCompanies = user?.companies;
  const companyOptions = myCompanies && myCompanies.length > 0
    ? myCompanies.map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }))
    : allCompanyOptions;

  function loadList() {
    setLoadingList(true);
    api
      .get<ListResponse<RfqListRow>>("/api/procurement/rfqs")
      .then((res) => setRows(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load RFQs"))
      .finally(() => setLoadingList(false));
  }

  useEffect(() => {
    if (view === "list") loadList();
  }, [view]);

  return (
    <div className="mx-auto max-w-6xl">
      {view === "list" && (
        <ListView
          rows={rows}
          loading={loadingList}
          error={error}
          branchOptions={allBranchOptions}
          onNew={() => {
            setError(null);
            setView("new");
          }}
          onOpen={(id) => {
            setError(null);
            setSelectedId(id);
            setView("detail");
          }}
        />
      )}
      {view === "new" && (
        <NewRfqView
          companyOptions={companyOptions}
          scopedCompanyId={scopedCompanyId}
          branchOptions={allBranchOptions}
          itemOptions={itemOptions}
          uomOptions={uomOptions}
          onBack={() => setView("list")}
          onCreated={() => setView("list")}
        />
      )}
      {view === "detail" && (
        <DetailView
          id={selectedId}
          companyOptions={companyOptions}
          scopedCompanyId={scopedCompanyId}
          branchOptions={allBranchOptions}
          vendorOptions={vendorOptions}
          onBack={() => setView("list")}
        />
      )}
    </div>
  );
}

function ListView({
  rows,
  loading,
  error,
  branchOptions,
  onNew,
  onOpen,
}: {
  rows: RfqListRow[];
  loading: boolean;
  error: string | null;
  branchOptions: { value: string; label: string }[];
  onNew: () => void;
  onOpen: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filters: ListFilterConfig[] = [
    { key: "branchId", label: "Branch", type: "select", options: branchOptions, accessor: (r) => r.branchId },
  ];

  const filteredRows = rows.filter((row) =>
    matchesRowFilters(row, {
      search,
      searchAccessor: (r) => (r.rfqNo ?? "").toLowerCase(),
      filters,
      filterValues,
      dateRangeFilter: { key: "rfqDate", label: "Date" },
      dateFrom,
      dateTo,
    })
  );

  const allVisibleSelected = filteredRows.length > 0 && filteredRows.every((r) => selectedIds.has(r.id));

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const r of filteredRows) next.delete(r.id);
      } else {
        for (const r of filteredRows) next.add(r.id);
      }
      return next;
    });
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const listColumns = [
    { key: "rfqNo", label: "RFQ No." },
    { key: "rfqDate", label: "Date", render: (r: RfqListRow) => new Date(r.rfqDate).toLocaleDateString() },
    { key: "branch", label: "Branch", render: (r: RfqListRow) => (r.branch ? `${r.branch.code} - ${r.branch.name}` : "-") },
    { key: "lines", label: "Lines", render: (r: RfqListRow) => r.lines?.length ?? 0 },
    { key: "status", label: "Status" },
  ];

  function handleExport() {
    const selectedRows = filteredRows.filter((r) => selectedIds.has(r.id));
    exportRowsToExcel(listColumns, selectedRows.length > 0 ? selectedRows : filteredRows, "RFQs");
  }

  return (
    <>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-navy-900">RFQs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Requests for quotation sent to vendors. Record what each one quotes per line, pick the winners, then
            convert to a Purchase Order per vendor.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={handleExport}
            disabled={filteredRows.length === 0}
            title={selectedIds.size > 0 ? "Export selected rows to Excel" : "Export all listed rows to Excel"}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            <FileSpreadsheet size={15} />
            {selectedIds.size > 0 ? `Export selected (${selectedIds.size})` : "Export to Excel"}
          </button>
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            <Plus size={16} />
            New RFQ
          </button>
        </div>
      </div>

      <ListFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search RFQ No..."
        filters={filters}
        filterValues={filterValues}
        onFilterChange={(key, value) => setFilterValues((prev) => ({ ...prev, [key]: value }))}
        dateRangeFilter={{ key: "rfqDate", label: "Date" }}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        onClear={() => {
          setSearch("");
          setFilterValues({});
          setDateFrom("");
          setDateTo("");
        }}
      />

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="w-10 px-4 py-2.5">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} onClick={(e) => e.stopPropagation()} />
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">RFQ No.</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Date</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Branch</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Lines</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">Loading...</td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  {rows.length === 0 ? 'No RFQs yet - convert an MR Consolidation to RFQ, or click "New RFQ".' : "No RFQs match these filters."}
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id} onClick={() => onOpen(row.id)} className="cursor-pointer transition-colors hover:bg-brand-50">
                  <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleSelectOne(row.id)} />
                  </td>
                  <td className="px-4 py-2.5 font-medium text-navy-900">{row.rfqNo}</td>
                  <td className="px-4 py-2.5 text-navy-900">{new Date(row.rfqDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-navy-900">{row.branch ? `${row.branch.code} - ${row.branch.name}` : "-"}</td>
                  <td className="px-4 py-2.5 text-navy-900">{row.lines?.length ?? 0}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

interface DraftLine {
  itemId: string;
  qty: string;
  uomId: string;
}

function NewRfqView({
  companyOptions,
  scopedCompanyId,
  branchOptions,
  itemOptions,
  uomOptions,
  onBack,
  onCreated,
}: {
  companyOptions: { value: string; label: string }[];
  scopedCompanyId: string | null;
  branchOptions: { value: string; label: string }[];
  itemOptions: { value: string; label: string }[];
  uomOptions: { value: string; label: string }[];
  onBack: () => void;
  onCreated: () => void;
}) {
  const [companyId, setCompanyId] = useState(scopedCompanyId ?? "");
  const [branchId, setBranchId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([{ itemId: "", qty: "", uomId: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { itemId: "", qty: "", uomId: "" }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  const validLines = lines.filter((l) => l.itemId && l.qty && l.uomId);

  async function handleCreate() {
    if (!companyId || validLines.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await api.post("/api/procurement/rfqs", {
        companyId,
        branchId: branchId || undefined,
        notes: notes || undefined,
        lines: validLines.map((l) => ({ itemId: l.itemId, qty: Number(l.qty), uomId: l.uomId })),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create RFQ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-navy-900">
        <ArrowLeft size={16} />
        Back to list
      </button>

      <div className="mb-5 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <h1 className="text-xl font-bold text-navy-900">New RFQ</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          For a one-off need. Most RFQs will instead come from converting an approved MR Consolidation.
        </p>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <div>
          <label className={LABEL_CLASS}>Company</label>
          <select className={FIELD_CLASS} value={companyId} disabled={!!scopedCompanyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">Select...</option>
            {companyOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>Branch (optional)</label>
          <select className={FIELD_CLASS} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Not tied to one branch</option>
            {branchOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>Notes (optional)</label>
          <input className={FIELD_CLASS} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <div className="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600">
          Lines
        </div>
        <div className="divide-y divide-gray-100 p-3">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-[1fr_7rem_10rem_2.5rem] items-end gap-2 py-2">
              <div>
                <label className={LABEL_CLASS}>Item</label>
                <select className={FIELD_CLASS} value={line.itemId} onChange={(e) => updateLine(i, { itemId: e.target.value })}>
                  <option value="">Select...</option>
                  {itemOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Qty</label>
                <input
                  type="number"
                  className={FIELD_CLASS}
                  value={line.qty}
                  onChange={(e) => updateLine(i, { qty: e.target.value })}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Unit</label>
                <select className={FIELD_CLASS} value={line.uomId} onChange={(e) => updateLine(i, { uomId: e.target.value })}>
                  <option value="">Select...</option>
                  {uomOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => removeLine(i)}
                disabled={lines.length === 1}
                title="Remove line"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 px-3 py-2.5">
          <button onClick={addLine} className="flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800">
            <Plus size={14} />
            Add line
          </button>
        </div>
      </div>

      <button
        onClick={handleCreate}
        disabled={saving || !companyId || validLines.length === 0}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? "Creating..." : "Create RFQ"}
      </button>
    </>
  );
}

function DetailView({
  id,
  companyOptions,
  scopedCompanyId,
  branchOptions,
  vendorOptions,
  onBack,
}: {
  id: string | null;
  companyOptions: { value: string; label: string }[];
  scopedCompanyId: string | null;
  branchOptions: { value: string; label: string }[];
  vendorOptions: { value: string; label: string }[];
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<RfqDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Locally-checked winning quote per line, seeded from whatever's already
  // marked isSelected server-side - lets "Save winners" submit the whole set
  // in one call to /select rather than one request per line.
  const [winnerByLine, setWinnerByLine] = useState<Record<string, string>>({});
  const [savingWinners, setSavingWinners] = useState(false);

  function load() {
    if (!id) return;
    setLoading(true);
    api
      .get<RfqDetail>(`/api/procurement/rfqs/${id}`)
      .then((res) => {
        setDetail(res);
        setWinnerByLine(
          Object.fromEntries(
            res.lines
              .map((l) => [l.id, l.quotes.find((q) => q.isSelected)?.id ?? ""])
              .filter(([, v]) => v)
          )
        );
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load RFQ"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function handleSend() {
    if (!id) return;
    setSending(true);
    setError(null);
    try {
      await api.post(`/api/procurement/rfqs/${id}/send`);
      setActionResult("RFQ marked as Sent.");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send RFQ");
    } finally {
      setSending(false);
    }
  }

  async function handleSaveWinners() {
    if (!id) return;
    const quoteIds = Object.values(winnerByLine).filter(Boolean);
    if (quoteIds.length === 0) return;
    setSavingWinners(true);
    setError(null);
    try {
      await api.post(`/api/procurement/rfqs/${id}/select`, { quoteIds });
      setActionResult("Winning quotes saved.");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save winners");
    } finally {
      setSavingWinners(false);
    }
  }

  const hasAnySelected = detail?.lines.some((l) => l.quotes.some((q) => q.isSelected)) ?? false;

  if (!id) {
    return (
      <>
        <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-navy-900">
          <ArrowLeft size={16} />
          Back to list
        </button>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-gray-400 shadow-sm">No RFQ selected.</div>
      </>
    );
  }

  return (
    <>
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-navy-900">
        <ArrowLeft size={16} />
        Back to list
      </button>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {actionResult && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{actionResult}</div>
      )}

      {loading || !detail ? (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-gray-400 shadow-sm">Loading...</div>
      ) : (
        <>
          <div className="mb-5 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <div>
              <h1 className="text-xl font-bold text-navy-900">{detail.rfqNo}</h1>
              <p className="mt-0.5 text-sm text-gray-500">{new Date(detail.rfqDate).toLocaleDateString()}{detail.notes ? ` - ${detail.notes}` : ""}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={detail.status} />
              {detail.status === "Draft" && (
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
                >
                  <Send size={13} />
                  {sending ? "Sending..." : "Send"}
                </button>
              )}
            </div>
          </div>

          {detail.status !== "Closed" && detail.status !== "Cancelled" && (
            <ExcelQuotePanel rfqId={detail.id} lines={detail.lines} vendorOptions={vendorOptions} onDone={load} />
          )}

          <div className="mb-5 space-y-4">
            {detail.lines.map((line) => (
              <RfqLinePanel
                key={line.id}
                line={line}
                rfqId={detail.id}
                vendorOptions={vendorOptions}
                disabled={detail.status === "Closed" || detail.status === "Cancelled"}
                winnerId={winnerByLine[line.id] ?? ""}
                onSetWinner={(quoteId) => setWinnerByLine((prev) => ({ ...prev, [line.id]: quoteId }))}
                onQuoteAdded={load}
              />
            ))}
          </div>

          {detail.status !== "Closed" && detail.status !== "Cancelled" && (
            <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-1.5 border-b border-gray-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
                <Trophy size={12} />
                Winning quotes
              </div>
              <p className="mb-3 text-xs text-gray-500">
                Pick one quote per line above (radio button next to a quote), then save. Only lines with a saved
                winner can be converted to a Purchase Order.
              </p>
              <button
                onClick={handleSaveWinners}
                disabled={savingWinners || Object.values(winnerByLine).filter(Boolean).length === 0}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
              >
                {savingWinners ? "Saving..." : "Save winning quotes"}
              </button>
            </div>
          )}

          {hasAnySelected && detail.status !== "Closed" && (
            <ConvertToPoPanel
              rfqId={detail.id}
              companyOptions={companyOptions}
              scopedCompanyId={scopedCompanyId}
              branchOptions={branchOptions}
              defaultBranchId={detail.branchId ?? ""}
              onDone={(msg) => {
                setActionResult(msg);
                load();
              }}
            />
          )}
        </>
      )}
    </>
  );
}

/**
 * Bulk quote entry for RFQs with many items/vendors, where recording one
 * quote at a time in RfqLinePanel below would mean dozens of clicks.
 * "Download template" builds an .xlsx client-side from this RFQ's own
 * lines (Item Code/Name/Qty/Unit + blank Price/Lead Time columns) - send
 * that to a vendor to fill in and return. "Upload" reads their completed
 * file back, matches each row to a line by Item Code, and records one
 * quote per matched row via the same POST /rfqs/:id/quotes endpoint the
 * one-at-a-time form uses - no separate bulk-import endpoint needed.
 */
function ExcelQuotePanel({
  rfqId,
  lines,
  vendorOptions,
  onDone,
}: {
  rfqId: string;
  lines: RfqLine[];
  vendorOptions: { value: string; label: string }[];
  onDone: () => void;
}) {
  const [vendorId, setVendorId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function downloadTemplate() {
    const rows = lines.map((l) => ({
      [TEMPLATE_HEADERS.itemCode]: l.item?.code ?? l.itemId,
      [TEMPLATE_HEADERS.itemName]: l.item?.name ?? "",
      [TEMPLATE_HEADERS.qty]: Number(l.qty),
      [TEMPLATE_HEADERS.unit]: l.uom?.code ?? "",
      [TEMPLATE_HEADERS.price]: "",
      [TEMPLATE_HEADERS.leadTime]: "",
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    (sheet as any)["!cols"] = [{ wch: 14 }, { wch: 30 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 14 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Quote");
    XLSX.writeFile(workbook, `RFQ-quote-template.xlsx`);
  }

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !vendorId) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const parsedRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      const lineByCode = new Map(lines.map((l) => [(l.item?.code ?? "").trim().toLowerCase(), l]));

      let recorded = 0;
      let skipped = 0;
      for (const row of parsedRows) {
        const code = String(row[TEMPLATE_HEADERS.itemCode] ?? "").trim().toLowerCase();
        const line = code ? lineByCode.get(code) : undefined;
        const price = Number(row[TEMPLATE_HEADERS.price]);
        if (!line || !Number.isFinite(price)) {
          skipped++;
          continue;
        }
        const leadTimeRaw = row[TEMPLATE_HEADERS.leadTime];
        const leadTimeDays = leadTimeRaw !== undefined && leadTimeRaw !== "" ? Number(leadTimeRaw) : undefined;
        await api.post(`/api/procurement/rfqs/${rfqId}/quotes`, {
          rfqLineId: line.id,
          vendorId,
          quotedPrice: price,
          leadTimeDays: Number.isFinite(leadTimeDays as number) ? leadTimeDays : undefined,
        });
        recorded++;
      }

      setResult(
        `${recorded} quote${recorded === 1 ? "" : "s"} recorded${skipped > 0 ? `, ${skipped} row${skipped === 1 ? "" : "s"} skipped (no matching item code or price)` : ""}.`
      );
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not read that file - make sure it's the downloaded template with Item Code and Price filled in.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5 border-b border-gray-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
        <FileSpreadsheet size={12} />
        Vendor quotes via Excel
      </div>
      <p className="mb-3 text-xs text-gray-500">
        For RFQs with many items - download the item list, send it to a vendor to fill in Price (and optionally
        Lead Time), then upload their completed file back to record all their quotes at once instead of one at a
        time below.
      </p>
      {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {result && (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{result}</div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          <Download size={13} />
          Download template
        </button>
        <div className="w-56">
          <label className={LABEL_CLASS}>Vendor this file is from</label>
          <select className={FIELD_CLASS} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">Select...</option>
            {vendorOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!vendorId || uploading}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
        >
          <Upload size={13} />
          {uploading ? "Uploading..." : "Upload completed file"}
        </button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
      </div>
    </div>
  );
}

function RfqLinePanel({
  line,
  rfqId,
  vendorOptions,
  disabled,
  winnerId,
  onSetWinner,
  onQuoteAdded,
}: {
  line: RfqLine;
  rfqId: string;
  vendorOptions: { value: string; label: string }[];
  disabled: boolean;
  winnerId: string;
  onSetWinner: (quoteId: string) => void;
  onQuoteAdded: () => void;
}) {
  const [vendorId, setVendorId] = useState("");
  const [quotedPrice, setQuotedPrice] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAddQuote() {
    if (!vendorId || !quotedPrice) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/procurement/rfqs/${rfqId}/quotes`, {
        rfqLineId: line.id,
        vendorId,
        quotedPrice: Number(quotedPrice),
        leadTimeDays: leadTimeDays ? Number(leadTimeDays) : undefined,
      });
      setVendorId("");
      setQuotedPrice("");
      setLeadTimeDays("");
      onQuoteAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record quote");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-semibold text-navy-900">
          {line.item ? `${line.item.code} - ${line.item.name}` : line.itemId}
        </div>
        <div className="text-sm text-gray-500">
          {line.qty} {line.uom?.code ?? ""}
        </div>
      </div>

      {error && <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {line.quotes.length === 0 ? (
        <div className="mb-3 py-2 text-center text-sm text-gray-400">No quotes recorded yet for this line.</div>
      ) : (
        <div className="mb-3 overflow-hidden rounded-lg border border-gray-200">
          <div className="grid grid-cols-[2rem_1.5fr_1fr_1fr] gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <div>Win</div>
            <div>Vendor</div>
            <div>Price</div>
            <div>Lead time</div>
          </div>
          <div className="divide-y divide-gray-100">
            {line.quotes.map((q) => (
              <label key={q.id} className="grid cursor-pointer grid-cols-[2rem_1.5fr_1fr_1fr] items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50">
                <input
                  type="radio"
                  name={`winner-${line.id}`}
                  checked={winnerId === q.id}
                  disabled={disabled}
                  onChange={() => onSetWinner(q.id)}
                />
                <span className="truncate text-navy-900">{q.vendor ? `${q.vendor.code} - ${q.vendor.name}` : q.vendorId}</span>
                <span className="text-navy-900">{q.quotedPrice}</span>
                <span className="text-gray-600">{q.leadTimeDays != null ? `${q.leadTimeDays}d` : "-"}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {!disabled && (
        <div className="grid grid-cols-[1fr_7rem_7rem_6rem] items-end gap-2">
          <div>
            <label className={LABEL_CLASS}>Vendor</label>
            <select className={FIELD_CLASS} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">Select...</option>
              {vendorOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS}>Price</label>
            <input type="number" className={FIELD_CLASS} value={quotedPrice} onChange={(e) => setQuotedPrice(e.target.value)} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Lead time (days)</label>
            <input type="number" className={FIELD_CLASS} value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value)} />
          </div>
          <button
            onClick={handleAddQuote}
            disabled={saving || !vendorId || !quotedPrice}
            className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add quote"}
          </button>
        </div>
      )}
    </div>
  );
}

function ConvertToPoPanel({
  rfqId,
  companyOptions,
  scopedCompanyId,
  branchOptions,
  defaultBranchId,
  onDone,
}: {
  rfqId: string;
  companyOptions: { value: string; label: string }[];
  scopedCompanyId: string | null;
  branchOptions: { value: string; label: string }[];
  defaultBranchId: string;
  onDone: (msg: string) => void;
}) {
  const [companyId, setCompanyId] = useState(scopedCompanyId ?? "");
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConvert() {
    if (!companyId || !branchId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ purchaseOrders: { poNo: string }[] }>(`/api/procurement/rfqs/${rfqId}/convert-to-po`, {
        companyId,
        branchId,
      });
      const nos = res.purchaseOrders.map((p) => p.poNo).join(", ");
      onDone(`Converted to Purchase Order(s): ${nos}. The PO screen to process them is coming in the next build round.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not convert to PO");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5 border-b border-gray-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
        <ShoppingCart size={12} />
        Convert to Purchase Order
      </div>
      <p className="mb-3 text-xs text-gray-500">
        Creates one PO per vendor from every line with a saved winning quote. Lines without a saved winner are left
        out - save more winners above and convert again if needed.
      </p>
      {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={LABEL_CLASS}>Company</label>
          <select className={FIELD_CLASS} value={companyId} disabled={!!scopedCompanyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">Select...</option>
            {companyOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>Branch</label>
          <select className={FIELD_CLASS} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Select...</option>
            {branchOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        onClick={handleConvert}
        disabled={saving || !companyId || !branchId}
        className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? "Converting..." : "Convert to Purchase Order"}
      </button>
    </div>
  );
}
