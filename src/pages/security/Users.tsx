import { CrudTable } from "../../components/CrudTable";
import { UserAccessPanel } from "../../components/UserAccessPanel";
import { useOptions } from "../../lib/useOptions";

export default function Users() {
  // Every user is a candidate "manager" for someone else - see the Manager
  // field below and the approval-authority rule it feeds (a transaction's
  // approver can be either a role-based approver or the requester's own
  // manager, whichever applies - see backend's assertCanApprove).
  const userOptions = useOptions("/api/security/users", (u) => `${u.code ? `${u.code} - ` : ""}${u.displayName}`);

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
        { key: "manager", label: "Manager", render: (row: any) => row.manager?.displayName ?? "-" },
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
        {
          key: "managerId",
          label: "Manager (who approves this user's transactions if they don't hold an approving role themselves)",
          type: "select",
          options: userOptions,
        },
      ]}
      extraPanel={({ editingId }) => <UserAccessPanel userId={editingId} />}
    />
  );
}
