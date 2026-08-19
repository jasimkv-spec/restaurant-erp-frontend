import { useEffect, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { api, ApiError } from "../lib/apiClient";

interface SalesHistoryRow {
  id: string;
  businessDate: string;
  invoiceNo: string;
  branch?: string;
  customer: string;
  qty: number;
  unitPrice: number;
}

/**
 * Read-only recent sales for this item, right on the item screen - there's
 * no standalone Sales Invoice list screen yet to "link" to, so this panel
 * is the history itself: most recent 20 sales invoice lines, newest first.
 */
export function ItemSalesHistoryPanel({ itemId }: { itemId: string }) {
  const [rows, setRows] = useState<SalesHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<{ data: SalesHistoryRow[] }>(`/api/inventory/items/${itemId}/sales-history`)
      .then((res) => {
        if (!cancelled) setRows(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load sales history");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5 border-b border-gray-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
        <ShoppingCart size={12} />
        Recent sales
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-4 text-center text-sm text-gray-400">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="py-3 text-center text-sm text-gray-400">No sales recorded for this item yet.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <div className="grid grid-cols-[6rem_1fr_1fr_4rem_5rem] gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <div>Date</div>
            <div>Branch</div>
            <div>Customer</div>
            <div>Qty</div>
            <div>Price</div>
          </div>
          <div className="divide-y divide-gray-100">
            {rows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[6rem_1fr_1fr_4rem_5rem] items-center gap-2 px-3 py-2 text-sm text-navy-900"
              >
                <div className="text-xs text-gray-500">{new Date(r.businessDate).toLocaleDateString()}</div>
                <div className="truncate">{r.branch ?? "-"}</div>
                <div className="truncate">{r.customer}</div>
                <div>{r.qty}</div>
                <div>{r.unitPrice}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
