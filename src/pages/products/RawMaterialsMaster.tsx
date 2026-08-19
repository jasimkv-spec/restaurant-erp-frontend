import { ProductItemsView } from "./ProductItemsView";

export default function RawMaterialsMaster() {
  return (
    <ProductItemsView
      title="Raw Materials Master"
      description="Ingredients and prep/finished stock used internally in recipes and production - not sold directly to customers."
      itemTypes={["Stock", "Semi-finished", "Finished"]}
      defaultItemType="Stock"
    />
  );
}
