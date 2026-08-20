import { CrudTable } from "../../components/CrudTable";
import { UserAccessPanel } from "../../components/UserAccessPanel";

export default function Users() {
  return (
    <CrudTable
      title="Users"
      description="Everyone who can log in. Roles, company scope, and branch/warehouse access are managed on each user's Access panel below."
      basePath="/api/security/users"
      createDefaults={{ allowGlobalLogin: true }}
      columns={[
        { key: "code", label: "Code" },
        { key: "displayName", label: "Name" },
        { key: "email", label: "Email" },
        { key: "mobile", label: "Mobile" },
        {
          key: "userRoles",
          label: "Roles",
          render: (row: any) =>
            row.userRoles?.length ? row.userRoles.map((ur: any) => ur.role?.code).join(", ") : "-",
        },
        { key: "status", label: "Status" },
      ]}
      formFields={[
        { key: "code", label: "Code", type: "text", placeholder: "U001" },
        { key: "displayName", label: "Name", type: "text", required: true },
        { key: "email", label: "Email", type: "text", required: true },
        { key: "mobile", label: "Mobile", type: "text" },
        { key: "password", label: "Password (set on create only - use Reset password below to change it later)", type: "password" },
        { key: "description", label: "Description", type: "textarea", placeholder: "Role in the business, notes, etc." },
        {
          key: "status",
          label: "Status",
          type: "select",
          options: [
            { value: "Invited", label: "Invited" },
            { value: "Active", label: "Active" },
            { value: "Locked", label: "Locked" },
            { value: "Inactive", label: "Inactive" },
          ],
        },
        { key: "allowGlobalLogin", label: "Allow \"All companies\" (Global) login", type: "checkbox" },
        {
          key: "sessionTimeoutMinutes",
          label: "Session timeout override (minutes, optional)",
          type: "number",
          placeholder: "Blank = server default (8h)",
        },
      ]}
      extraPanel={({ editingId }) => <UserAccessPanel userId={editingId} />}
    />
  );
}
