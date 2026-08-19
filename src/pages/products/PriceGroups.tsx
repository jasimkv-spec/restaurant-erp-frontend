import { CrudTable } from "../../components/CrudTable";
import { PriceGroupBranches } from "../../components/PriceGroupBranches";

/**
 * Create the group and name it (e.g. "Downtown outlets"), save it, then
 * check off which branches belong to it in the panel that appears below -
 * Item Prices then sets one price per item per group instead of per branch.
 */
export default function PriceGroups() {
  return (
    <CrudTable
      title="Price Groups"
      description="Named sets of branches that share one selling price per item - set up which branches belong here, then Item Prices picks a group instead of a single branch."
      basePath="/api/inventory/price-groups"
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "status", label: "Status" },
      ]}
      formFields={[
        { key: "code", label: "Code", type: "text", required: true },
        { key: "name", label: "Name", type: "text", required: true },
      ]}
      extraPanel={({ editingId }) => <PriceGroupBranches priceGroupId={editingId} />}
    />
  );
}
