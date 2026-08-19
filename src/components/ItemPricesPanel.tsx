import { useEffect, useState } from "react";
import { DollarSign, Plus } from "lucide-react";
import { api, ApiError, type ListResponse } from "../lib/apiClient";
import { useOptions } from "../lib/useOptions";
import { FIELD_CLASS, LABEL_CLASS } from "./CrudTable";

interface ItemPriceRow {
  id: string;
  price: number;
  priceGroupId: string | null;
  branchId: string | null;
  priceGroup?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
}

/**
 * Selling price per Price Group for this item, edited right where you're
 * already editing the product. A price group is a named set of branches
 * (set up on the Price Groups screen) that all share one price, so
 * changing a group's price here updates every branch in it at once -
 * this is the screen the user actually wants when they say "change the
 * price for that particular price group". Single-branch overrides and
 * sales-channel-specific pricing still exist but stay on the standalone
 * Item Prices screen since they're the less common case.
 */
export function ItemPricesPanel({ itemId }: { itemId: string }) {
  const [rows, setRows] = useState<ItemPriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const [newPriceGroupId, setNewPriceGroupId] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [adding, setAdding] = useState(false);

  const priceGroupOptions = useOptions("/api/inventory/price-groups", (g) => `${g.code} - ${g.name}`);
  const usedGroupIds = new Set(rows.map((r) => r.priceGroupId).filter(Boolean));
  const availableGroupOptions = priceGroupOptions.filter((o) => !usedGroupIds.has(o.value));

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ListResponse<ItemPriceRow>>(
        `/api/inventory/item-prices?itemId=${itemId}&pageSize=200`
      );
      setRows(res.data);
      setEditingPrices(Object.fromEntries(res.data.map((r) => [r.id, String(r.price)])));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load prices");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  async function handleSavePrice(id: string) {
    const value = editingPrices[id];
    if (value === undefined || value === "") return;
    setSavingId(id);
    setError(null);
    try {
      await api.put(`/api/inventory/item-prices/${id}`, { price: Number(value) });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save price");
    } finally {
      setSavingId(null);
    }
  }

  async function handleAdd() {
    if (!newPriceGroupId || !newPrice) return;
    setAdding(true);
    setError(null);
    try {
      await api.post("/api/inventory/item-prices", {
        itemId,
        priceGroupId: newPriceGroupId,
        price: Number(newPrice),
      });
      setNewPriceGroupId("");
      setNewPrice("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add price");
    } finally {
      setAdding(false);
    }
  }

  function rowLabel(row: ItemPriceRow) {
    if (row.priceGroup) return row.priceGroup.name;
    if (row.branch) return `${row.branch.name} only`;
    return "All branches";
  }

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5 border-b border-gray-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
        <DollarSign size={12} />
        Selling prices by group
      </div>
      <p className="mb-3 text-xs text-gray-500">
        One price per group covers every branch in it - change it here and every outlet in that group updates
        together. Need a single-branch override or a channel-specific price instead? Use the Item Prices screen.
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-4 text-center text-sm text-gray-400">Loading...</div>
      ) : (
        <>
          {rows.length === 0 ? (
            <div className="mb-3 py-3 text-center text-sm text-gray-400">No prices set for this item yet.</div>
          ) : (
            <div className="mb-3 divide-y divide-gray-100 rounded-lg border border-gray-200">
              {rows.map((row) => (
                <div key={row.id} className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-brand-50">
                  <div className="min-w-0 flex-1 truncate text-sm font-medium text-navy-900">{rowLabel(row)}</div>
                  <input
                    type="number"
                    className={`w-32 ${FIELD_CLASS}`}
                    value={editingPrices[row.id] ?? ""}
                    onChange={(e) => setEditingPrices((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  />
                  <button
                    onClick={() => handleSavePrice(row.id)}
                    disabled={savingId === row.id || editingPrices[row.id] === String(row.price)}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
                  >
                    {savingId === row.id ? "Saving..." : "Save"}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className={LABEL_CLASS}>Add a price group</label>
              <select
                className={FIELD_CLASS}
                value={newPriceGroupId}
                onChange={(e) => setNewPriceGroupId(e.target.value)}
              >
                <option value="">Select a price group...</option>
                {availableGroupOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <label className={LABEL_CLASS}>Price</label>
              <input
                type="number"
                className={FIELD_CLASS}
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={adding || !newPriceGroupId || !newPrice}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
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
