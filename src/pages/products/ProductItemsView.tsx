import { useEffect, useState } from "react";
import { CrudTable, type CrudFormField } from "../../components/CrudTable";
import { useOptions } from "../../lib/useOptions";
import { useCodeLock } from "../../lib/useCodeLock";
import { api, type ListResponse } from "../../lib/apiClient";
import { ItemGlMappingPanel } from "../../components/ItemGlMappingPanel";
import { ItemPricesPanel } from "../../components/ItemPricesPanel";
import { ItemVendorPanel } from "../../components/ItemVendorPanel";
import { ItemBranchOrderQtyPanel } from "../../components/ItemBranchOrderQtyPanel";
import { ItemSalesHistoryPanel } from "../../components/ItemSalesHistoryPanel";
import { ItemRecipePanel } from "../../components/ItemRecipePanel";

// Recipe/BOM only makes sense for something actually built from other
// items - shown when the item type suggests that, or when Manufacture/
// Factory is switched on, regardless of type.
const RECIPE_RELEVANT_TYPES = new Set(["Menu", "Semi-finished", "Finished", "Packaging"]);
function showsRecipePanel(form: Record<string, any>) {
  return RECIPE_RELEVANT_TYPES.has(form.itemType) || !!form.forManufacture || !!form.forFactory;
}

const COSTING_METHODS = ["Weighted Average", "Standard Cost", "FIFO"];

type ScreenKind = "rawMaterial" | "menu" | "item";

/**
 * Shared implementation behind Raw Materials Master, Menu Master, and Item
 * Master - all three are the same underlying Item table (see
 * prisma/schema.prisma), just pre-filtered to a different slice of
 * itemType via the backend's listFilters (see inventory.routes.ts). One
 * product only ever shows up in exactly one of the three lists, and
 * everything downstream (recipes, GRN, stock, sales) still points at the
 * same Item record either way - nothing needed to change there.
 *
 * Each screen only shows the fields actually relevant to it (a Menu item
 * doesn't need a reorder level; a Raw Material doesn't need prep time) -
 * see the `screen` prop and the extraFields split below.
 */
