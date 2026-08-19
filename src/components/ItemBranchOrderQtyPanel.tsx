import { useEffect, useState } from "react";
import { GitBranch, Plus } from "lucide-react";
import { api, ApiError, type ListResponse } from "../lib/apiClient";
import { useOptions } from "../lib/useOptions";
import { FIELD_CLASS, LABEL_CLASS } from "./CrudTable";

interface BranchSettingRow {
  id: string;
  branchId: string;
  minOrderQty: number | null;
  maxOrderQty: number | null;
  branch?: { id: string; code: string; name: string } | null;
}

/**
 * Per-branch minimum/maximum order quantity - the item's reorder level and
 * min/max stock (General Information tab) are tenant-wide fallbacks; a
 * branch listed here overrides them specifically for purchasing at that
 * branch (e.g. a small kiosk never orders more than X at once).
 */
export function ItemBranchOrderQtyPanel({ itemId }: { itemId: string }) {
  const [rows, setRows] = useState<BranchSettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, { minOrderQty: string; maxOrderQty: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const [newBranchId, setNewBranchId] = useState("");
  const [newMin, setNewMin] = useState("");
  const [newMax, setNewMax] = useState("");
  const [adding, setAdding] = useState(false);

  const branchOptions = useOptions("/api/admin/branches", (b) => `${b.code} - ${b.name}`);
  const usedBranchIds = new Set(rows.map((r) => r.branchId));
  const availableBranchOptions = branchOptions.filter((o) => !usedBranchIds.has(o.value));

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ListResponse<BranchSettingRow>>(
        `/api/inventory/item-branch-settings?itemId=${itemId}&pageSize=200`
      );
      setRows(res.data);
      setEditing(
        Object.fromEntries(
          res.data.map((r) => [
            r.id,
            { minOrderQty: String(r.minOrderQty ?? ""), maxOrderQty: String(r.maxOrderQty ?? "") },
          ])
        )
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load branch settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  async function handleSaveRow(id: string) {
    const value = editing[id];
    if (!value) return;
    setSavingId(id);
    setError(null);
    try {
      await api.put(`/api/inventory/item-branch-settings/${id}`, {
        minOrderQty: value.minOrderQty ? Number(value.minOrderQty) : undefined,
        maxOrderQty: value.maxOrderQty ? Number(value.maxOrderQty) : undefined,
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save branch settings");
    } finally {
      setSavingId(null);
    }
  }

  async function handleAdd() {
    if (!newBranchId) return;
    setAdding(true);
    setError(null);
    try {
      await api.post("/api/inventory/item-branch-settings", {
        itemId,
        branchId: newBranchId,
        minOrderQty: newMin ? Number(newMin) : undefined,
        maxOrderQty: newMax ? Number(newMax) : undefined,
      });
      setNewBranchId("");
      setNewMin("");
      setNewMax("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add branch settings");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5 border-b border-gray-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
        <GitBranch size={12} />
        Order quantity by branch
      </div>
      <p className="mb-3 text-xs text-gray-500">
        Overrides the item's default reorder level and min/max stock (General Information tab) for one specific
        branch's purchasing.
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-4 text-center text-sm text-gray-400">Loading...</div>
      ) : (
        <>
          {rows.length === 0 ? (
            <div className="mb-3 py-3 text-center text-sm text-gray-400">
              No branch overrides set - every branch uses the item's default min/max stock.
            </div>
          ) : (
            <div className="mb-3 overflow-hidden rounded-lg border border-gray-200">
              <div className="grid grid-cols-[1fr_8rem_8rem_4.5rem] gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <div>Branch</div>
                <div>Min order qty</div>
                <div>Max order qty</div>
                <div></div>
              </div>
              <div className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[1fr_8rem_8rem_4.5rem] items-center gap-2 px-3 py-2 transition-colors hover:bg-brand-50"
                  >
                    <div className="truncate text-sm font-medium text-navy-900">
                      {row.branch ? `${row.branch.code} - ${row.branch.name}` : "-"}
                    </div>
                    <input
                      type="number"
                      className={FIELD_CLASS}
                      value={editing[row.id]?.minOrderQty ?? ""}
                      onChange={(e) =>
                        setEditing((prev) => ({ ...prev, [row.id]: { ...prev[row.id], minOrderQty: e.target.value } }))
                      }
                    />
                    <input
                      type="number"
                      className={FIELD_CLASS}
                      value={editing[row.id]?.maxOrderQty ?? ""}
                      onChange={(e) =>
                        setEditing((prev) => ({ ...prev, [row.id]: { ...prev[row.id], maxOrderQty: e.target.value } }))
                      }
                    />
                    <button
                      onClick={() => handleSaveRow(row.id)}
                      disabled={savingId === row.id}
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
                    >
                      {savingId === row.id ? "..." : "Save"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-[1fr_8rem_8rem_4.5rem] items-end gap-2">
            <div>
              <label className={LABEL_CLASS}>Add a branch</label>
              <select className={FIELD_CLASS} value={newBranchId} onChange={(e) => setNewBranchId(e.target.value)}>
                <option value="">Select a branch...</option>
                {availableBranchOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Min qty</label>
              <input type="number" className={FIELD_CLASS} value={newMin} onChange={(e) => setNewMin(e.target.value)} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Max qty</label>
              <input type="number" className={FIELD_CLASS} value={newMax} onChange={(e) => setNewMax(e.target.value)} />
            </div>
            <button
              onClick={handleAdd}
              disabled={adding || !newBranchId}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              <Plus size={14} />
              Add
            </button>
          </div>
        </>
      )}
    </div>
  );
}
