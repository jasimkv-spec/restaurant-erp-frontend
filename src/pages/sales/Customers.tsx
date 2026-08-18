import { CrudTable } from "../../components/CrudTable";
import { useOptions } from "../../lib/useOptions";

export default function Customers() {
  const countryOptions = useOptions("/api/masters/countries", (c) => `${c.code} - ${c.name}`);
  const cityOptions = useOptions("/api/masters/cities", (c) => `${c.code} - ${c.name}`);
  const areaOptions = useOptions("/api/masters/areas", (a) => a.name);
  const currencyOptions = useOptions("/api/masters/currencies", (c) => `${c.code} - ${c.name}`);
  const termsOptions = useOptions("/api/masters/terms", (t) => `${t.code} - ${t.name}`);

  return (
    <CrudTable
      title="Customers"
      description="Who you sell to. The currency here is what sales quotes and invoices default to for this customer - amounts still get converted to the company's base currency for the books."
      basePath="/api/sales/customers"
      attachments={{ moduleCode: "Sales.Customer" }}
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "customerType", label: "Type" },
        { key: "currency", label: "Currency", render: (row: any) => row.currency?.code },
        { key: "status", label: "Status" },
      ]}
      formFields={[
        { key: "code", label: "Code", type: "text", placeholder: "Leave blank to auto-generate, e.g. CUS0001" },
        { key: "name", label: "Name", type: "text", required: true },
        {
          key: "customerType",
          label: "Type",
          type: "select",
          options: [
            { value: "Walk-in", label: "Walk-in" },
            { value: "Corporate", label: "Corporate" },
            { value: "Aggregator", label: "Aggregator" },
            { value: "Staff", label: "Staff" },
          ],
        },
        { key: "contactPerson", label: "Contact person", type: "text" },
        { key: "phone", label: "Phone", type: "text" },
        { key: "whatsapp", label: "WhatsApp", type: "text" },
        { key: "email", label: "Email", type: "text" },
        { key: "address", label: "Address", type: "text" },
        { key: "countryId", label: "Country", type: "select", options: countryOptions },
        { key: "cityId", label: "City", type: "select", options: cityOptions },
        { key: "areaId", label: "Area", type: "select", options: areaOptions },
        {
          key: "currencyId",
          label: "Currency",
          type: "select",
          options: currencyOptions,
        },
        { key: "paymentTermsId", label: "Payment terms", type: "select", options: termsOptions },
        { key: "creditLimit", label: "Credit limit", type: "number" },
        { key: "taxRegistrationNumber", label: "Tax registration no.", type: "text" },
        { key: "notes", label: "Notes", type: "text" },
      ]}
    />
  );
}
