import { useEffect, useState } from "react";
import { api, ApiError, type ListResponse } from "../../lib/apiClient";
import { useOptions } from "../../lib/useOptions";
import { FIELD_CLASS } from "../../components/CrudTable";

const STATUSES = ["Open", "Soft Closed", "Closed", "Locked", "Reopened"];

interface FinancialPeriod {
  id: string;
  companyId: string;
  fiscalYear: number;
  monthNo: number;
  startDate: string;
  endDate: string;
  inventoryStatus: string;
  financeStatus: string;
}

/**
 * Not built on the generic CrudTable - a financial period's *create*
 * fields (company/year/month/dates) and its *update* fields (just the two
 * status flags - see the backend's admin.routes.ts updateSchema) are
 * completely different, so a single reusable form would either let you
 * "edit" fields that silently do nothing, or hide the one thing you
 * actually come here to do: open/close a period. This is what makes
 * assertPeriodOpen() (src/services/periodService.ts on the backend)
 * actually block postings.
 */
export default function FinancialPeriods() {
  const companyOptions = useOptions("/api/admin/companies", (c) => `${c.code} - ${c.name}`);
  const [periods, setPeriods] = useState<FinancialPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<ListResponse<FinancialPeriod>>("/api/admin/financial-periods?pageSize=200");
      setPeriods(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load periods");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function updateStatus(id: string, field: "inventoryStatus" | "financeStatus", value: string) {
    await api.put(`/api/admin/financial-periods/${id}`, { [field]: value });
    load();
  }

  async function createPeriod() {
    setSaving(true);
    try {
      await api.post("/api/admin/financial-periods", {
        companyId: form.companyId,
        fiscalYear: Number(form.fiscalYear),
        monthNo: Number(form.monthNo),
        startDate: form.startDate,
        endDate: form.endDate,
      });
      setFormOpen(false);
      setForm({});
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-navy-900">Financial Periods</h2>
          <p className="mt-1 text-xs text-gray-500">
            Closing a period here actually blocks new postings against it - Finance and Inventory close independently.
          </p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          + Add Period
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Period</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Dates</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Inventory status</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Finance status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">Loading...</td>
              </tr>
            ) : periods.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">No periods yet.</td>
              </tr>
            ) : (
              periods.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-brand-50">
                  <td className="px-4 py-2.5 text-sm font-medium text-navy-900">
                    {p.fiscalYear}-{String(p.monthNo).padStart(2, "0")}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">
                    {p.startDate.slice(0, 10)} to {p.endDate.slice(0, 10)}
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      className="rounded-lg border-2 border-gray-300 bg-white px-2 py-1.5 text-sm shadow-sm outline-none transition-colors hover:border-gray-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
                      value={p.inventoryStatus}
                      onChange={(e) => updateStatus(p.id, "inventoryStatus", e.target.value)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      className="rounded-lg border-2 border-gray-300 bg-white px-2 py-1.5 text-sm shadow-sm outline-none transition-colors hover:border-gray-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
                      value={p.financeStatus}
                      onChange={(e) => updateStatus(p.id, "financeStatus", e.target.value)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/30" onClick={() => setFormOpen(false)}>
          <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-4">New Financial Period</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Company *</label>
                <select
                  className={FIELD_CLASS}
                  value={form.companyId ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, companyId: e.target.value }))}
                >
                  <option value="">Select...</option>
                  {companyOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Fiscal year *</label>
                  <input
                    type="number"
                    className={FIELD_CLASS}
                    value={form.fiscalYear ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, fiscalYear: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Month (1-12) *</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    className={FIELD_CLASS}
                    value={form.monthNo ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, monthNo: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Start date *</label>
                <input
                  type="date"
                  className={FIELD_CLASS}
                  value={form.startDate ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">End date *</label>
                <input
                  type="date"
                  className={FIELD_CLASS}
                  value={form.endDate ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                onClick={createPeriod}
                disabled={saving}
                className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setFormOpen(false)}
                className="rounded-lg border-2 border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
