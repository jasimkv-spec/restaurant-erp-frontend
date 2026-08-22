import { useEffect, useState, type FormEvent } from "react";
import { getBaseUrl } from "../../lib/apiClient";
import { FIELD_CLASS } from "../../components/CrudTable";

// Deliberately its own, separate localStorage key from the main app's
// session (see apiClient.ts) - this is a completely different login
// (Super Admin, platform-wide) from whatever tenant you're logged into
// day-to-day in the regular app, in the same browser. Mixing the two into
// one stored session would clobber whichever one you signed into last.
const PLATFORM_TOKEN_KEY = "erp_platform_admin_token";

const MODULE_CODES = [
  { code: "Procurement", label: "Procurement", description: "Material Requests, RFQs, Purchase Orders" },
  { code: "Inventory", label: "Inventory", description: "Item master, stock (core data only for now - see note below)" },
  { code: "Recipe", label: "Recipes", description: "Recipes, recipe versions, production postings" },
];

interface TenantModuleRow {
  moduleCode: string;
  enabled: boolean;
}

interface PlatformTenant {
  id: string;
  code: string;
  name: string;
  subdomain: string;
  status: string;
  modules: TenantModuleRow[];
}

async function platformFetch(token: string, path: string, opts?: { method?: string; body?: unknown }) {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: opts?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(json?.error ?? `Request failed with status ${res.status}`);
  return json;
}

function LoginForm({ onLoggedIn }: { onLoggedIn: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${getBaseUrl()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-Code": "platform" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if (!res.ok) throw new Error(json?.error ?? "Login failed");
      if (!json.user?.roles?.includes("SuperAdmin")) {
        throw new Error("This account isn't a Platform Super Admin.");
      }
      localStorage.setItem(PLATFORM_TOKEN_KEY, json.token);
      onLoggedIn(json.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-900 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <h1 className="mb-1 text-center text-lg font-bold text-navy-900">Platform admin</h1>
        <p className="mb-6 text-center text-sm text-gray-500">Super Admin only - manage clients and their modules</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div>
            <label className="mb-1.5 block text-sm font-bold text-navy-900">Email</label>
            <input type="email" required className={FIELD_CLASS} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-navy-900">Password</label>
            <input type="password" required className={FIELD_CLASS} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-navy-900 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-navy-800 disabled:opacity-50"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

function NewTenantForm({ onCreated }: { onCreated: () => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${getBaseUrl()}/saas/tenants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), name: name.trim(), subdomain: subdomain.trim() }),
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if (!res.ok) throw new Error(json?.error ?? "Could not create tenant");
      setCode("");
      setName("");
      setSubdomain("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create tenant");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-brand-700">New client</div>
      {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input required placeholder="Tenant code (e.g. acme)" className={FIELD_CLASS} value={code} onChange={(e) => setCode(e.target.value)} />
        <input required placeholder="Client name" className={FIELD_CLASS} value={name} onChange={(e) => setName(e.target.value)} />
        <input required placeholder="Subdomain (e.g. acme)" className={FIELD_CLASS} value={subdomain} onChange={(e) => setSubdomain(e.target.value)} />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="mt-3 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {submitting ? "Creating..." : "Create client"}
      </button>
      <p className="mt-2 text-[11px] text-gray-500">
        New clients start with every module switched off below - turn on only what that client is meant to have.
      </p>
    </form>
  );
}

function TenantCard({ tenant, token, onChanged }: { tenant: PlatformTenant; token: string; onChanged: () => void }) {
  const [savingCode, setSavingCode] = useState<string | null>(null);

  const enabledByCode = new Map(tenant.modules.map((m) => [m.moduleCode, m.enabled]));

  async function toggle(moduleCode: string, next: boolean) {
    setSavingCode(moduleCode);
    try {
      await platformFetch(token, "/saas/tenant-modules", {
        method: "POST",
        body: { tenantId: tenant.id, moduleCode, enabled: next },
      });
      onChanged();
    } finally {
      setSavingCode(null);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-semibold text-navy-900">{tenant.name}</div>
          <div className="text-xs text-gray-500">
            {tenant.code} &middot; {tenant.status}
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {MODULE_CODES.map((m) => {
          const enabled = enabledByCode.get(m.code) ?? false;
          return (
            <label key={m.code} className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50">
              <div>
                <div className="text-sm font-medium text-navy-900">{m.label}</div>
                <div className="text-xs text-gray-500">{m.description}</div>
              </div>
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={enabled}
                disabled={savingCode === m.code}
                onChange={(e) => toggle(m.code, e.target.checked)}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    platformFetch(token, "/saas/tenants")
      .then((res) => setTenants(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load clients"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-navy-900">Platform admin</h1>
            <p className="text-sm text-gray-500">Clients and which modules each one has switched on.</p>
          </div>
          <button onClick={onLogout} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
            Sign out
          </button>
        </div>

        <NewTenantForm onCreated={load} />

        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {loading ? (
          <div className="py-10 text-center text-sm text-gray-400">Loading clients...</div>
        ) : tenants.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">No clients yet - add one above.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {tenants.map((t) => (
              <TenantCard key={t.id} tenant={t} token={token} onChanged={load} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlatformAdmin() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(PLATFORM_TOKEN_KEY));

  function handleLogout() {
    localStorage.removeItem(PLATFORM_TOKEN_KEY);
    setToken(null);
  }

  if (!token) return <LoginForm onLoggedIn={setToken} />;
  return <Dashboard token={token} onLogout={handleLogout} />;
}
