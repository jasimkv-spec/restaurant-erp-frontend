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
      ]}
    />
  );
}
