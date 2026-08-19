import { useEffect, useState } from "react";
import { ChefHat, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "../lib/apiClient";
import { useOptions } from "../lib/useOptions";
import { FIELD_CLASS, LABEL_CLASS } from "./CrudTable";

const RECIPE_TYPES = [
  "Menu",
  "Semi-finished",
  "Production BOM",
  "Modifier",
  "Packaging",
  "Combo",
  "Staff Meal",
  "Catering",
];

interface IngredientRow {
  key: string;
  ingredientItemId: string;
  qty: string;
  uomId: string;
  wastagePct: string;
  isPackaging: boolean;
}

interface RecipeApiIngredient {
  id: string;
  ingredientItemId: string;
  qty: number;
  uomId: string;
  wastagePct: number;
  isPackaging: boolean;
  ingredientItem?: { code: string; name: string };
  uom?: { code: string };
}

interface RecipeApiVersion {
  id: string;
  versionNo: number;
  status: string;
  ingredients: RecipeApiIngredient[];
}

interface RecipeApiRecord {
  id: string;
  recipeType: string;
  defaultOutputQty: number;
  versions: RecipeApiVersion[];
}

let rowKeySeq = 0;
function blankRow(): IngredientRow {
  rowKeySeq += 1;
  return { key: `new-${rowKeySeq}`, ingredientItemId: "", qty: "", uomId: "", wastagePct: "0", isPackaging: false };
}

/**
 * Recipe / Bill of Materials for this item - only meaningful for items that
 * are actually built from other items, so it's shown conditionally (Menu,
 * Semi-finished, Finished item types, or anything flagged For Manufacture /
 * For Factory). Reuses the recipe engine that already exists for
 * production postings and POS costing:
 *  - recipeType "Combo" is how a kit/combo-meal's components are modeled
 *    (no separate Kit table needed - a kit is just a recipe).
 *  - each ingredient's "packaging material" checkbox is the existing
 *    isPackaging flag, for parcel/takeaway packaging consumed alongside
 *    the menu item itself.
 * Saving always creates a new recipe version (never edits one in place) -
 * that's the same approve/version history the Production Posting and POS
 * costing modules already rely on.
 */
export function ItemRecipePanel({ itemId }: { itemId: string }) {
  const [recipe, setRecipe] = useState<RecipeApiRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);

  const [recipeType, setRecipeType] = useState("Menu");
  const [defaultOutputQty, setDefaultOutputQty] = useState("1");
  const [rows, setRows] = useState<IngredientRow[]>([blankRow()]);

  const allItemOptions = useOptions("/api/inventory/items", (i) => `${i.code} - ${i.name}`);
  const ingredientOptions = allItemOptions.filter((o) => o.value !== itemId);
  const uomOptions = useOptions("/api/masters/uoms", (u) => `${u.code} - ${u.name}`);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: RecipeApiRecord[] }>(`/api/recipe/recipes?outputItemId=${itemId}`);
      const found = res.data[0] ?? null;
      setRecipe(found);
      if (found) {
        setRecipeType(found.recipeType);
        setDefaultOutputQty(String(found.defaultOutputQty));
        const latest = found.versions[0];
        setRows(
          latest && latest.ingredients.length > 0
            ? latest.ingredients.map((ing) => ({
                key: ing.id,
                ingredientItemId: ing.ingredientItemId,
                qty: String(ing.qty),
                uomId: ing.uomId,
                wastagePct: String(ing.wastagePct),
                isPackaging: ing.isPackaging,
              }))
            : [blankRow()]
        );
      } else {
        setRows([blankRow()]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load recipe");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  function updateRow(key: string, patch: Partial<IngredientRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  function validRows() {
    return rows.filter((r) => r.ingredientItemId && r.uomId && r.qty && Number(r.qty) !== 0);
  }

  async function handleSave() {
    const ingredients = validRows().map((r) => ({
      ingredientItemId: r.ingredientItemId,
      qty: Number(r.qty),
      uomId: r.uomId,
      wastagePct: Number(r.wastagePct || 0),
      isPackaging: r.isPackaging,
    }));
    if (ingredients.length === 0) {
      setError("Add at least one ingredient before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (recipe) {
        await api.post(`/api/recipe/recipes/${recipe.id}/versions`, { ingredients });
      } else {
        await api.post("/api/recipe/recipes", {
          outputItemId: itemId,
          recipeType,
          defaultOutputQty: Number(defaultOutputQty || 1),
          ingredients,
        });
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save recipe");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    const latest = recipe?.versions[0];
    if (!latest) return;
    setApproving(true);
    setError(null);
    try {
      await api.post(`/api/recipe/recipe-versions/${latest.id}/approve`, {});
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not approve version");
    } finally {
      setApproving(false);
    }
  }

  const latestVersion = recipe?.versions[0];

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5 border-b border-gray-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
        <ChefHat size={12} />
        Recipe / Bill of Materials
      </div>
      <p className="mb-3 text-xs text-gray-500">
        What this item is made from - ingredients, quantities, and wastage. Mark a line "Packaging" if it's a
        material only consumed for parcel/takeaway (e.g. a box or lid), not part of the item itself. A combo/kit's
        components are set up the same way, using recipe type "Combo".
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-4 text-center text-sm text-gray-400">Loading...</div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>Recipe type</label>
              <select
                className={FIELD_CLASS}
                value={recipeType}
                onChange={(e) => setRecipeType(e.target.value)}
                disabled={!!recipe}
              >
                {RECIPE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Default output qty</label>
              <input
                type="number"
                className={FIELD_CLASS}
                value={defaultOutputQty}
                onChange={(e) => setDefaultOutputQty(e.target.value)}
                disabled={!!recipe}
              />
            </div>
          </div>

          {recipe && latestVersion && (
            <div className="mb-3 flex items-center gap-2 text-xs text-gray-500">
              Version {latestVersion.versionNo} -{" "}
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                  latestVersion.status === "Approved"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                {latestVersion.status}
              </span>
              {latestVersion.status === "Draft" && (
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  className="ml-auto rounded-lg border-2 border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50"
                >
                  {approving ? "Approving..." : "Approve this version"}
                </button>
              )}
            </div>
          )}

          <div className="mb-3 overflow-hidden rounded-lg border border-gray-200">
            <div className="grid grid-cols-[1fr_6rem_7rem_6rem_7rem_2.5rem] gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <div>Ingredient</div>
              <div>Qty</div>
              <div>UOM</div>
              <div>Wastage %</div>
              <div>Packaging</div>
              <div></div>
            </div>
            <div className="divide-y divide-gray-100">
              {rows.map((row) => (
                <div
                  key={row.key}
                  className="grid grid-cols-[1fr_6rem_7rem_6rem_7rem_2.5rem] items-center gap-2 px-3 py-2"
                >
                  <select
                    className={FIELD_CLASS}
                    value={row.ingredientItemId}
                    onChange={(e) => updateRow(row.key, { ingredientItemId: e.target.value })}
                  >
                    <option value="">Select item...</option>
                    {ingredientOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className={FIELD_CLASS}
                    value={row.qty}
                    onChange={(e) => updateRow(row.key, { qty: e.target.value })}
                  />
                  <select
                    className={FIELD_CLASS}
                    value={row.uomId}
                    onChange={(e) => updateRow(row.key, { uomId: e.target.value })}
                  >
                    <option value="">UOM...</option>
                    {uomOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className={FIELD_CLASS}
                    value={row.wastagePct}
                    onChange={(e) => updateRow(row.key, { wastagePct: e.target.value })}
                  />
                  <label className="flex h-[38px] items-center justify-center gap-1.5 rounded-lg border-2 border-gray-300 bg-white text-xs font-medium text-navy-900">
                    <input
                      type="checkbox"
                      checked={row.isPackaging}
                      onChange={(e) => updateRow(row.key, { isPackaging: e.target.checked })}
                      className="h-4 w-4 cursor-pointer rounded border-2 border-gray-300 text-brand-600 focus:ring-4 focus:ring-brand-100"
                    />
                    Yes
                  </label>
                  <button
                    onClick={() => removeRow(row.key)}
                    className="flex h-[38px] w-[38px] items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    title="Remove ingredient"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setRows((prev) => [...prev, blankRow()])}
              className="flex items-center gap-1.5 rounded-lg border-2 border-gray-300 px-3 py-2 text-xs font-semibold text-navy-900 transition-colors hover:border-gray-400 hover:bg-gray-50"
            >
              <Plus size={14} />
              Add ingredient
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="ml-auto rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : recipe ? "Save as new version" : "Create recipe"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
