import { useEffect, useState } from "react";
import { Truck, Plus } from "lucide-react";
import { api, ApiError, type ListResponse } from "../lib/apiClient";
import { useOptions } from "../lib/useOptions";
import { FIELD_CLASS, LABEL_CLASS } from "./CrudTable";

interface VendorMappingRow {
  id: string;
  vendorId: string;
  vendorItemCode: string | null;
  leadTimeDays: number | null;
  lastPrice: number | null;
  vendor?: { id: string; code: string; name: string } | null;
}

interface PurchaseHistoryRow {
  id: string;
  grnDate: string;
  grnNo: string;
  vendor: { id: string; code: string; name: string } | null;
  receivedQty: number;
  acceptedQty: number;
  unitCost: number;
}

/**
 * Replaces the standalone Item-Vendor Mapping screen - which vendors can
 * supply this item, their code/lead-time/agreed price (editable inline,
 * like Odoo's product Purchase tab), plus a read-only "who has actually
 * supplied this recently" list pulled straight from GRN history so buying
 * decisions aren't based on a static mapping table alone.
 */
export function ItemVendorPanel({ itemId }: { itemId: string }) {
  const [rows, setRows] = useState<VendorMappingRow[]>([]);
  const [history, setHistory] = useState<PurchaseHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, { leadTimeDays: string; lastPrice: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const [newVendorId, setNewVendorId] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newLeadTime, setNewLeadTime] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [adding, setAdding] = useState(false);

  const vendorOptions = useOptions("/api/procurement/vendors", (v) => `${v.code} - ${v.name}`);
  const usedVendorIds = new Set(rows.map((r) => r.vendorId));
  const availableVendorOptions = vendorOptions.filter((o) => !usedVendorIds.has(o.value));

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [mappingRes, historyRes] = await Promise.all([
        api.get<ListResponse<VendorMappingRow>>(`/api/inventory/item-vendor-mappings?itemId=${itemId}&pageSize=200`),
        api.get<{ data: PurchaseHistoryRow[] }>(`/api/inventory/items/${itemId}/purchase-history`),
      ]);
      setRows(mappingRes.data);
      setEditing(
        Object.fromEntries(
          mappingRes.data.map((r) => [
            r.id,
            { leadTimeDays: String(r.leadTimeDays ?? ""), lastPrice: String(r.lastPrice ?? "") },
          ])
        )
      );
      setHistory(historyRes.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load vendor data");
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
      await api.put(`/api/inventory/item-vendor-mappings/${id}`, {
        leadTimeDays: value.leadTimeDays ? Number(value.leadTimeDays) : undefined,
        lastPrice: value.lastPrice ? Number(value.lastPrice) : undefined,
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save vendor");
    } finally {
      setSavingId(null);
    }
  }

  async function handleAdd() {
    if (!newVendorId) return;
    setAdding(true);
    setError(null);
    try {
      await api.post("/api/inventory/item-vendor-mappings", {
        itemId,
        vendorId: newVendorId,
        vendorItemCode: newCode || undefined,
        leadTimeDays: newLeadTime ? Number(newLeadTime) : undefined,
        lastPrice: newPrice ? Number(newPrice) : undefined,
      });
      setNewVendorId("");
      setNewCode("");
      setNewLeadTime("");
      setNewPrice("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add vendor");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5 border-b border-gray-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
        <Truck size={12} />
        Vendors
      </div>
      <p className="mb-3 text-xs text-gray-500">
        Every vendor who can supply this item, their vendor-side code, lead time, and last agreed price - used to
        default a purchase order line.
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-4 text-center text-sm text-gray-400">Loading...</div>
      ) : (
        <>
          {rows.length === 0 ? (
            <div className="mb-3 py-3 text-center text-sm text-gray-400">No vendors mapped to this item yet.</div>
          ) : (
            <div className="mb-3 overflow-hidden rounded-lg border border-gray-200">
              <div className="grid grid-cols-[1fr_9rem_7rem_7rem_4.5rem] gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <div>Vendor</div>
                <div>Vendor code</div>
                <div>Lead time (days)</div>
                <div>Last price</div>
                <div></div>
              </div>
              <div className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[1fr_9rem_7rem_7rem_4.5rem] items-center gap-2 px-3 py-2 transition-colors hover:bg-brand-50"
                  >
                    <div className="truncate text-sm font-medium text-navy-900">
                      {row.vendor ? `${row.vendor.code} - ${row.vendor.name}` : "-"}
                    </div>
                    <div className="truncate text-sm text-gray-600">{row.vendorItemCode || "-"}</div>
                    <input
                      type="number"
                      className={FIELD_CLASS}
                      value={editing[row.id]?.leadTimeDays ?? ""}
                      onChange={(e) =>
                        setEditing((prev) => ({ ...prev, [row.id]: { ...prev[row.id], leadTimeDays: e.target.value } }))
                      }
                    />
                    <input
                      type="number"
                      className={FIELD_CLASS}
                      value={editing[row.id]?.lastPrice ?? ""}
                      onChange={(e) =>
                        setEditing((prev) => ({ ...prev, [row.id]: { ...prev[row.id], lastPrice: e.target.value } }))
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

          <div className="mb-5 grid grid-cols-[1fr_9rem_7rem_7rem_4.5rem] items-end gap-2">
            <div>
              <label className={LABEL_CLASS}>Add a vendor</label>
              <select className={FIELD_CLASS} value={newVendorId} onChange={(e) => setNewVendorId(e.target.value)}>
                <option value="">Select a vendor...</option>
                {availableVendorOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Vendor code</label>
              <input type="text" className={FIELD_CLASS} value={newCode} onChange={(e) => setNewCode(e.target.value)} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Lead time</label>
              <input
                type="number"
                className={FIELD_CLASS}
                value={newLeadTime}
                onChange={(e) => setNewLeadTime(e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Price</label>
              <input type="number" className={FIELD_CLASS} value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
            </div>
            <button
              onClick={handleAdd}
              disabled={adding || !newVendorId}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              <Plus size={14} />
              Add
            </button>
          </div>

          <div className="mb-2 border-t border-gray-100 pt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Recent purchase history
          </div>
          {history.length === 0 ? (
            <div className="py-3 text-center text-sm text-gray-400">No GRNs recorded for this item yet.</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <div className="grid grid-cols-[6rem_1fr_6rem_4rem_4rem] gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <div>Date</div>
                <div>Vendor</div>
                <div>GRN</div>
                <div>Qty</div>
                <div>Cost</div>
              </div>
              <div className="divide-y divide-gray-100">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="grid grid-cols-[6rem_1fr_6rem_4rem_4rem] items-center gap-2 px-3 py-2 text-sm text-navy-900"
                  >
                    <div className="text-xs text-gray-500">{new Date(h.grnDate).toLocaleDateString()}</div>
                    <div className="truncate">{h.vendor ? `${h.vendor.code} - ${h.vendor.name}` : "-"}</div>
                    <div className="truncate text-xs text-gray-500">{h.grnNo}</div>
                    <div>{h.acceptedQty}</div>
                    <div>{h.unitCost}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
