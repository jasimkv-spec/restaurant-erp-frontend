import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { api, ApiError, type ListResponse } from "../lib/apiClient";
import { FIELD_CLASS, LABEL_CLASS } from "./CrudTable";

/**
 * Generic screen for transactional documents (Material Request, Purchase
 * Order, GRN, Stock Transfer, Stock Adjustment, ...) - a header + an
 * editable line-item grid + a Draft -> Submit -> Approve -> Post lifecycle.
 *
 * Deliberately separate from CrudTable: masters are flat records with
 * enable/disable, documents are header+lines with a status workflow and no
 * generic PUT (each module's routes.ts owns its own transition rules), so
 * trying to force both shapes through one component was worse than having
 * two purpose-built ones. Every field in headerFields/lineFields must
 * already exist as a plain key on the create payload - options for "select"
 * fields are fetched by the caller (useOptions) and passed in, same
 * convention as CrudTable's formFields.
 */

export interface DocFieldConfig {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "date";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  /** Greys the field out and blocks input - e.g. a branch that's auto-selected because the user only has access to one. */
  disabled?: boolean;
}

export interface LifecycleStep {
  /** Only offered when the open record's status matches this. */
  fromStatus: string;
  /** Appended as POST {basePath}/{id}/{action}. */
  action: string;
  label: string;
  /** Optional extra confirm text shown before firing. */
  confirmMessage?: string;
}

const STATUS_STYLES: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700 border-gray-200",
  Submitted: "bg-amber-50 text-amber-700 border-amber-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Posted: "bg-brand-50 text-brand-700 border-brand-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
  Cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700 border-gray-200"
      }`}
    >
      {status}
    </span>
  );
}

const PRIORITY_STYLES: Record<string, string> = {
  Low: "bg-gray-100 text-gray-600 border-gray-200",
  Normal: "bg-brand-50 text-brand-700 border-brand-200",
  High: "bg-amber-50 text-amber-700 border-amber-200",
  Urgent: "bg-red-50 text-red-700 border-red-200",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        PRIORITY_STYLES[priority] ?? "bg-gray-100 text-gray-700 border-gray-200"
      }`}
    >
      {priority}
    </span>
  );
}

