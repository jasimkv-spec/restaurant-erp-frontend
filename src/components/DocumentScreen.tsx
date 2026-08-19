import { useEffect, useState } from "react";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiError, type ListResponse } from "../lib/apiClient";
import { FIELD_CLASS, LABEL_CLASS } from "./CrudTable";

/**
 * Generic screen for transactional documents (Material Request, Purchase
 * Order, GRN, Stock Transfer, Stock Adjustment, ...) - a header + an
 * editable line-item grid + a Draft -> Submit -> Approve -> Post lifecycle,
 * plus Edit/Delete while a document is still in an editable status (see
 * editableStatuses/deletableStatuses - default just "Draft", matching every
 * module's own submit/approve routes which only accept a Draft document).
 *
 * Deliberately separate from CrudTable: masters are flat records with
 * enable/disable, documents are header+lines with a status workflow and
 * module-owned transition rules, so trying to force both shapes through one
 * component was worse than having two purpose-built ones. Every field in
 * headerFields/lineFields must already exist as a plain key on the
 * create/update payload - options for "select" fields are fetched by the
 * caller (useOptions) and passed in, same convention as CrudTable's
 * formFields. A "select" lineField can instead take optionsForRow to scope
 * choices per-row (e.g. only the packing units configured for the item
 * picked on that particular line).
 */

