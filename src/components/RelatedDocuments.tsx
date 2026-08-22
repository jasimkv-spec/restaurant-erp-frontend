import { Link } from "react-router-dom";

export interface RelatedDocItem {
  id: string;
  label: string;
  /** Route to this document's own list screen, e.g. "/procurement/purchase-orders" - navigated to with `state: { openId: id }`, which that screen's own autoOpenDetailId wiring picks up to jump straight into this record's detail view instead of landing on the list. */
  to: string;
  status?: string;
}

export interface RelatedDocGroup {
  label: string;
  items: RelatedDocItem[];
}

/**
 * Pill-link panel shown in a transaction's detail view (via DocumentScreen's
 * relatedDocuments prop), linking out to whatever document this one was
 * created from or has spawned - e.g. a PO's source Material Request(s), the
 * GRNs raised against it, and any Purchase Invoice(s) that settled those
 * GRNs. Each screen builds its own groups from its own detail record (one
 * hop out); chaining across screens (MR -> PO -> GRN -> PI and back) is what
 * lets the whole procurement trail be navigated end to end. Returns null
 * when every group is empty, so a document with nothing linked yet (e.g. a
 * fresh direct/no-PO GRN) doesn't show an empty panel.
 */
export function RelatedDocuments({ groups }: { groups: RelatedDocGroup[] }) {
  const visible = groups.filter((g) => g.items.length > 0);
  if (visible.length === 0) return null;
  return (
    <div className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 shadow-sm">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">Related Documents</div>
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        {visible.map((g) => (
          <div key={g.label}>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">{g.label}</div>
            <div className="flex flex-wrap gap-2">
              {g.items.map((item) => (
                <Link
                  key={item.id}
                  to={item.to}
                  state={{ openId: item.id }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700 shadow-sm hover:bg-indigo-100"
                >
                  {item.label}
                  {item.status && <span className="font-normal text-gray-400">· {item.status}</span>}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
