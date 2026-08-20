import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Lock } from "lucide-react";
import { api, ApiError, type ListResponse } from "../lib/apiClient";

interface Permission {
  id: string;
  moduleCode: string;
  screenCode: string;
  actionCode: string;
}

interface RolePermissionGrant {
  id: string;
  permissionId: string;
  allowed: boolean;
  permission: Permission;
}

// Fixed column order when present, so common actions line up the same way
// across every screen instead of jumping around alphabetically - the rest
// (screen-specific verbs like "Dispatch"/"ViewCost") are appended after in
// whatever order the catalog returns them.
const COLUMN_PRIORITY = ["View", "Create", "Edit", "Submit", "Approve", "Post", "Delete", "Print", "Export", "Import"];

function sortActions(actions: string[]): string[] {
  return [...actions].sort((a, b) => {
    const ai = COLUMN_PRIORITY.indexOf(a);
    const bi = COLUMN_PRIORITY.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

/**
 * The permission matrix for one Role - grouped Module -> Screen -> per-
 * action checkboxes (View/Create/Edit/... - whatever actions actually exist
 * for that screen in the global Permission catalog, seed.ts's
 * CRUD_SCREENS/CUSTOM_PERMISSIONS). Rendered as Roles.tsx's extraPanel,
 * existing roles only. Every checkbox is its own POST /role-permissions
 * upsert (see security.routes.ts) - no separate Save button, changes take
 * effect immediately (a logged-in user picks them up on their next login).
 */
export function RolePermissionsPanel({ editingId: roleId }: { editingId: string }) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [grants, setGrants] = useState<Record<string, boolean>>({}); // permissionId -> allowed
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [permsRes, grantsRes] = await Promise.all([
        api.get<ListResponse<Permission>>(`/api/security/permissions`),
        api.get<ListResponse<RolePermissionGrant>>(`/api/security/roles/${roleId}/permissions`),
      ]);
      setPermissions(permsRes.data);
      setGrants(Object.fromEntries(grantsRes.data.filter((g) => g.allowed).map((g) => [g.permissionId, true])));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load permissions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId]);

  const tree = useMemo(() => {
    const modules = new Map<string, Map<string, Permission[]>>();
    for (const p of permissions) {
      if (!modules.has(p.moduleCode)) modules.set(p.moduleCode, new Map());
      const screens = modules.get(p.moduleCode)!;
      if (!screens.has(p.screenCode)) screens.set(p.screenCode, []);
      screens.get(p.screenCode)!.push(p);
    }
    return modules;
  }, [permissions]);

  function toggleModule(moduleCode: string) {
    setOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleCode)) next.delete(moduleCode);
      else next.add(moduleCode);
      return next;
    });
  }

  async function setGrant(permissionId: string, allowed: boolean) {
    setSavingIds((prev) => new Set(prev).add(permissionId));
    setGrants((prev) => ({ ...prev, [permissionId]: allowed }));
    setError(null);
    try {
      await api.post("/api/security/role-permissions", { roleId, permissionId, allowed });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save permission");
      // Roll back the optimistic update on failure.
      setGrants((prev) => ({ ...prev, [permissionId]: !allowed }));
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(permissionId);
        return next;
      });
    }
  }

  async function toggleScreenAll(screenPerms: Permission[], next: boolean) {
    for (const p of screenPerms) {
      if (!!grants[p.id] !== next) await setGrant(p.id, next);
    }
  }

  if (loading) {
    return (
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="py-4 text-center text-sm text-gray-400">Loading permissions...</div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5 border-b border-gray-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
        <Lock size={12} />
        Permissions
      </div>
      <p className="mb-3 text-xs text-gray-500">
        Every screen and action this role can reach. Changes save immediately - a user holding this role sees them
        the next time they log in.
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200">
        {[...tree.keys()].sort().map((moduleCode) => {
          const screens = tree.get(moduleCode)!;
          const isOpen = openModules.has(moduleCode);
          const modulePerms = [...screens.values()].flat();
          const grantedCount = modulePerms.filter((p) => grants[p.id]).length;
          return (
            <div key={moduleCode} className="border-b border-gray-100 last:border-b-0">
              <button
                type="button"
                onClick={() => toggleModule(moduleCode)}
                className="flex w-full items-center justify-between bg-gray-50 px-3 py-2 text-left text-sm font-semibold text-navy-900 transition-colors hover:bg-gray-100"
              >
                <span className="flex items-center gap-1.5">
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  Module: {moduleCode}
                </span>
                <span className="text-[11px] font-normal text-gray-500">
                  {grantedCount} / {modulePerms.length} granted
                </span>
              </button>

              {isOpen && (
                <div className="divide-y divide-gray-100">
                  {[...screens.keys()].sort().map((screenCode) => {
                    const screenPerms = sortActions(screens.get(screenCode)!.map((p) => p.actionCode)).map(
                      (actionCode) => screens.get(screenCode)!.find((p) => p.actionCode === actionCode)!
                    );
                    const allGranted = screenPerms.every((p) => grants[p.id]);
                    return (
                      <div key={screenCode} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
                        <label className="flex w-48 shrink-0 cursor-pointer items-center gap-2 font-medium text-navy-900">
                          <input
                            type="checkbox"
                            checked={allGranted}
                            onChange={(e) => toggleScreenAll(screenPerms, e.target.checked)}
                            className="h-3.5 w-3.5 cursor-pointer rounded border-2 border-gray-300 text-brand-600 focus:ring-4 focus:ring-brand-100"
                            title="Select all actions for this screen"
                          />
                          {screenCode}
                        </label>
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {screenPerms.map((p) => (
                            <label
                              key={p.id}
                              className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                                grants[p.id]
                                  ? "border-brand-300 bg-brand-50 text-brand-700"
                                  : "border-gray-200 text-gray-600 hover:border-gray-300"
                              } ${savingIds.has(p.id) ? "opacity-50" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={!!grants[p.id]}
                                disabled={savingIds.has(p.id)}
                                onChange={(e) => setGrant(p.id, e.target.checked)}
                                className="h-3.5 w-3.5 cursor-pointer rounded border-2 border-gray-300 text-brand-600 focus:ring-4 focus:ring-brand-100"
                              />
                              {p.actionCode}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
