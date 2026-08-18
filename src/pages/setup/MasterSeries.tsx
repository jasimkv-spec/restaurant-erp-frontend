import { CrudTable } from "../../components/CrudTable";

export default function MasterSeries() {
  return (
    <CrudTable
      title="Master Series"
      description="Auto-numbering prefixes for master-data codes - e.g. entity type 'Vendor' with prefix 'SUP' generates SUP0001, SUP0002, ... Leave a vendor/customer's code blank when creating one and it picks up the next number here automatically."
      basePath="/api/admin/master-series"
      columns={[
        { key: "entityType", label: "Entity type" },
        { key: "prefix", label: "Prefix" },
        { key: "numberingMode", label: "Numbering" },
        { key: "nextNo", label: "Next number" },
        { key: "digitLength", label: "Digits" },
      ]}
      formFields={[
        {
          key: "entityType",
          label: "Entity type",
          type: "select",
          required: true,
          options: [
            { value: "Vendor", label: "Vendor" },
            { value: "Customer", label: "Customer" },
            { value: "Employee", label: "Employee" },
          ],
        },
        {
          key: "numberingMode",
          label: "Numbering",
          type: "select",
          options: [
            { value: "Auto", label: "Auto (system generates)" },
            { value: "Manual", label: "Manual (user types the code)" },
          ],
        },
        { key: "prefix", label: "Prefix", type: "text", required: true, placeholder: "SUP, VEN, CUS, CL, EMP..." },
        { key: "nextNo", label: "Next number", type: "number", placeholder: "1" },
        { key: "digitLength", label: "Digits to pad to", type: "number", placeholder: "4" },
        { key: "padChar", label: "Pad character", type: "text", placeholder: "0" },
        { key: "separator", label: "Separator (between prefix and number)", type: "text", placeholder: "" },
        { key: "includeYear", label: "Include year", type: "checkbox" },
        {
          key: "yearFormat",
          label: "Year format",
          type: "select",
          options: [
            { value: "YYYY", label: "YYYY (2026)" },
            { value: "YY", label: "YY (26)" },
          ],
        },
        { key: "includeMonth", label: "Include month", type: "checkbox" },
      ]}
    />
  );
}
