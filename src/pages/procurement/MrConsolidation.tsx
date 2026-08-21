import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Boxes, CheckSquare, Square, Truck, FileSpreadsheet as FileQuote } from "lucide-react";
import { api, ApiError, type ListResponse } from "../../lib/apiClient";
import { useAuth } from "../../context/AuthContext";
import { useOptions } from "../../lib/useOptions";
import { FIELD_CLASS, LABEL_CLASS } from "../../components/CrudTable";
import { StatusBadge } from "../../components/DocumentScreen";

interface PoolBranchLine {
  branchId: string;
  branchName: string;
  mrId: string;
  mrNo: string;
  mrLineId: string;
  qty: number;
}

interface PoolEntry {
  itemId: string;
  itemCode: string;
  itemName: string;
  uomCode: string;
  totalQty: number;
  branches: PoolBranchLine[];
}

interface ConsolidationListRow {
  id: string;
  consolidationNo: string;
  consolidationDate: string;
  fulfillmentType: string;
  status: string;
  lines: { id: string }[];
}

interface ConsolidationLineDetail {
  id: string;
  itemId: string;
  qty: number;
  item: { code: string; name: string };
  mrLine?: { uom?: { code: string } };
  mr?: { mrNo: string; branch?: { id: string; code: string; name: string } };
}

interface ConsolidationDetail extends ConsolidationListRow {
  lines: ConsolidationLineDetail[];
}

/**
 * MR Consolidation: pull approved Material Request lines from across every
 * branch/company, group them by item, and combine the ones a head office
 * wants to act on together into one Consolidation record - then either
 * convert it to an RFQ (External - going to buy) or an inter-branch
 * Transfer (Internal - pulling from another branch's stock instead of
 * buying). There's no direct "convert to PO" shortcut here on purpose: a
 * consolidation always goes through the RFQ step first to compare vendor
 * quotes (see /rfqs/:id/convert-to-po for what happens after quotes are
 * in) - skipping that would defeat the point of consolidating demand
 * before buying.
 */
