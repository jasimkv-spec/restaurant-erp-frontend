import { CrudTable } from "../../components/CrudTable";
import { useOptions } from "../../lib/useOptions";

export default function Companies() {
  const currencyOptions = useOptions("/api/masters/currencies", (c) => `${c.code} - ${c.name}`);

  return (
    <CrudTable
      title="Companies"
      description="Legal entities under this tenant. Everything else (branches, warehouses, chart of accounts) hangs off a company."
      basePath="/api/admin/companies"
      columns={[
        {
          key: "logoUrl",
          label: "Logo",
          render: (row: any) =>
            row.logoUrl ? (
              <img src={row.logoUrl} alt="" className="h-6 w-6 rounded border border-gray-200 object-contain" />
            ) : (
              "-"
            ),
        },
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "legalName", label: "Legal name" },
        { key: "baseCurrency", label: "Base currency", render: (row: any) => row.baseCurrency?.code },
        { key: "status", label: "Status" },
      ]}
      formFields={[
        { key: "code", label: "Code", type: "text", required: true, placeholder: "HQ" },
        { key: "name", label: "Name", type: "text", required: true },
        { key: "legalName", label: "Legal name", type: "text" },
        {
          key: "baseCurrencyId",
          label: "Base (financial) currency",
          type: "select",
          required: true,
          options: currencyOptions,
        },
        { key: "taxNo", label: "Tax number", type: "text" },
        { key: "registrationNumber", label: "Registration number", type: "text" },
        { key: "contactNumber", label: "Contact number", type: "text" },
        { key: "address", label: "Address", type: "text" },
        { key: "logoUrl", label: "Logo", type: "file" },
        {
          key: "dateFormat",
          label: "Date format",
          type: "select",
          options: [
            { value: "dd-MM-yyyy", label: "DD-MM-YYYY (31-12-2026)" },
            { value: "MM-dd-yyyy", label: "MM-DD-YYYY (12-31-2026)" },
            { value: "yyyy-MM-dd", label: "YYYY-MM-DD (2026-12-31)" },
            { value: "dd/MM/yyyy", label: "DD/MM/YYYY (31/12/2026)" },
          ],
        },
        {
          key: "timeFormat",
          label: "Time format",
          type: "select",
          options: [
            { value: "24h", label: "24-hour (14:30)" },
            { value: "12h", label: "12-hour (2:30 PM)" },
          ],
        },
        {
          key: "transactionHeaderText",
          label: "Transaction header text",
          type: "textarea",
          placeholder: "Shown at the top of every printed transaction for this company (e.g. registered address, VAT no.)",
        },
        {
          key: "transactionFooterText",
          label: "Transaction footer text",
          type: "textarea",
          placeholder: "Shown at the bottom of every printed transaction for this company (e.g. terms, signature block)",
        },
        {
          key: "poTermsConditions",
          label: "PO Terms & Conditions",
          type: "textarea",
          placeholder: "Standing terms & conditions printed on every Purchase Order for this company (payment terms, delivery/inspection terms, penalties, etc.)",
        },
      ]}
    />
  );
}
