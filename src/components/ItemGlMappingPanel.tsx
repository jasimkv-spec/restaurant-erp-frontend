import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import { api, ApiError } from "../lib/apiClient";
import { useOptions } from "../lib/useOptions";

interface GlMappingForm {
  inventoryGlId: string;
  cogsGlId: string;
  revenueGlId: string;
  expenseGlId: string;
  wastageGlId: string;
}

const EMPTY: GlMappingForm = { inventoryGlId: "", cogsGlId: "", revenueGlId: "", expenseGlId: "", wastageGlId: "" };

const FIELDS: { key: keyof GlMappingForm; label: string }[] = [
  { key: "inventoryGlId", label: "Inventory account" },
  { key: "cogsGlId", label: "COGS account" },
  { key: "revenueGlId", label: "Revenue account" },
  { key: "expenseGlId", label: "Expense account" },
  { key: "wastageGlId", label: "Wastage account" },
];

/**
 * Per-item override of which GL accounts this product's stock, cost,
 * revenue, expense, and wastage post to - overrides the company-wide
 * control accounts everything else falls back to (see coaLookup.ts).
 * Leave a field blank to keep using the company default for that account.
 */
export function ItemGlMappingPanel({ itemId }: { itemId: string }) {
  const [form, setForm] = useState<GlMappingForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const glOptions = useOptions("/api/finance/chart-of-accounts", (a) => `${a.code} - ${a.name}`);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const record = await api.get<Record<string, any>>(`/api/inventory/item-gl-mappings/${itemId}`);
      setForm({
        inventoryGlId: record.inventoryGlId ?? "",
        cogsGlId: record.cogsGlId ?? "",
        revenueGlId: record.revenueGlId ?? "",
        expenseGlId: record.expenseGlId ?? "",
        wastageGlId: record.wastageGlId ?? "",
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load account mapping");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const payload: Record<string, any> = { itemId };
      for (const f of FIELDS) if (form[f.key]) payload[f.key] = form[f.key];
      await api.post("/api/inventory/item-gl-mappings", payload);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save account mapping");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
        <Landmark size={12} />
        Account mapping
      </div>

      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="py-4 text-center text-sm text-gray-400">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs text-gray-500">{f.label}</label>
                <select
                  className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm"
                  value={form[f.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                >
                  <option value="">Use company default</option>
                  {glOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-3 rounded-lg bg-brand-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : saved ? "Saved" : "Save account mapping"}
          </button>
        </>
      )}
    </div>
  );
}