export function ProductItemsView({
  title,
  description,
  itemTypes,
  defaultItemType,
  seriesEntityType,
  screen,
}: {
  title: string;
  description: string;
  itemTypes: string[];
  defaultItemType: string;
  /** "RawMaterial" | "MenuItem" | "Item" - matches inventory.routes.ts's ITEM_AUTO_CODE_SERIES, and the Master Series entry that governs this screen's code field. */
  seriesEntityType: string;
  /** Which set of extra fields to show below the shared core - see the three arrays below. */
  screen: ScreenKind;
}) {
  const { locked: codeLocked, prefix: codePrefix } = useCodeLock(seriesEntityType);
  const categoryOptions = useOptions("/api/inventory/item-categories", (c) => `${c.code} - ${c.name}`);
  const groupOptions = useOptions("/api/inventory/product-groups", (g) => `${g.code} - ${g.name}`);
  const subgroupOptions = useOptions("/api/inventory/product-subgroups", (s) => `${s.code} - ${s.name}`);
  const familyOptions = useOptions("/api/inventory/product-families", (f) => `${f.code} - ${f.name}`);
  const brandOptions = useOptions("/api/inventory/brands", (b) => `${b.code} - ${b.name}`);
  const uomOptions = useOptions("/api/masters/uoms", (u) => `${u.code} - ${u.name}`);
  const taxOptions = useOptions("/api/masters/taxes", (t) => `${t.code} - ${t.name}`);
  const itemTypeOptions = useOptions("/api/inventory/item-types", (t) => `${t.code} - ${t.name}`);

  // Menu category is self-referencing (a record can be top-level, like
  // "Drinks", or nested under one, like "Hot" under "Drinks") - fetched raw
  // here (not via useOptions) so parentId is available to split it into two
  // pick-lists: "Menu category" only shows top-level records, "Sub
  // category" only shows records that have a parent. The two aren't
  // cross-filtered (picking "Drinks" doesn't limit Sub category to just its
  // children) - same simple, unenforced relationship Group/Subgroup/Family
  // already has elsewhere in this form.
  const [menuCategoryOptions, setMenuCategoryOptions] = useState<{ value: string; label: string }[]>([]);
  const [menuSubcategoryOptions, setMenuSubcategoryOptions] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    if (screen !== "menu") return;
    let cancelled = false;
    api.get<ListResponse<any>>("/api/inventory/menu-categories?pageSize=200").then((res) => {
      if (cancelled) return;
      const label = (c: any) => `${c.code} - ${c.name}`;
      setMenuCategoryOptions(res.data.filter((c) => !c.parentId).map((c) => ({ value: c.id, label: label(c) })));
      setMenuSubcategoryOptions(res.data.filter((c) => !!c.parentId).map((c) => ({ value: c.id, label: label(c) })));
    });
    return () => {
      cancelled = true;
    };
  }, [screen]);

  // Raw Materials Master pre-selects the seeded "Stock" Item Type row for
  // every new record ("by default all raw materials will be stock items") -
  // needs the real id, not just the {value,label} pair useOptions gives, so
  // fetched separately and only for this one screen.
  const [defaultStockItemTypeId, setDefaultStockItemTypeId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (screen !== "rawMaterial") return;
    let cancelled = false;
    api.get<ListResponse<any>>("/api/inventory/item-types?pageSize=200").then((res) => {
      if (cancelled) return;
      const stock = res.data.find((t) => t.code === "STOCK");
      if (stock) setDefaultStockItemTypeId(stock.id);
    });
    return () => {
      cancelled = true;
    };
  }, [screen]);

  // Menu Master defaults Base UOM to "PC" (piece/plate/serving) so quick
  // menu entry never has to stop and think about units - still technically
  // required (costing/recipe logic needs every item to have one), just
  // pre-filled rather than left for you to pick.
  const [defaultMenuUomId, setDefaultMenuUomId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (screen !== "menu") return;
    let cancelled = false;
    api.get<ListResponse<any>>("/api/masters/uoms?pageSize=200").then((res) => {
      if (cancelled) return;
      const pc = res.data.find((u) => u.code === "PC") ?? res.data[0];
      if (pc) setDefaultMenuUomId(pc.id);
    });
    return () => {
      cancelled = true;
    };
  }, [screen]);

  const topFields: CrudFormField[] = [
    {
      key: "code",
      label: "Code",
      type: "text",
      disabled: codeLocked,
      placeholder: codeLocked
        ? `Auto-generated (${codePrefix ?? "..."}####)`
        : "Enter a code, or configure it under Master Series to auto-generate",
    },
    { key: "name", label: "Name", type: "text", required: true },
    { key: "nameArabic", label: "Name (Arabic)", type: "text", placeholder: "For bilingual bill printing" },
  ];

  const forFlagsFields: CrudFormField[] = [
    { key: "forSales", label: "Sales", type: "checkbox" },
    { key: "forManufacture", label: "Manufacture", type: "checkbox" },
    { key: "forFactory", label: "Factory", type: "checkbox" },
    { key: "forPurchase", label: "Purchase", type: "checkbox" },
    { key: "forPos", label: "Point of Sale", type: "checkbox" },
    { key: "forExpense", label: "Expenses", type: "checkbox" },
  ];

  const restCoreFields: CrudFormField[] = [
    { key: "shortName", label: "Short name (for receipts/kitchen tickets)", type: "text" },
    { key: "barcode", label: "Barcode", type: "text" },
    { key: "itemType", label: "Material stage", type: "select", required: true, options: itemTypes.map((t) => ({ value: t, label: t })) },
    { key: "brandId", label: "Brand", type: "select", options: brandOptions },
    { key: "baseUomId", label: "Base UOM", type: "select", required: true, options: uomOptions },
    { key: "defaultTaxId", label: "Default tax", type: "select", options: taxOptions },
    { key: "costingMethod", label: "Costing method", type: "select", options: COSTING_METHODS.map((c) => ({ value: c, label: c })) },
    { key: "standardCost", label: "Standard cost", type: "number" },
    { key: "imageUrl", label: "Image URL", type: "text" },
    { key: "notes", label: "Notes", type: "text" },
  ];

  // Menu items don't need an accounting Category - their revenue posts via
  // Sales Channel, not Item Category's Inventory/COGS GL defaults - so it's
  // dropped here rather than shown but meaningless. They also don't use
  // Group/Subgroup/Family - that's Raw Material/Item Master's own
  // purchasing-side grouping (e.g. "Dairy", "Cleaning Supplies"), a
  // different audience from how a menu is organized for serving/POS.
  // Instead Menu Master gets its own Menu Category / Sub category pair,
  // pulled from the self-referencing MenuCategory tree - see
  // MenuCategories.tsx.
  const classificationFields: CrudFormField[] =
    screen === "menu"
      ? [
          { key: "menuCategoryId", label: "Menu category", type: "select", options: menuCategoryOptions },
          { key: "menuSubcategoryId", label: "Sub category", type: "select", options: menuSubcategoryOptions },
        ]
      : [
          { key: "categoryId", label: "Category", type: "select", options: categoryOptions },
          { key: "groupId", label: "Product group", type: "select", options: groupOptions },
          { key: "subgroupId", label: "Product subgroup", type: "select", options: subgroupOptions },
          { key: "familyId", label: "Product family", type: "select", options: familyOptions },
        ];

  // Only what's relevant to purchasing/stocking a physical ingredient -
  // a Menu item is a recipe/sellable, not something you reorder directly.
  const rawMaterialFields: CrudFormField[] = [
    { key: "purchaseUomId", label: "Purchase UOM (if different from base)", type: "select", options: uomOptions },
    { key: "batchRequired", label: "Batch tracking required", type: "checkbox" },
    { key: "expiryRequired", label: "Expiry tracking required", type: "checkbox" },
    { key: "shelfLifeDays", label: "Shelf life (days)", type: "number" },
    { key: "reorderLevel", label: "Reorder level", type: "number" },
    { key: "minStock", label: "Minimum stock", type: "number" },
    { key: "maxStock", label: "Maximum stock", type: "number" },
  ];

  // Only what's relevant to selling a dish - no reorder/batch/purchase UOM,
  // since a Menu item isn't purchased or stocked directly (its ingredients
  // are, via the Recipe panel below).
  const menuFields: CrudFormField[] = [
    { key: "salesUomId", label: "Sales UOM (if different from base)", type: "select", options: uomOptions },
    { key: "preparationTimeMinutes", label: "Prep time (minutes)", type: "number" },
    { key: "allergens", label: "Allergens", type: "text", placeholder: "e.g. Gluten, Nuts, Dairy" },
  ];

  // Everything else - packaging/stationery/spares/services. Still often
  // physically stocked (packaging, spares), so keeps reorder/purchase UOM;
  // Serialized is an Item Master-only concept (equipment/assets with
  // individual serial numbers tracked on purchase/sale).
  //
  // Item Type (Stock Items/Consumables/Expense Items/...) only shows here,
  // not on Raw Material or Menu - a raw material is always stock and a menu
  // item is never directly stocked (its ingredients are), so there's no
  // real decision to make there. Item Master is the one bucket where it
  // genuinely varies (packaging is stock, a service or fixed asset isn't).
  const itemFields: CrudFormField[] = [
    { key: "itemTypeId", label: "Item Type", type: "select", options: itemTypeOptions },
    { key: "purchaseUomId", label: "Purchase UOM (if different from base)", type: "select", options: uomOptions },
    { key: "reorderLevel", label: "Reorder level", type: "number" },
    { key: "minStock", label: "Minimum stock", type: "number" },
    { key: "maxStock", label: "Maximum stock", type: "number" },
    {
      key: "isSerialized",
      label: "Serialized (track individual serial numbers on purchase/sale)",
      type: "checkbox",
    },
  ];

  const extraFields = screen === "rawMaterial" ? rawMaterialFields : screen === "menu" ? menuFields : itemFields;

  // Menu category/sub category go right after the name fields on Menu
  // Master specifically ("bring it on top") - everywhere else keeps the
  // original order, with classification staying near the end of the form.
  const formFields =
    screen === "menu"
      ? [...topFields, ...classificationFields, ...forFlagsFields, ...restCoreFields, ...extraFields]
      : [...topFields, ...forFlagsFields, ...restCoreFields, ...classificationFields, ...extraFields];

  return (
    <CrudTable
      title={title}
      description={description}
      basePath="/api/inventory/items"
      extraQuery={`itemType=${itemTypes.join(",")}`}
      createDefaults={{
        itemType: defaultItemType,
        ...(screen === "rawMaterial" && defaultStockItemTypeId ? { itemTypeId: defaultStockItemTypeId } : {}),
        ...(screen === "menu" && defaultMenuUomId ? { baseUomId: defaultMenuUomId } : {}),
      }}
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "itemType", label: "Material stage" },
        { key: "itemTypeMaster", label: "Item Type", render: (row: any) => row.itemTypeMaster?.name },
        { key: "baseUom", label: "UOM", render: (row: any) => row.baseUom?.code },
        { key: "status", label: "Status" },
      ]}
      formFields={formFields}
      extraPanel={({ editingId, form }) => (
        <>
          <ItemPricesPanel itemId={editingId} />
          <ItemVendorPanel itemId={editingId} />
          <ItemBranchOrderQtyPanel itemId={editingId} />
          <ItemSalesHistoryPanel itemId={editingId} />
          {showsRecipePanel(form) && <ItemRecipePanel itemId={editingId} />}
          <ItemGlMappingPanel itemId={editingId} />
        </>
      )}
    />
  );
}
