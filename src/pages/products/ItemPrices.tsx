import { CrudTable } from "../../components/CrudTable";
import { useOptions } from "../../lib/useOptions";

/**
 * Selling prices per item, priced at the Price Group level - one row
 * covers every branch in that group (see Price Groups screen to set up
 * groups and their branch membership). A single-branch override and/or a
 * sales-channel narrowing are still available if a price group is too
 * broad for a specific case. Leave everything but Item/Price blank for a
 * price that applies everywhere. Item's "pricing summary" endpoint uses
 * whichever row matches plus the item's average cost to show gross profit %.
 */
export default function ItemPrices() {
  const itemOptions = useOptions("/api/inventory/items", (i) => `${i.code} - ${i.name}`);
  const priceGroupOptions = useOptions("/api/inventory/price-groups", (g) => `${g.code} - ${g.name}`);
  const branchOptions = useOptions("/api/admin/branches", (b) => `${b.code} - ${b.name}`);
  const channelOptions = useOptions("/api/sales/sales-channels", (c) => `${c.code} - ${c.name}`);

  return (
    <CrudTable
      title="Item Prices"
      description="Selling prices by item, priced per Price Group (every branch in the group shares it) - set up groups and their branches on the Price Groups screen first. A single-branch override or channel narrowing is optional."
      basePath="/api/inventory/item-prices"
      columns={[
        { key: "price", label: "Price" },
        { key: "item", label: "Item", render: (row: any) => (row.item ? `${row.item.code} - ${row.item.name}` : "-") },
        { key: "priceGroup", label: "Price group", render: (row: any) => row.priceGroup?.name ?? (row.branch ? `${row.branch.name} only` : "All branches") },
        { key: "channel", label: "Channel", render: (row: any) => row.channel?.name ?? "All channels" },
      ]}
      formFields={[
        { key: "itemId", label: "Item", type: "select", required: true, options: itemOptions },
        { key: "priceGroupId", label: "Price group", type: "select", options: priceGroupOptions },
        { key: "branchId", label: "Single-branch override (optional, bypasses price group)", type: "select", options: branchOptions },
        { key: "channelId", label: "Sales channel (optional)", type: "select", options: channelOptions },
        { key: "price", label: "Price", type: "number", required: true },
        { key: "effectiveFrom", label: "Effective from", type: "date" },
        { key: "effectiveTo", label: "Effective to", type: "date" },
      ]}
    />
  );
}
