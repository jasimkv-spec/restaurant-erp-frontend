import { CrudTable } from "../../components/CrudTable";
import { RolePermissionsPanel } from "../../components/RolePermissionsPanel";

export default function Roles() {
  return (
    <CrudTable
      title="Roles"
      description="A role is a named bundle of permissions - assign it to users on their Access panel (Users screen), optionally scoped to one company and/or a date range."
      basePath="/api/security/roles"
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "status", label: "Status" },
      ]}
      formFields={[
        { key: "code", label: "Code", type: "text", required: true, placeholder: "STOREKEEPER" },
        { key: "name", label: "Name", type: "text", required: true },
      ]}
      extraPanel={({ editingId }) => <RolePermissionsPanel editingId={editingId} />}
    />
  );
}
