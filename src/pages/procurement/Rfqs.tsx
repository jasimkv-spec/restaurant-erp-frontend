import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Send, Trophy, ShoppingCart, X } from "lucide-react";
import { api, ApiError, type ListResponse } from "../../lib/apiClient";
import { useAuth } from "../../context/AuthContext";
import { useOptions } from "../../lib/useOptions";
import { FIELD_CLASS, LABEL_CLASS } from "../../components/CrudTable";
import { StatusBadge } from "../../components/DocumentScreen";

interface RfqListRow {
  id: string;
  rfqNo: string;
  rfqDate: string;
  status: string;
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
  onNew,
  onOpen,
}: {
  rows: RfqListRow[];
  loading: boolean;
  error: string | null;
  onNew: () => void;
  onOpen: (id: string) => void;
}) {
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
        <button
          onClick={onNew}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          <Plus size={16} />
          New RFQ
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
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
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">Loading...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  No RFQs yet - convert an MR Consolidation to RFQ, or click "New RFQ".
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} onClick={() => onOpen(row.id)} className="cursor-pointer transition-colors hover:bg-brand-50">
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
