import { CrudTable } from "../../components/CrudTable";
import { useOptions } from "../../lib/useOptions";

/**
 * Landed-cost setup master (Transportation, Insurance, Handling, ...) used by
 * both the GRN and Purchase Invoice screens' Additional Costs panels. Each
 * type optionally maps to a GL account so posting a GRN/invoice with that
 * cost books straight to the right expense/asset account instead of landing
 * in a posting exception - see GrnAdditionalCost / PurchaseInvoiceAdditionalCost.
 */
export default function AdditionalCostTypes() {
  const glOptions = useOptions("/api/finance/chart-of-accounts", (a) => `${a.code} - ${a.name}`);
  const glLabel = (id: string | null | undefined) => glOptions.find((o) => o.value === id)?.label ?? "-";

  return (
    <CrudTable
      title="Additional Cost Types"
      description="Landed-cost line types (Transportation, Insurance, Handling, ...) that can be added to a GRN's or Purchase Invoice's own amount. Map each to a GL account so posting books it automatically."
      basePath="/api/procurement/additional-cost-types"
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "glAccountId", label: "GL Account", render: (row: any) => glLabel(row.glAccountId) },
        { key: "status", label: "Status" },
      ]}
      formFields={[
        { key: "code", label: "Code", type: "text", required: true, placeholder: "FREIGHT" },
        { key: "name", label: "Name", type: "text", required: true },
        {
          key: "glAccountId",
          label: "GL Account",
          type: "select",
          options: glOptions,
          placeholder: "Not mapped yet - postings will raise an exception until set",
        },
      ]}
    />
  );
}
