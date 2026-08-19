import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, ChevronRight, Plus, Search, FileSpreadsheet, FileText } from "lucide-react";
import { api, ApiError, type ListResponse } from "../lib/apiClient";
import { DocumentAttachments } from "./DocumentAttachments";

export interface CrudColumn<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
}

export interface CrudFormField {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "checkbox" | "date";
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface CrudTableProps<T extends Record<string, any>> {
  title: string;
  description?: string;
  basePath: string;
  columns: CrudColumn<T>[];
  formFields: CrudFormField[];
  /** Called after a successful create/update, e.g. to refresh a dependent dropdown elsewhere on the page. */
  onChanged?: () => void;
  /** Enables the upload/list/download/delete Attachments panel on the edit screen (new records must be saved first - see DocumentAttachments.tsx). */
  attachments?: { moduleCode: string };
  /** Renders an arbitrary extra panel below Details on the edit screen (existing records only) - e.g. branch membership on Price Groups, GL account mapping on Items. */
  extraPanel?: (ctx: { editingId: string; form: Record<string, any> }) => ReactNode;
  /** Extra query-string fragment (e.g. "itemType=Stock,Semi-finished") applied only to the list GET, never to create/update/delete - lets several screens share one basePath as pre-filtered views of the same table. */
  extraQuery?: string;
  /** Prefills the "Add" form instead of starting blank - e.g. defaulting itemType on a pre-filtered screen. */
  createDefaults?: Record<string, any>;
}

function statusPill(status: string) {
  const isActive = status.toLowerCase() === "active";
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
        isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-gray-100 text-gray-500"
      }`}
    >
      {status}
    </span>
  );
}

// Shared field styling - every input/select in the app should look and
// behave the same: a clearly visible border, and an unmistakable focus
// ring so it's obvious which box you're typing into. Exported so the
// smaller hand-built panels (DocumentAttachments, PriceGroupBranches,
// ItemGlMappingPanel, etc.) stay visually consistent with this component.
export const FIELD_CLASS =
  "w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm text-navy-900 shadow-sm outline-none transition-colors placeholder:text-gray-400 hover:border-gray-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-100";
export const LABEL_CLASS = "mb-1.5 block text-[13px] font-bold text-navy-900";

// A run of consecutive checkbox fields (e.g. the Sales/Manufacture/Factory/
// Purchase/POS/Expenses toggles on an item) reads much better as one
// full-width row of chips than as six separate two-column grid cells
// scattered through the form. This groups the flat formFields array into
// renderable chunks without needing screens to opt in explicitly - just
// place related checkboxes next to each other in the field list.
type FieldGroup = { kind: "checkboxGroup"; fields: CrudFormField[] } | { kind: "field"; field: CrudFormField };

function groupFormFields(fields: CrudFormField[]): FieldGroup[] {
  const groups: FieldGroup[] = [];
  for (const f of fields) {
    const last = groups[groups.length - 1];
    if (f.type === "checkbox") {
      if (last && last.kind === "checkboxGroup") {
        last.fields.push(f);
      } else {
        groups.push({ kind: "checkboxGroup", fields: [f] });
      }
    } else {
      groups.push({ kind: "field", field: f });
    }
  }
  return groups;
}

/**
 * Generic list + transaction-screen pair for any of the backend's
 * crudRouter-backed master-data screens. Landing on a screen shows the
 * list ("lines"); clicking a record or "Add" opens a dedicated
 * transaction screen for that record, same pattern used across the app
 * rather than a side panel.
 */
export function CrudTable<T extends Record<string, any>>({
  title,
  description,
  basePath,
  columns,
  formFields,
  onChanged,
  attachments,
  extraPanel,
  extraQuery,
  createDefaults,
}: CrudTableProps<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "transaction">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounced so every keystroke doesn't fire a request - the backend
  // already does an OR-contains search on code/name (see crudFactory.ts's
  // GET / handler), this just wires a box to it.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const query = `pageSize=200${extraQuery ? `&${extraQuery}` : ""}${
        debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ""
      }`;
      const res = await api.get<ListResponse<T>>(`${basePath}?${query}`);
      setRows(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    setView("list");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath, extraQuery, debouncedSearch]);

  const singular = title.replace(/s$/, "");
  const statusCol = columns.find((c) => c.key === "status");
  const titleCol = columns[1] ?? columns[0];

  function exportText(col: CrudColumn<T>, row: T): string {
    const val = col.render ? col.render(row) : row[col.key];
    if (val === undefined || val === null || val === "") return "";
    return String(val);
  }

  function exportCsv() {
    const headerLine = columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(",");
    const lines = rows.map((row) =>
      columns.map((c) => `"${exportText(c, row).replace(/"/g, '""')}"`).join(",")
    );
    const csv = [headerLine, ...lines].join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "-").toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const win = window.open("", "_blank");
    if (!win) return;
    const headerCells = columns
      .map((c) => `<th style="padding:6px 10px;border:1px solid #ddd;background:#f3f4f6;text-align:left;">${c.label}</th>`)
      .join("");
    const bodyRows = rows
      .map(
        (row) =>
          `<tr>${columns
            .map((c) => `<td style="padding:6px 10px;border:1px solid #ddd;">${exportText(c, row) || "-"}</td>`)
            .join("")}</tr>`
      )
      .join("");
    win.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>body{font-family:Arial,Helvetica,sans-serif;padding:24px;} table{border-collapse:collapse;width:100%;font-size:12px;} h2{margin-bottom:4px;}</style>
        </head>
        <body>
          <h2>${title}</h2>
          <table>
            <thead><tr>${headerCells}</tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  function openCreate() {
    setEditingId(null);
    setForm(createDefaults ?? {});
    setFormError(null);
    setView("transaction");
  }

  function openEdit(row: T) {
    setEditingId(row.id);
    setForm({ ...row });
    setFormError(null);
    setView("transaction");
  }

  function backToList() {
    setView("list");
  }

  async function handleToggleStatus() {
    if (!editingId) return;
    const isActive = String(form[statusCol!.key] ?? "").toLowerCase() === "active";
    setTogglingStatus(true);
    setFormError(null);
    try {
      const action = isActive ? "deactivate" : "activate";
      const updated = await api.post<T>(`${basePath}/${editingId}/${action}`);
      setForm((prev) => ({ ...prev, ...updated }));
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not change status");
    } finally {
      setTogglingStatus(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setFormError(null);
    try {
      const payload: Record<string, any> = {};
      for (const f of formFields) {
        if (form[f.key] === "" || form[f.key] === undefined) continue;
        payload[f.key] = f.type === "number" ? Number(form[f.key]) : form[f.key];
      }
      if (editingId) {
        await api.put(`${basePath}/${editingId}`, payload);
      } else {
        await api.post(basePath, payload);
      }
      setView("list");
      await load();
      onChanged?.();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (view === "transaction") {
    return (
      <div className="p-6">
        <button
          onClick={backToList}
          className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-600"
        >
          <ArrowLeft size={14} />
          Back to {title.toLowerCase()}
        </button>

        <h2 className="text-lg font-semibold text-navy-900">
          {editingId ? String(form[titleCol.key] ?? singular) : `New ${singular}`}
        </h2>
        <p className="mb-4 text-xs text-gray-500">{singular} record</p>

        {formError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 border-b border-gray-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
            Details
          </div>
          <div className="grid grid-cols-2 gap-4">
            {groupFormFields(formFields).map((g, gi) =>
              g.kind === "checkboxGroup" ? (
                <div
                  key={`checkbox-group-${gi}`}
                  className="col-span-2 flex flex-wrap gap-2 rounded-lg border-2 border-gray-200 bg-gray-50 p-3"
                >
                  {g.fields.map((f) => (
                    <label
                      key={f.key}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-colors ${
                        form[f.key]
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-gray-300 bg-white text-navy-900 hover:border-gray-400"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={!!form[f.key]}
                        onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.checked }))}
                        className="h-4 w-4 cursor-pointer rounded border-2 border-gray-300 text-brand-600 focus:ring-4 focus:ring-brand-100"
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
              ) : (
                <div key={g.field.key}>
                  <label className={LABEL_CLASS}>
                    {g.field.label}
                    {g.field.required && <span className="text-red-500"> *</span>}
                  </label>
                  {g.field.type === "select" ? (
                    <select
                      className={FIELD_CLASS}
                      value={form[g.field.key] ?? ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, [g.field.key]: e.target.value }))}
                    >
                      <option value="">Select...</option>
                      {g.field.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={g.field.type}
                      placeholder={g.field.placeholder}
                      className={FIELD_CLASS}
                      value={form[g.field.key] ?? ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, [g.field.key]: e.target.value }))}
                    />
                  )}
                </div>
              )
            )}
          </div>
        </div>

        {attachments && <DocumentAttachments moduleCode={attachments.moduleCode} recordId={editingId} />}
        {extraPanel && editingId && extraPanel({ editingId, form })}

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={backToList}
            className="rounded-lg border-2 border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-navy-900 transition-colors hover:border-gray-400 hover:bg-gray-50"
          >
            Cancel
          </button>
          {editingId && statusCol && (
            <button
              onClick={handleToggleStatus}
              disabled={togglingStatus}
              className={`ml-auto rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                String(form[statusCol.key] ?? "").toLowerCase() === "active"
                  ? "border-red-300 text-red-600 hover:bg-red-50"
                  : "border-emerald-300 text-emerald-600 hover:bg-emerald-50"
              }`}
            >
              {togglingStatus
                ? "Working..."
                : String(form[statusCol.key] ?? "").toLowerCase() === "active"
                ? "Disable"
                : "Enable"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-navy-900">{title}</h2>
      {description && <p className="mb-4 mt-1 text-xs text-gray-500">{description}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          <Plus size={14} />
          Add {singular}
        </button>

        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code or name..."
            className="w-56 rounded-lg border-2 border-gray-300 bg-white py-2 pl-8 pr-3 text-xs text-navy-900 shadow-sm outline-none transition-colors placeholder:text-gray-400 hover:border-gray-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="flex items-center gap-1.5 rounded-lg border-2 border-gray-300 px-3 py-2 text-xs font-semibold text-navy-900 transition-colors hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            title="Export the current list to Excel (CSV)"
          >
            <FileSpreadsheet size={14} />
            Excel
          </button>
          <button
            onClick={exportPdf}
            disabled={rows.length === 0}
            className="flex items-center gap-1.5 rounded-lg border-2 border-gray-300 px-3 py-2 text-xs font-semibold text-navy-900 transition-colors hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            title="Print/save the current list as a PDF"
          >
            <FileText size={14} />
            PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="px-4 py-6 text-center text-sm text-gray-400">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-400">Nothing here yet.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
                  >
                    {c.label}
                  </th>
                ))}
                <th className="w-8 px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => openEdit(row)}
                  className="group cursor-pointer transition-colors hover:bg-brand-50"
                >
                  {columns.map((c, ci) => {
                    const value = c.render ? c.render(row) : row[c.key];
                    return (
                      <td
                        key={c.key}
                        className={`max-w-xs truncate px-4 py-2.5 text-sm ${
                          ci === 0
                            ? "border-l-4 border-l-transparent font-medium text-navy-900 group-hover:border-l-brand-500"
                            : "text-gray-600"
                        }`}
                      >
                        {c === statusCol
                          ? statusPill(String(value ?? ""))
                          : value === undefined || value === null || value === ""
                          ? "-"
                          : String(value)}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2.5">
                    <ChevronRight
                      size={16}
                      className="shrink-0 text-gray-300 transition-colors group-hover:text-brand-600"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
