import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import monetixLogo from "../assets/monetix-logo.png";
import { Building2, Globe2 } from "lucide-react";

/**
 * Gate between login and the app proper - only actually shown when there's a
 * real decision to make (2+ companies the user can access; see
 * AuthContext.needsCompanyChoice). Picking a specific company scopes
 * everything - masters, transactions, settings - to it for the rest of the
 * session; picking "All companies" leaves every transaction screen asking
 * for its own Company the way they already did before this feature existed.
 * Reachable again later via the "Switch company" control in the sidebar
 * (Layout.tsx) if the user wants to change their mind mid-session.
 */
export default function ChooseCompany() {
  const { user, setActiveCompanyScope } = useAuth();
  const navigate = useNavigate();
  const companies = user?.companies ?? [];

  function choose(scope: string) {
    setActiveCompanyScope(scope);
    navigate("/setup/companies", { replace: true });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-brand-700 px-4 py-10">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-400 opacity-20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-brand-500 opacity-25 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          <img src={monetixLogo} alt="Monetix Solutions" className="mx-auto mb-1 w-full max-w-[200px]" />
          <h1 className="mt-4 text-center text-lg font-bold text-navy-900">Choose company</h1>
          <p className="mb-6 text-center text-sm text-gray-500">
            Work within one company, or across every company you have access to.
          </p>

          <div className="space-y-2">
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => choose(c.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-200 to-brand-600 text-navy-900">
                  <Building2 size={16} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-navy-900">{c.name}</div>
                  <div className="text-xs text-gray-500">{c.code}</div>
                </div>
              </button>
            ))}

            <button
              onClick={() => choose("GLOBAL")}
              className="flex w-full items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white px-4 py-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-100 text-navy-700">
                <Globe2 size={16} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-navy-900">All companies (Global)</div>
                <div className="text-xs text-gray-500">Pick a company on each transaction as you go</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
