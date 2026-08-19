import { ProductItemsView } from "./ProductItemsView";

export default function MenuMaster() {
  return (
    <ProductItemsView
      title="Menu Master"
      description="Customer-facing menu items - what shows up on the menu, POS, and sales/delivery channels."
      itemTypes={["Sellable", "Menu"]}
      defaultItemType="Sellable"
    />
  );
}