export function DocumentScreen({
  title,
  description,
  basePath,
  listColumns,
  headerFields,
  lineFields,
  emptyLine,
  lifecycle,
  createDefaults,
}: {
  title: string;
  description: string;
  basePath: string;
  listColumns: { key: string; label: string; render?: (row: any) => any }[];
  headerFields: DocFieldConfig[];
  lineFields: DocFieldConfig[];
  emptyLine: Record<string, any>;
  lifecycle: LifecycleStep[];
  createDefaults?: Record<string, any>;
}) {
  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [header, setHeader] = useState<Record<string, any>>(createDefaults ?? {});
  const [lines, setLines] = useState<Record<string, any>[]>([{ ...emptyLine }]);
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<any | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ListResponse<any>>(`${basePath}?pageSize=200`);
      setRows(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load list");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath]);

  function openCreate() {
    setHeader(createDefaults ?? {});
    setLines([{ ...emptyLine }]);
    setError(null);
    setView("create");
  }

  async function openDetail(id: string) {
    setError(null);
    setDetail(null);
    setView("detail");
    try {
      const record = await api.get<any>(`${basePath}/${id}`);
      setDetail(record);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this record");
    }
  }

  function backToList() {
    setView("list");
    setDetail(null);
    setError(null);
  }

  function setLineValue(index: number, key: string, value: any) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [key]: value } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { ...emptyLine }]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const cleanLines = lines.map((l) => {
        const out: Record<string, any> = {};
        for (const f of lineFields) {
          const v = l[f.key];
          if (v === "" || v === undefined || v === null) continue;
          out[f.key] = f.type === "number" ? Number(v) : v;
        }
        return out;
      });
      const cleanHeader: Record<string, any> = {};
      for (const f of headerFields) {
        const v = header[f.key];
        if (v === "" || v === undefined || v === null) continue;
        cleanHeader[f.key] = f.type === "number" ? Number(v) : v;
      }
      await api.post(basePath, { ...cleanHeader, lines: cleanLines });
      setView("list");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this document");
    } finally {
      setSaving(false);
    }
  }

  async function runLifecycleAction(step: LifecycleStep) {
    if (!detail) return;
    if (step.confirmMessage && !window.confirm(step.confirmMessage)) return;
    setActionBusy(step.action);
    setError(null);
    try {
      const updated = await api.post<any>(`${basePath}/${detail.id}/${step.action}`, {});
      setDetail(updated);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not ${step.label.toLowerCase()}`);
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      {view === "list" && (
        <>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-navy-900">{title}</h1>
              <p className="mt-1 text-sm text-gray-500">{description}</p>
            </div>
            <button
              onClick={openCreate}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              <Plus size={16} />
              New
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {listColumns.map((c) => (
                    <th key={c.key} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={listColumns.length} className="px-4 py-6 text-center text-gray-400">
                      Loading...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={listColumns.length} className="px-4 py-6 text-center text-gray-400">
                      No records yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => openDetail(row.id)}
                      className="cursor-pointer transition-colors hover:bg-brand-50"
                    >
                      {listColumns.map((c) => (
                        <td key={c.key} className="px-4 py-2.5 text-navy-900">
                          {c.render ? c.render(row) : c.key === "status" ? <StatusBadge status={row.status} /> : String(row[c.key] ?? "-")}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === "create" && (
        <>
          <button onClick={backToList} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-navy-900">
            <ArrowLeft size={16} />
            Back to list
          </button>
          <h1 className="mb-1 text-xl font-bold text-navy-900">New {title.replace(/s$/, "")}</h1>
          <p className="mb-5 text-sm text-gray-500">{description}</p>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {headerFields.map((f) => (
                <div key={f.key}>
                  <label className={LABEL_CLASS}>
                    {f.label}
                    {f.required && <span className="text-red-500"> *</span>}
                  </label>
                  {f.type === "select" ? (
                    <select
                      className={`${FIELD_CLASS} ${f.disabled ? "bg-gray-100 text-gray-500" : ""}`}
                      value={header[f.key] ?? ""}
                      disabled={f.disabled}
                      onChange={(e) => setHeader((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    >
                      <option value="">Select...</option>
                      {(f.options ?? []).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
                      className={`${FIELD_CLASS} ${f.disabled ? "bg-gray-100 text-gray-500" : ""}`}
                      placeholder={f.placeholder}
                      value={header[f.key] ?? ""}
                      disabled={f.disabled}
                      onChange={(e) => setHeader((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Lines</div>
              <button
                onClick={addLine}
                className="flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
              >
                <Plus size={13} />
                Add line
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {lineFields.map((f) => (
                      <th key={f.key} className="px-2 pb-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        {f.label}
                      </th>
                    ))}
                    <th></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.map((line, i) => (
                    <tr key={i}>
                      {lineFields.map((f) => (
                        <td key={f.key} className="px-2 py-1.5">
                          {f.type === "select" ? (
                            <select
                              className={FIELD_CLASS}
                              value={line[f.key] ?? ""}
                              onChange={(e) => setLineValue(i, f.key, e.target.value)}
                            >
                              <option value="">Select...</option>
                              {(f.options ?? []).map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
                              className={FIELD_CLASS}
                              value={line[f.key] ?? ""}
                              onChange={(e) => setLineValue(i, f.key, e.target.value)}
                            />
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-1.5">
                        <button
                          onClick={() => removeLine(i)}
                          disabled={lines.length === 1}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={backToList} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save as Draft"}
            </button>
          </div>
        </>
      )}

      {view === "detail" && (
        <>
          <button onClick={backToList} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-navy-900">
            <ArrowLeft size={16} />
            Back to list
          </button>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          {!detail ? (
            <div className="py-10 text-center text-gray-400">Loading...</div>
          ) : (
            <>
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-navy-900">{detail.mrNo ?? detail.poNo ?? detail.grnNo ?? detail.transferNo ?? detail.adjustmentNo ?? detail.id}</h1>
                  <StatusBadge status={detail.status} />
                </div>
                <div className="flex gap-2">
                  {lifecycle
                    .filter((step) => step.fromStatus === detail.status)
                    .map((step) => (
                      <button
                        key={step.action}
                        onClick={() => runLifecycleAction(step)}
                        disabled={actionBusy === step.action}
                        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
                      >
                        {actionBusy === step.action ? "..." : step.label}
                      </button>
                    ))}
                </div>
              </div>

              <div className="mb-5 grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
                {headerFields.map((f) => (
                  <div key={f.key}>
                    <div className={LABEL_CLASS}>{f.label}</div>
                    <div className="text-sm text-navy-900">
                      {f.type === "select"
                        ? f.options?.find((o) => o.value === detail[f.key])?.label ?? detail[f.key] ?? "-"
                        : String(detail[f.key] ?? "-")}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 border-b border-gray-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-700">Lines</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        {lineFields.map((f) => (
                          <th key={f.key} className="px-2 pb-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            {f.label}
                          </th>
                        ))}
                        {(detail.lines ?? []).some((l: any) => l.baseQty != null) && (
                          <th className="px-2 pb-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            In base unit
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(detail.lines ?? []).map((line: any, i: number) => (
                        <tr key={line.id ?? i}>
                          {lineFields.map((f) => (
                            <td key={f.key} className="px-2 py-1.5 text-navy-900">
                              {f.type === "select"
                                ? line.item
                                  ? `${line.item.code} - ${line.item.name}`
                                  : f.options?.find((o) => o.value === line[f.key])?.label ?? line[f.key] ?? "-"
                                : String(line[f.key] ?? "-")}
                            </td>
                          ))}
                          {(detail.lines ?? []).some((l: any) => l.baseQty != null) && (
                            <td className="px-2 py-1.5 text-gray-500">
                              {line.baseQty != null
                                ? `${line.baseQty} ${line.item?.baseUom?.code ?? ""}`
                                : "no conversion set up"}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
