import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, Plus, X } from "lucide-react";
import { api, ApiError, type ListResponse } from "../../lib/apiClient";
import { useOptions } from "../../lib/useOptions";

interface Tax {
  id: string;
  code: string;
  name: string;
  rate: number;
}

interface TaxGroupItem {
  id: string;
  taxId: string;
  tax: Tax;
}

interface TaxGroup {
  id: string;
  code: string;
  name: string;
  status: string;
  taxes: TaxGroupItem[];
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
 * Not built on the generic CrudTable - a tax group's transaction screen
 * needs a second, dynamic section beneath the basic code/name fields: the
 * list of taxes currently in the group, with add/remove controls. That
 * doesn't fit CrudTable's single flat form.
 */
export default function TaxGroups() {
  const [groups, setGroups] = useState<TaxGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "transaction">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{ code: string; name: string }>({ code: "", name: "" });
  const [groupTaxes, setGroupTaxes] = useState<TaxGroupItem[]>([]);
  const [addTaxId, setAddTaxId] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const taxOptions = useOptions("/api/masters/taxes", (t) => `${t.code} - ${t.name} (${t.rate}%)`);
  const availableTaxOptions = taxOptions.filter((o) => !groupTaxes.some((gt) => gt.taxId === o.value));

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ListResponse<TaxGroup>>("/api/masters/tax-groups?pageSize=200");
      setGroups(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load tax groups");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm({ code: "", name: "" });
    setGroupTaxes([]);
    setFormError(null);
    setView("transaction");
  }

  function openEdit(group: TaxGroup) {
    setEditingId(group.id);
    setForm({ code: group.code, name: group.name });
    setGroupTaxes(group.taxes ?? []);
    setFormError(null);
    setView("transaction");
  }

  function backToList() {
    setView("list");
    load();
  }

  async function handleSaveDetails() {
    setSaving(true);
    setFormError(null);
    try {
      if (editingId) {
        await api.put(`/api/masters/tax-groups/${editingId}`, form);
      } else {
        const created = await api.post<TaxGroup>("/api/masters/tax-groups", form);
        // Switch straight into edit mode for the group we just created, so
        // the user can carry on adding taxes to it without leaving the screen.
        setEditingId(created.id);
        setGroupTaxes(created.taxes ?? []);
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddTax() {
    if (!editingId || !addTaxId) return;
    setFormError(null);
    try {
      const item = await api.post<TaxGroupItem>(`/api/masters/tax-groups/${editingId}/taxes`, { taxId: addTaxId });
      setGroupTaxes((prev) => [...prev, item]);
      setAddTaxId("");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not add tax");
    }
  }

  async function handleRemoveTax(taxId: string) {
    if (!editingId) return;
    setFormError(null);
    try {
      await api.del(`/api/masters/tax-groups/${editingId}/taxes/${taxId}`);
      setGroupTaxes((prev) => prev.filter((gt) => gt.taxId !== taxId));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not remove tax");
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
          Back to tax groups
        </button>

        <h2 className="text-base font-medium text-navy-900">{editingId ? form.name || "Tax group" : "New Tax Group"}</h2>
        <p className="mb-4 text-xs text-gray-400">
          A tax group bundles several taxes together (e.g. Tourism Tax + Municipality Tax + VAT) so they can be applied
          to a document as one selection.
        </p>

        {formError && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2.5 text-[11px] font-medium text-gray-400">Details</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                Code<span className="text-red-500"> *</span>
              </label>
              <input
                type="text"
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm"
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                Name<span className="text-red-500"> *</span>
              </label>
              <input
                type="text"
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={handleSaveDetails}
              disabled={saving || !form.code || !form.name}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : editingId ? "Save details" : "Create group"}
            </button>
          </div>
        </div>

        {editingId && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-2.5 text-[11px] font-medium text-gray-400">Taxes in this group</div>

            {groupTaxes.length === 0 ? (
              <div className="py-3 text-center text-sm text-gray-400">No taxes added yet.</div>
            ) : (
              <div className="mb-3 divide-y divide-gray-100 rounded-lg border border-gray-100">
                {groupTaxes.map((gt) => (
                  <div key={gt.id} className="flex items-center justify-between px-3 py-2">
                    <div className="text-sm text-navy-900">
                      {gt.tax.code} - {gt.tax.name}{" "}
                      <span className="text-xs text-gray-400">({gt.tax.rate}%)</span>
                    </div>
                    <button
                      onClick={() => handleRemoveTax(gt.taxId)}
                      className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title="Remove from group"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <select
                className="flex-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-sm"
                value={addTaxId}
                onChange={(e) => setAddTaxId(e.target.value)}
              >
                <option value="">Select a tax to add...</option>
                {availableTaxOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddTax}
                disabled={!addTaxId}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                <Plus size={14} />
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-lg font-medium text-navy-900">Tax Groups</h2>
      <p className="mb-4 mt-0.5 text-xs text-gray-500">
        Bundle multiple taxes together so they can be applied to a document in one go.
      </p>

      <button
        onClick={openCreate}
        className="mb-4 flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-brand-700"
      >
        <Plus size={14} />
        Add Tax Group
      </button>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="px-4 py-6 text-center text-sm text-gray-400">Loading...</div>
        ) : groups.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-400">Nothing here yet.</div>
        ) : (
          groups.map((group, i) => (
            <div
              key={group.id}
              onClick={() => openEdit(group)}
              className={`flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-gray-50 ${
                i > 0 ? "border-t border-gray-100" : ""
              }`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-200 to-brand-600 text-[11px] font-medium text-navy-900">
                {group.code.slice(0, 3).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-navy-900">{group.name}</div>
                <div className="truncate text-[11px] text-gray-400">
                  {(group.taxes ?? []).length} tax{(group.taxes ?? []).length === 1 ? "" : "es"} in this group
                </div>
              </div>
              {statusPill(group.status)}
              <ChevronRight size={16} className="shrink-0 text-gray-300" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
