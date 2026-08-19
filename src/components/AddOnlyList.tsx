import { useEffect, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { api, ApiError, type ListResponse } from "../lib/apiClient";
import { FIELD_CLASS, LABEL_CLASS, type CrudColumn, type CrudFormField } from "./CrudTable";

interface AddOnlyListProps<T extends Record<string, any>> {
  title: string;
  description?: string;
  basePath: string;
  columns: CrudColumn<T>[];
  formFields: CrudFormField[];
  onChanged?: () => void;
}

/**
 * For reference lists the backend only exposes GET/POST on (Currencies,
 * Banks, Countries, Cities, UOM Conversions) - there is no edit endpoint,
 * by design, since these are shared/global lookups rather than
 * tenant-owned records. Same list-plus-transaction-screen visual language
 * as CrudTable, just without the click-a-row-to-edit affordance.
 */
export function AddOnlyList<T extends Record<string, any>>({
  title,
  description,
  basePath,
  columns,
  formFields,
  onChanged,
}: AddOnlyListProps<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "transaction">("list");
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
  const titleCol = columns[1] ?? columns[0];
  const subCols = columns.filter((c) => c !== columns[0] && c !== titleCol);

  function openCreate() {
    setForm({});
    setFormError(null);
    setView("transaction");
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
      await api.post(basePath, payload);
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
          onClick={() => setView("list")}
          className="mb-3 flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          <ArrowLeft size={14} />
          Back to {title.toLowerCase()}
        </button>

        <h2 className="text-lg font-semibold text-navy-900">New {singular}</h2>
        <p className="mb-4 text-xs text-gray-500">This is a shared reference list - entries can't be edited once added.</p>

        {formError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            {formFields.map((f) => (
              <div key={f.key}>
                <label className={LABEL_CLASS}>
                  {f.label}
                  {f.required && <span className="text-red-500"> *</span>}
                </label>
                {f.type === "select" ? (
                  <select
                    className={FIELD_CLASS}
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
                ) : (
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    className={FIELD_CLASS}
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
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => setView("list")}
            className="rounded-lg border-2 border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-navy-900 transition-colors hover:border-gray-400 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-navy-900">{title}</h2>
      {description && <p className="mb-4 mt-1 text-xs text-gray-500">{description}</p>}

      <button
        onClick={openCreate}
        className="mb-4 flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
      >
        <Plus size={14} />
        Add {singular}
      </button>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="px-4 py-6 text-center text-sm text-gray-400">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-400">Nothing here yet.</div>
        ) : (
          rows.map((row, i) => (
            <div
              key={row.id}
              className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-brand-50 ${i > 0 ? "border-t border-gray-100" : ""}`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-200 to-brand-600 text-[11px] font-semibold text-navy-900">
                {String(row[columns[0].key] ?? "?").slice(0, 3).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-navy-900">
                  {titleCol.render ? titleCol.render(row) : String(row[titleCol.key] ?? "-")}
                </div>
                {subCols.length > 0 && (
                  <div className="truncate text-[11px] text-gray-500">
                    {subCols
                      .map((c) => (c.render ? c.render(row) : row[c.key]))
                      .filter((v) => v !== undefined && v !== null && v !== "")
                      .join(" · ")}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
