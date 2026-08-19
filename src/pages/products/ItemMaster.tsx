import { ProductItemsView } from "./ProductItemsView";

export default function ItemMaster() {
  return (
    <ProductItemsView
      title="Item Master"
      description="Everything else - packaging, stationery, spares, services, and other non-stock items that aren't raw materials or menu items."
      itemTypes={["Non-stock", "Stationary", "Packaging", "Service", "Spare"]}
      defaultItemType="Non-stock"
      seriesEntityType="Item"
    />
  );
}
