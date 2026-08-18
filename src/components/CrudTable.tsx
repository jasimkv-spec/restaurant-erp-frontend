import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, ChevronRight, Plus } from "lucide-react";
import { api, ApiError, type ListResponse } from "../lib/apiClient";

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
}

function statusPill(status: string) {
  const isActive = status.toLowerCase() === "active";
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[11px] ${
        isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
      }`}
    >
      {status}
    </span>
  );
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

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ListResponse<T>>(`${basePath}?pageSize=200`);
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
  }, [basePath]);

  const singular = title.replace(/s$/, "");
  const statusCol = columns.find((c) => c.key === "status");
  const badgeCol = columns[0];
  const titleCol = columns[1] ?? columns[0];
  const subCols = columns.filter((c) => c !== badgeCol && c !== titleCol && c !== statusCol);

  function openCreate() {
    setEditingId(null);
    setForm({});
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
          className="mb-3 flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          <ArrowLeft size={14} />
          Back to {title.toLowerCase()}
        </button>

        <h2 className="text-base font-medium text-navy-900">
          {editingId ? String(form[titleCol.key] ?? singular) : `New ${singular}`}
        </h2>
        <p className="mb-4 text-xs text-gray-400">{singular} record</p>

        {formError && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2.5 text-[11px] font-medium text-gray-400">Details</div>
          <div className="grid grid-cols-2 gap-3">
            {formFields.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs text-gray-500">
                  {f.label}
                  {f.required && <span className="text-red-500"> *</span>}
                </label>
                {f.type === "select" ? (
                  <select
                    className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm"
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  >
                    <option value="">Select...</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "checkbox" ? (
                  <input
                    type="checkbox"
                    checked={!!form[f.key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                ) : (
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm"
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={backToList}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-navy-900 hover:bg-gray-50"
          >
            Cancel
          </button>
          {editingId && statusCol && (
            <button
              onClick={handleToggleStatus}
              disabled={togglingStatus}
              className={`ml-auto rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50 ${
                String(form[statusCol.key] ?? "").toLowerCase() === "active"
                  ? "border-red-200 text-red-600 hover:bg-red-50"
                  : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
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
      <h2 className="text-lg font-medium text-navy-900">{title}</h2>
      {description && <p className="mb-4 mt-0.5 text-xs text-gray-500">{description}</p>}

      <button
        onClick={openCreate}
        className="mb-4 flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-brand-700"
      >
        <Plus size={14} />
        Add {singular}
      </button>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="px-4 py-6 text-center text-sm text-gray-400">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-400">Nothing here yet.</div>
        ) : (
          rows.map((row, i) => (
            <div
              key={row.id}
              onClick={() => openEdit(row)}
              className={`flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-gray-50 ${
                i > 0 ? "border-t border-gray-100" : ""
              }`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-200 to-brand-600 text-[11px] font-medium text-navy-900">
                {String(row[badgeCol.key] ?? "?").slice(0, 3).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-navy-900">
                  {titleCol.render ? titleCol.render(row) : String(row[titleCol.key] ?? "-")}
                </div>
                {subCols.length > 0 && (
                  <div className="truncate text-[11px] text-gray-400">
                    {subCols
                      .map((c) => (c.render ? c.render(row) : row[c.key]))
                      .filter((v) => v !== undefined && v !== null && v !== "")
                      .join(" · ")}
                  </div>
                )}
              </div>
              {statusCol && statusPill(String(row[statusCol.key] ?? ""))}
              <ChevronRight size={16} className="shrink-0 text-gray-300" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
