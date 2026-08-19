import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError, getTenantCode, setTenantCode } from "../lib/apiClient";
import monetixLogo from "../assets/monetix-logo.png";
import { FIELD_CLASS } from "../components/CrudTable";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [tenantCode, setTenantCodeInput] = useState(getTenantCode());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      setTenantCode(tenantCode.trim());
      await login(email.trim(), password);
      navigate("/setup/companies", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed. Check the API is reachable.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-brand-700 px-4 py-10">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-400 opacity-20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-brand-500 opacity-25 blur-3xl" />
      <div className="pointer-events-none absolute right-1/3 top-1/4 h-40 w-40 rounded-full bg-navy-600 opacity-30 blur-2xl" />

      <div className="relative w-full max-w-sm">
        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          <img src={monetixLogo} alt="Monetix Solutions" className="mx-auto mb-1 w-full max-w-[220px]" />
          <p className="mb-6 text-center text-sm text-gray-500">Restaurant ERP &middot; sign in to continue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Tenant code</label>
              <input
                type="text"
                required
                className={FIELD_CLASS}
                value={tenantCode}
                onChange={(e) => setTenantCodeInput(e.target.value)}
                placeholder="demo"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Email</label>
              <input
                type="email"
                required
                className={FIELD_CLASS}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Password</label>
              <input
                type="password"
                required
                className={FIELD_CLASS}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:from-brand-700 hover:to-brand-600 hover:shadow-md disabled:opacity-50"
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-white/70">
          Connects to {import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"}
        </p>
      </div>
    </div>
  );
}