export interface DocFieldConfig {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "date" | "textarea" | "readonly";
  options?: { value: string; label: string }[];
  /** Per-row options for a "select" lineField, e.g. scoped to the item picked on that row. Takes priority over options when present. */
  optionsForRow?: (row: Record<string, any>) => { value: string; label: string }[];
  /** For type "readonly" - a display-only derived value (e.g. an item's base UOM), never sent back to the server. */
  computed?: (row: Record<string, any>) => string;
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

/** "2026-08-19T12:00:00.000Z" -> "2026-08-19", so it can seed an <input type="date">. Passes through anything that isn't a parseable date untouched. */
function toDateInputValue(value: any): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/**
 * Resolves what to show for a select-type field's value in a read-only
 * context (detail view). Prefers the matching relation object the API
 * already included (e.g. a lineField "itemId" pairs with a "item" relation,
 * "uomId" with "uom") over an options-list lookup, since a line/header can
 * reference a record (an item, a uom, a branch) that isn't in the option
 * list actually loaded on screen (paged out, since made inactive, etc).
 */
function resolveDisplayValue(f: DocFieldConfig, row: Record<string, any>): string {
  const relationKey = f.key.endsWith("Id") ? f.key.slice(0, -2) : null;
  const relation = relationKey ? row[relationKey] : null;
  if (relation && typeof relation === "object") {
    if (relation.code && relation.name) return `${relation.code} - ${relation.name}`;
    if (relation.code) return relation.code;
    if (relation.name) return relation.name;
  }
  return f.options?.find((o) => o.value === row[f.key])?.label ?? row[f.key] ?? "-";
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
  editableStatuses = ["Draft"],
  deletableStatuses = ["Draft"],
  onLineFieldChange,
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
  /** Statuses that still allow editing the whole document (header + lines). Default: Draft only, matching every module's submit route. */
  editableStatuses?: string[];
  /** Statuses that still allow deleting the document outright. Default: Draft only. */
  deletableStatuses?: string[];
  /** Fires after any line field changes, with the row's latest values - lets the caller react (e.g. fetch that item's packing-unit options when itemId changes). */
  onLineFieldChange?: (index: number, key: string, value: any, row: Record<string, any>) => void;
}) {
  const [view, setView] = useState<"list" | "form" | "detail">("list");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [header, setHeader] = useState<Record<string, any>>(createDefaults ?? {});
  const [lines, setLines] = useState<Record<string, any>[]>([{ ...emptyLine }]);
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<any | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  function fieldInputValue(row: Record<string, any>, f: DocFieldConfig) {
    const v = row[f.key];
    return f.type === "date" ? toDateInputValue(v) : v ?? "";
  }

  function openCreate() {
    setEditingId(null);
    setHeader(createDefaults ?? {});
    setLines([{ ...emptyLine }]);
    setError(null);
    setView("form");
  }

  function openEdit(record: any) {
    setEditingId(record.id);
    const nextHeader: Record<string, any> = {};
    for (const f of headerFields) nextHeader[f.key] = fieldInputValue(record, f);
    setHeader(nextHeader);
    const recordLines = (record.lines ?? []).length ? record.lines : [emptyLine];
    setLines(
      recordLines.map((line: any) => {
        const row: Record<string, any> = {};
        for (const f of lineFields) if (f.type !== "readonly") row[f.key] = fieldInputValue(line, f);
        return row;
      })
    );
    setError(null);
    setView("form");
  }

  async function openDetail(id: string) {
    setError(null);
    setDetail(null);
    setConfirmingDelete(false);
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
    setConfirmingDelete(false);
  }

  function setLineValue(index: number, key: string, value: any) {
    setLines((prev) => {
      const next = prev.map((l, i) => (i === index ? { ...l, [key]: value } : l));
      onLineFieldChange?.(index, key, value, next[index]);
      return next;
    });
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
          if (f.type === "readonly") continue;
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
      if (editingId) {
        await api.put(`${basePath}/${editingId}`, { ...cleanHeader, lines: cleanLines });
      } else {
        await api.post(basePath, { ...cleanHeader, lines: cleanLines });
      }
      setView("list");
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this document");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!detail) return;
    setDeleting(true);
    setError(null);
    try {
      await api.del(`${basePath}/${detail.id}`);
      setView("list");
      setConfirmingDelete(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this document");
      setConfirmingDelete(false);
    } finally {
      setDeleting(false);
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

  function renderFieldInput(f: DocFieldConfig, row: Record<string, any>, onChange: (value: any) => void, rowOptions?: { value: string; label: string }[]) {
    if (f.type === "readonly") {
      return <div className="px-1 py-2 text-sm text-gray-500">{f.computed?.(row) ?? "-"}</div>;
    }
    const disabledCls = f.disabled ? "bg-gray-100 text-gray-500" : "";
    if (f.type === "select") {
      const opts = rowOptions ?? f.options ?? [];
      return (
        <select
          className={`${FIELD_CLASS} ${disabledCls}`}
          value={row[f.key] ?? ""}
          disabled={f.disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select...</option>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    if (f.type === "textarea") {
      return (
        <textarea
          className={`${FIELD_CLASS} ${disabledCls}`}
          rows={2}
          placeholder={f.placeholder}
          value={row[f.key] ?? ""}
          disabled={f.disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }
    return (
      <input
        type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
        className={`${FIELD_CLASS} ${disabledCls}`}
        placeholder={f.placeholder}
        value={row[f.key] ?? ""}
        disabled={f.disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  const hasBaseQty = (detail?.lines ?? []).some((l: any) => l.baseQty != null);

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

      {view === "form" && (
        <>
          <button onClick={backToList} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-navy-900">
            <ArrowLeft size={16} />
            Back to list
          </button>
          <h1 className="mb-1 text-xl font-bold text-navy-900">
            {editingId ? `Edit ${title.replace(/s$/, "")}` : `New ${title.replace(/s$/, "")}`}
          </h1>
          <p className="mb-5 text-sm text-gray-500">{description}</p>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {headerFields.map((f) => (
                <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2 lg:col-span-3" : ""}>
                  <label className={LABEL_CLASS}>
                    {f.label}
                    {f.required && <span className="text-red-500"> *</span>}
                  </label>
                  {renderFieldInput(f, header, (value) => setHeader((prev) => ({ ...prev, [f.key]: value })))}
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
                          {renderFieldInput(f, line, (value) => setLineValue(i, f.key, value), f.optionsForRow?.(line))}
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
              {saving ? "Saving..." : editingId ? "Save changes" : "Save as Draft"}
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
                  {detail.title && <span className="text-sm text-gray-500">- {detail.title}</span>}
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
                  {editableStatuses.includes(detail.status) && (
                    <button
                      onClick={() => openEdit(detail)}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <Pencil size={14} />
                      Edit
                    </button>
                  )}
                  {deletableStatuses.includes(detail.status) && (
                    <button
                      onClick={() => setConfirmingDelete(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {confirmingDelete && (
                <div className="mb-5 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <div className="text-sm text-red-700">Delete this document permanently? This can't be undone.</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmingDelete(false)}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              )}

              <div className="mb-5 grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
                {headerFields.map((f) => (
                  <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2 lg:col-span-3" : ""}>
                    <div className={LABEL_CLASS}>{f.label}</div>
                    <div className="whitespace-pre-wrap text-sm text-navy-900">
                      {f.type === "select" ? resolveDisplayValue(f, detail) : String(detail[f.key] ?? "-")}
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
                        {hasBaseQty && (
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
                              {f.type === "readonly"
                                ? f.computed?.(line) ?? "-"
                                : f.type === "select"
                                  ? resolveDisplayValue(f, line)
                                  : String(line[f.key] ?? "-")}
                            </td>
                          ))}
                          {hasBaseQty && (
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
