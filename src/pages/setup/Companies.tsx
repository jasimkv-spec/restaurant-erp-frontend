import { CrudTable } from "../../components/CrudTable";

export default function Companies() {
  return (
    <CrudTable
      title="Companies"
      description="Legal entities under this tenant. Everything else (branches, warehouses, chart of accounts) hangs off a company."
      basePath="/api/admin/companies"
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "legalName", label: "Legal name" },
        { key: "status", label: "Status" },
      ]}
      formFields={[
        { key: "code", label: "Code", type: "text", required: true, placeholder: "HQ" },
        { key: "name", label: "Name", type: "text", required: true },
        { key: "legalName", label: "Legal name", type: "text" },
        { key: "taxNo", label: "Tax number", type: "text" },
        { key: "registrationNumber", label: "Registration number", type: "text" },
        { key: "contactNumber", label: "Contact number", type: "text" },
        { key: "address", label: "Address", type: "text" },
      ]}
    />
  );
}
