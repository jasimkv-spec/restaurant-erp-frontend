import { CrudTable } from "../../components/CrudTable";
import { useOptions } from "../../lib/useOptions";

/**
 * Selling prices per item - optionally narrowed to a branch and/or sales
 * channel (POS/aggregator). Leave both blank for a single price that
 * applies everywhere; add more rows to override for a specific branch or
 * channel. Item's "pricing summary" endpoint uses whichever row matches
 * plus the item's average cost to show gross profit %.
 */
export default function ItemPrices() {
  const itemOptions = useOptions("/api/inventory/items", (i) => `${i.code} - ${i.name}`);
  const branchOptions = useOptions("/api/admin/branches", (b) => `${b.code} - ${b.name}`);
  const channelOptions = useOptions("/api/sales/sales-channels", (c) => `${c.code} - ${c.name}`);

  return (
    <CrudTable
      title="Item Prices"
      description="Selling prices by item, optionally narrowed to a branch and/or sales channel. Leave branch/channel blank for a price that applies everywhere."
      basePath="/api/inventory/item-prices"
      columns={[
        { key: "price", label: "Price" },
        { key: "item", label: "Item", render: (row: any) => (row.item ? `${row.item.code} - ${row.item.name}` : "-") },
        { key: "branch", label: "Branch", render: (row: any) => row.branch?.name ?? "All branches" },
        { key: "channel", label: "Channel", render: (row: any) => row.channel?.name ?? "All channels" },
      ]}
      formFields={[
        { key: "itemId", label: "Item", type: "select", required: true, options: itemOptions },
        { key: "branchId", label: "Branch (optional)", type: "select", options: branchOptions },
        { key: "channelId", label: "Sales channel (optional)", type: "select", options: channelOptions },
        { key: "price", label: "Price", type: "number", required: true },
        { key: "effectiveFrom", label: "Effective from", type: "date" },
        { key: "effectiveTo", label: "Effective to", type: "date" },
      ]}
    />
  );
}
