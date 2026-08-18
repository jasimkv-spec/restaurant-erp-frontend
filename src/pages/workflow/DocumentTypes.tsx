import { CrudTable } from "../../components/CrudTable";

// Kept as a fixed list rather than free text, so what an admin picks here
// always matches the moduleCode a screen's Attachments panel filters by
// (see components/DocumentAttachments.tsx and pages/procurement/Vendors.tsx
// / pages/sales/Customers.tsx). Add a new option here whenever a new
// master or transaction screen wires up its own Attachments panel -
// Employee is the next one expected.
const MODULE_CODES = [
  { value: "Procurement.Vendor", label: "Vendors" },
  { value: "Sales.Customer", label: "Customers" },
];

export default function DocumentTypes() {
  return (
    <CrudTable
      title="Document Types"
      description="What kinds of documents can be attached to a master (Trade License, VAT Certificate, etc.) and whether an expiry date is required."
      basePath="/api/workflow/document-types"
      columns={[
        { key: "name", label: "Name" },
        {
          key: "moduleCode",
          label: "Used on",
          render: (row: any) => MODULE_CODES.find((m) => m.value === row.moduleCode)?.label ?? row.moduleCode,
        },
        { key: "expiryRequired", label: "Expiry required", render: (row: any) => (row.expiryRequired ? "Yes" : "No") },
        { key: "mandatory", label: "Mandatory", render: (row: any) => (row.mandatory ? "Yes" : "No") },
      ]}
      formFields={[
        { key: "name", label: "Name", type: "text", required: true, placeholder: "e.g. Trade License" },
        { key: "moduleCode", label: "Used on", type: "select", required: true, options: MODULE_CODES },
        { key: "expiryRequired", label: "Expiry date required", type: "checkbox" },
        { key: "verificationRequired", label: "Verification required", type: "checkbox" },
        { key: "mandatory", label: "Mandatory", type: "checkbox" },
      ]}
    />
  );
}
