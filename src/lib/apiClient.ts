// Thin fetch wrapper matching the backend's exact response shapes:
//   - list endpoints (crudRouter GET /):        { data: T[], page, pageSize, total }
//   - single-record endpoints (GET/POST /:id):  T directly (a bare object)
//   - errors (middleware/errorHandler.ts):      { error: string, details?, meta?, code? }
//
// Auth: every /api/* call needs both X-Tenant-Code and Authorization
// headers (see backend README's "Authentication model" section). Token +
// tenant code are kept in localStorage so a refresh doesn't log you out.

const STORAGE_TOKEN_KEY = "erp_auth_token";
const STORAGE_TENANT_KEY = "erp_tenant_code";
const STORAGE_USER_KEY = "erp_user";
const STORAGE_ACTIVE_COMPANY_KEY = "erp_active_company";

/** "GLOBAL" = deliberately scoped to every company the user can access (each transaction picks its own Company, same as before this feature existed). A real id = scoped to just that one company - every screen auto-selects/locks Company to it and filters branch/warehouse pickers down to it. */
export type CompanyScope = string | "GLOBAL";

export interface AuthedUser {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  /** Flat "Module.Screen.Action" strings resolved from the user's roles at login - lets a screen gate a feature (e.g. only fetch stock balances for someone who could actually view them) without needing a fresh server round trip just to find out. Still purely a UI convenience: every actual write/read is re-checked server-side regardless. */
  permissions?: string[];
  /** Branches this user is explicitly restricted to (UserBranchAccess) - empty/absent means unrestricted (sees every branch). */
  branches?: { id: string; code: string; name: string; companyId: string; defaultWarehouseId: string | null }[];
  /** Every company touched by the branches above - the choices offered on the post-login company-scope screen. */
  companies?: { id: string; code: string; name: string }[];
  /** Users screen's "Allow All companies (Global) login" toggle - false hides the Global option on ChooseCompany.tsx, forcing this user to always pick one company. Undefined (older cached session) defaults to allowed. */
  allowGlobalLogin?: boolean;
}

/** True if the logged-in user's role(s) grant this exact permission string (e.g. "Inventory.StockBalance.View"). Absent/undefined permissions (older cached session, not yet re-logged-in) fails closed. */
export function hasPermission(user: AuthedUser | null, permission: string): boolean {
  return !!user?.permissions?.includes(permission);
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function getBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
}

export function getTenantCode(): string {
  return localStorage.getItem(STORAGE_TENANT_KEY) ?? import.meta.env.VITE_DEFAULT_TENANT_CODE ?? "demo";
}

export function setTenantCode(code: string) {
  localStorage.setItem(STORAGE_TENANT_KEY, code);
}

export function getToken(): string | null {
  return localStorage.getItem(STORAGE_TOKEN_KEY);
}

export function getStoredUser(): AuthedUser | null {
  const raw = localStorage.getItem(STORAGE_USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setSession(token: string, user: AuthedUser) {
  localStorage.setItem(STORAGE_TOKEN_KEY, token);
  localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_USER_KEY);
  localStorage.removeItem(STORAGE_ACTIVE_COMPANY_KEY);
}

/** null = no choice made yet this session (RequireAuth should route to the chooser). */
export function getActiveCompanyScope(): CompanyScope | null {
  return (localStorage.getItem(STORAGE_ACTIVE_COMPANY_KEY) as CompanyScope | null) ?? null;
}

export function setActiveCompanyScope(scope: CompanyScope) {
  localStorage.setItem(STORAGE_ACTIVE_COMPANY_KEY, scope);
}

async function request<T>(method: string, path: string, body?: unknown, opts?: { auth?: boolean }): Promise<T> {
  const auth = opts?.auth ?? true;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Tenant-Code": getTenantCode(),
  };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // DELETE endpoints (e.g. removing a tax from a tax group) return 204 No
  // Content, so there's no body to parse - only try for methods/statuses
  // that might actually have one.
  const text = res.status === 204 ? "" : await res.text();
  const json = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = json?.error ?? `Request failed with status ${res.status}`;
    throw new ApiError(res.status, message, json?.details);
  }
  return json as T;
}

export interface ListResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

// Multipart upload (file attachments) - deliberately not routed through
// request() above since that always sets Content-Type: application/json
// and JSON.stringifies the body. The browser sets the multipart boundary
// header itself when given a FormData body, so Content-Type is omitted here.
async function postForm<T>(path: string, formData: FormData): Promise<T> {
  const headers: Record<string, string> = { "X-Tenant-Code": getTenantCode() };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getBaseUrl()}${path}`, { method: "POST", headers, body: formData });
  const text = res.status === 204 ? "" : await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = json?.error ?? `Request failed with status ${res.status}`;
    throw new ApiError(res.status, message, json?.details);
  }
  return json as T;
}

// Downloads a file endpoint that requires the same auth headers as every
// other API call (so a plain <a href> won't work - the browser wouldn't
// attach the Authorization header). Fetches the bytes, then hands them to
// the browser's normal save-file flow via a throwaway object URL/anchor.
async function downloadFile(path: string, fallbackFileName: string): Promise<void> {
  const headers: Record<string, string> = { "X-Tenant-Code": getTenantCode() };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getBaseUrl()}${path}`, { method: "GET", headers });
  if (!res.ok) {
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    throw new ApiError(res.status, json?.error ?? `Download failed with status ${res.status}`, json?.details);
  }
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const fileName = match?.[1] ?? fallbackFileName;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
  postForm,
  downloadFile,
  login: (email: string, password: string) =>
    request<{ token: string; user: AuthedUser }>("POST", "/auth/login", { email, password }, { auth: false }),
};