export default function MrConsolidation() {
  const { user, activeCompanyScope } = useAuth();
  const [view, setView] = useState<"list" | "pool" | "detail">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [consolidations, setConsolidations] = useState<ConsolidationListRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const allCompanyOptions = useOptions("/api/admin/companies", (c) => `${c.code} - ${c.name}`);
  const allBranchOptions = useOptions("/api/admin/branches", (b) => `${b.code} - ${b.name}`);
  const warehouseOptions = useOptions("/api/admin/warehouses", (w) => `${w.code} - ${w.name}`);

  const scopedCompanyId = activeCompanyScope && activeCompanyScope !== "GLOBAL" ? activeCompanyScope : null;
  const myCompanies = user?.companies;
  const companyOptions = myCompanies && myCompanies.length > 0
    ? myCompanies.map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }))
    : allCompanyOptions;

  function loadList() {
    setLoadingList(true);
    api
      .get<ListResponse<ConsolidationListRow>>("/api/procurement/mr-consolidations")
      .then((res) => setConsolidations(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load consolidations"))
      .finally(() => setLoadingList(false));
  }

  useEffect(() => {
    if (view === "list") loadList();
  }, [view]);

  return (
    <div className="mx-auto max-w-6xl">
      {view === "list" && (
        <ListView
          rows={consolidations}
          loading={loadingList}
          error={error}
          onOpenPool={() => {
            setError(null);
            setView("pool");
          }}
          onOpenDetail={(id) => {
            setError(null);
            setSelectedId(id);
            setView("detail");
          }}
        />
      )}
      {view === "pool" && (
        <PoolView
          companyOptions={companyOptions}
          scopedCompanyId={scopedCompanyId}
          onBack={() => setView("list")}
          onCreated={() => setView("list")}
        />
      )}
      {view === "detail" && (
        <DetailView
          id={selectedId}
          branchOptions={allBranchOptions}
          warehouseOptions={warehouseOptions}
          companyOptions={companyOptions}
          scopedCompanyId={scopedCompanyId}
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
  onOpenPool,
  onOpenDetail,
}: {
  rows: ConsolidationListRow[];
  loading: boolean;
  error: string | null;
  onOpenPool: () => void;
  onOpenDetail: (id: string) => void;
}) {
  return (
    <>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-navy-900">MR Consolidation</h1>
          <p className="mt-1 text-sm text-gray-500">
            Combine approved Material Request lines from different branches or companies into one consolidation,
            then convert it to an RFQ (buy externally) or a Transfer (pull from another branch's stock).
          </p>
        </div>
        <button
          onClick={onOpenPool}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          <Boxes size={16} />
          New Consolidation
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Consolidation No.</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Date</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Fulfillment</th>
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
                  No consolidations yet - click "New Consolidation" to pull approved MR lines from the pool.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onOpenDetail(row.id)}
                  className="cursor-pointer transition-colors hover:bg-brand-50"
                >
                  <td className="px-4 py-2.5 font-medium text-navy-900">{row.consolidationNo}</td>
                  <td className="px-4 py-2.5 text-navy-900">{new Date(row.consolidationDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-navy-900">{row.fulfillmentType}</td>
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

function PoolView({
  companyOptions,
  scopedCompanyId,
  onBack,
  onCreated,
}: {
  companyOptions: { value: string; label: string }[];
  scopedCompanyId: string | null;
  onBack: () => void;
  onCreated: () => void;
}) {
  const [pool, setPool] = useState<PoolEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fulfillmentType, setFulfillmentType] = useState<"External" | "Internal">("External");
  const [companyId, setCompanyId] = useState(scopedCompanyId ?? "");
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    api
      .get<{ data: PoolEntry[] }>("/api/procurement/material-requests/consolidation-pool")
      .then((res) => setPool(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load the consolidation pool"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function toggleLine(mrLineId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(mrLineId)) next.delete(mrLineId);
      else next.add(mrLineId);
      return next;
    });
  }

  function toggleItem(entry: PoolEntry) {
    const ids = entry.branches.map((b) => b.mrLineId);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  async function handleCreate() {
    if (!companyId || selected.size === 0) return;
    setCreating(true);
    setError(null);
    try {
      await api.post("/api/procurement/mr-consolidations", {
        companyId,
        fulfillmentType,
        mrLineIds: Array.from(selected),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create consolidation");
    } finally {
      setCreating(false);
    }
  }

  const selectedCount = selected.size;

  return (
    <>
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-navy-900">
        <ArrowLeft size={16} />
        Back to list
      </button>

      <div className="mb-5 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <h1 className="text-xl font-bold text-navy-900">New Consolidation</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Select the MR lines to combine (any branch, any company's approved MRs). Already-expired or
          already-consolidated lines don't appear here.
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
          <label className={LABEL_CLASS}>Fulfillment type</label>
          <select
            className={FIELD_CLASS}
            value={fulfillmentType}
            onChange={(e) => setFulfillmentType(e.target.value as "External" | "Internal")}
          >
            <option value="External">External - buy it (RFQ/PO)</option>
            <option value="Internal">Internal - pull from another branch's stock (Transfer)</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={handleCreate}
            disabled={creating || !companyId || selectedCount === 0}
            className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            {creating ? "Creating..." : `Create Consolidation (${selectedCount} line${selectedCount === 1 ? "" : "s"})`}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="px-4 py-6 text-center text-gray-400">Loading pool...</div>
        ) : pool.length === 0 ? (
          <div className="px-4 py-6 text-center text-gray-400">
            No approved MR lines waiting to be consolidated right now.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pool.map((entry) => {
              const ids = entry.branches.map((b) => b.mrLineId);
              const allSelected = ids.every((id) => selected.has(id));
              const someSelected = ids.some((id) => selected.has(id));
              return (
                <div key={entry.itemId} className="px-4 py-3">
                  <div
                    className="flex cursor-pointer items-center gap-2 font-semibold text-navy-900"
                    onClick={() => toggleItem(entry)}
                  >
                    {allSelected ? (
                      <CheckSquare size={16} className="text-brand-600" />
                    ) : (
                      <Square size={16} className={someSelected ? "text-brand-400" : "text-gray-300"} />
                    )}
                    {entry.itemCode} - {entry.itemName}
                    <span className="ml-auto text-xs font-normal text-gray-500">
                      Total {entry.totalQty} {entry.uomCode}
                    </span>
                  </div>
                  <div className="mt-2 ml-6 space-y-1.5">
                    {entry.branches.map((b) => (
                      <div
                        key={b.mrLineId}
                        onClick={() => toggleLine(b.mrLineId)}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                      >
                        {selected.has(b.mrLineId) ? (
                          <CheckSquare size={14} className="text-brand-600" />
                        ) : (
                          <Square size={14} className="text-gray-300" />
                        )}
                        <span className="font-medium text-navy-900">{b.branchName}</span>
                        <span>{b.mrNo}</span>
                        <span className="ml-auto">
                          {b.qty} {entry.uomCode}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function DetailView({
  id,
  branchOptions,
  warehouseOptions,
  companyOptions,
  scopedCompanyId,
  onBack,
}: {
  id: string | null;
  branchOptions: { value: string; label: string }[];
  warehouseOptions: { value: string; label: string }[];
  companyOptions: { value: string; label: string }[];
  scopedCompanyId: string | null;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<ConsolidationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);

  function load() {
    if (!id) return;
    setLoading(true);
    api
      .get<ConsolidationDetail>(`/api/procurement/mr-consolidations/${id}`)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load consolidation"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  if (!id) {
    return (
      <>
        <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-navy-900">
          <ArrowLeft size={16} />
          Back to list
        </button>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-gray-400 shadow-sm">
          No consolidation selected.
        </div>
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
              <h1 className="text-xl font-bold text-navy-900">{detail.consolidationNo}</h1>
              <p className="mt-0.5 text-sm text-gray-500">
                {detail.fulfillmentType} fulfillment - {new Date(detail.consolidationDate).toLocaleDateString()}
              </p>
            </div>
            <StatusBadge status={detail.status} />
          </div>

          <div className="mb-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Item</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Branch</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">MR No.</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {detail.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2.5 text-navy-900">{l.item.code} - {l.item.name}</td>
                    <td className="px-4 py-2.5 text-navy-900">{l.mr?.branch ? `${l.mr.branch.code} - ${l.mr.branch.name}` : "-"}</td>
                    <td className="px-4 py-2.5 text-navy-900">{l.mr?.mrNo ?? "-"}</td>
                    <td className="px-4 py-2.5 text-navy-900">
                      {l.qty} {l.mrLine?.uom?.code ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {detail.status === "Draft" && detail.fulfillmentType === "External" && (
            <ConvertToRfqPanel
              consolidationId={detail.id}
              companyOptions={companyOptions}
              branchOptions={branchOptions}
              scopedCompanyId={scopedCompanyId}
              onDone={(msg) => {
                setActionResult(msg);
                load();
              }}
            />
          )}

          {detail.status === "Draft" && detail.fulfillmentType === "Internal" && (
            <ConvertToTransferPanel
              consolidationId={detail.id}
              branchOptions={branchOptions}
              warehouseOptions={warehouseOptions}
              distinctBranches={Array.from(
                new Map(
                  detail.lines
                    .filter((l) => l.mr?.branch)
                    .map((l) => [l.mr!.branch!.id, l.mr!.branch!])
                ).values()
              )}
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

function ConvertToRfqPanel({
  consolidationId,
  companyOptions,
  branchOptions,
  scopedCompanyId,
  onDone,
}: {
  consolidationId: string;
  companyOptions: { value: string; label: string }[];
  branchOptions: { value: string; label: string }[];
  scopedCompanyId: string | null;
  onDone: (msg: string) => void;
}) {
  const [companyId, setCompanyId] = useState(scopedCompanyId ?? "");
  const [branchId, setBranchId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConvert() {
    if (!companyId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ rfq: { rfqNo: string } }>(`/api/procurement/mr-consolidations/${consolidationId}/convert-to-rfq`, {
        companyId,
        branchId: branchId || undefined,
        notes: notes || undefined,
      });
      onDone(`Converted to RFQ ${res.rfq.rfqNo}. The RFQ screen (send/record quotes/convert to PO) is coming in the next build round.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not convert to RFQ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5 border-b border-gray-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
        <FileQuote size={12} />
        Convert to RFQ
      </div>
      <p className="mb-3 text-xs text-gray-500">
        Sends every line on this consolidation into one RFQ so you can collect and compare vendor quotes before
        buying. The RFQ can be split into per-vendor Purchase Orders once quotes are selected.
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
      <button
        onClick={handleConvert}
        disabled={saving || !companyId}
        className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? "Converting..." : "Convert to RFQ"}
      </button>
    </div>
  );
}

function ConvertToTransferPanel({
  consolidationId,
  branchOptions,
  warehouseOptions,
  distinctBranches,
  onDone,
}: {
  consolidationId: string;
  branchOptions: { value: string; label: string }[];
  warehouseOptions: { value: string; label: string }[];
  distinctBranches: { id: string; code: string; name: string }[];
  onDone: (msg: string) => void;
}) {
  const [fromBranchId, setFromBranchId] = useState("");
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [transitWarehouseId, setTransitWarehouseId] = useState("");
  const [toWarehouseByBranch, setToWarehouseByBranch] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () =>
      !!fromBranchId &&
      !!fromWarehouseId &&
      !!transitWarehouseId &&
      distinctBranches.every((b) => !!toWarehouseByBranch[b.id]),
    [fromBranchId, fromWarehouseId, transitWarehouseId, toWarehouseByBranch, distinctBranches]
  );

  async function handleConvert() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ stockTransfers: { transferNo: string }[] }>(
        `/api/procurement/mr-consolidations/${consolidationId}/convert-to-transfer`,
        { fromBranchId, fromWarehouseId, transitWarehouseId, toWarehouseByBranch }
      );
      const nos = res.stockTransfers.map((t) => t.transferNo).join(", ");
      onDone(`Converted to Transfer(s): ${nos}. The Stock Transfer screen to process them is coming in a later build round.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not convert to transfer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5 border-b border-gray-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
        <Truck size={12} />
        Convert to Transfer
      </div>
      <p className="mb-3 text-xs text-gray-500">
        Creates one inter-branch transfer per destination branch, all sourced from a single supplying branch and
        warehouse. The transit warehouse must be flagged "In transit".
      </p>
      {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={LABEL_CLASS}>Supplying branch</label>
          <select className={FIELD_CLASS} value={fromBranchId} onChange={(e) => setFromBranchId(e.target.value)}>
            <option value="">Select...</option>
            {branchOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>Supplying warehouse</label>
          <select className={FIELD_CLASS} value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)}>
            <option value="">Select...</option>
            {warehouseOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>Transit warehouse</label>
          <select className={FIELD_CLASS} value={transitWarehouseId} onChange={(e) => setTransitWarehouseId(e.target.value)}>
            <option value="">Select...</option>
            {warehouseOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {distinctBranches.length > 0 && (
        <div className="mt-4">
          <div className={LABEL_CLASS}>Destination warehouse per requesting branch</div>
          <div className="space-y-2">
            {distinctBranches.map((b) => (
              <div key={b.id} className="flex items-center gap-3">
                <span className="w-48 shrink-0 text-sm font-medium text-navy-900">
                  {b.code} - {b.name}
                </span>
                <select
                  className={FIELD_CLASS}
                  value={toWarehouseByBranch[b.id] ?? ""}
                  onChange={(e) => setToWarehouseByBranch((prev) => ({ ...prev, [b.id]: e.target.value }))}
                >
                  <option value="">Select destination warehouse...</option>
                  {warehouseOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleConvert}
        disabled={saving || !canSubmit}
        className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? "Converting..." : "Convert to Transfer"}
      </button>
    </div>
  );
}
