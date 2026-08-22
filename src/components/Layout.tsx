import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Settings,
  ChevronDown,
  ChevronRight,
  Building2,
  MapPin,
  Warehouse,
  Receipt,
  PieChart,
  Calendar,
  LayoutGrid,
  Truck,
  Ship,
  ShoppingCart,
  Wallet,
  ClipboardList,
  BarChart3,
  ShieldCheck,
  LogOut,
  Globe2,
  Landmark,
  Coins,
  Map,
  Percent,
  Ruler,
  ArrowLeftRight,
  CalendarClock,
  CreditCard,
  Layers,
  Users,
  Handshake,
  Hash,
  ListOrdered,
  SlidersHorizontal,
  FileText,
  Boxes,
  Tags,
  FolderTree,
  Award,
  Package,
  PackageCheck,
  Wheat,
  UtensilsCrossed,
  Layers3,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getTenantCode } from "../lib/apiClient";

interface NavItem {
  label: string;
  path: string;
  icon: typeof Building2;
}

/**
 * Each module gets its own accent so the sidebar is scannable at a glance
 * (which module am I in?) instead of every group/item sharing one uniform
 * brand-blue highlight regardless of context. Written out as literal,
 * fully-composed class strings (not built from a `${color}-400` template)
 * since Tailwind's content scanner only picks up classes it can see
 * verbatim in the source - a dynamically-interpolated color name would
 * silently fail to generate its CSS.
 */
interface NavColor {
  icon: string;
  activeBg: string;
  activeBorder: string;
  activeText: string;
}

interface NavGroup {
  key: string;
  label: string;
  icon: typeof Settings;
  items: NavItem[];
  /** Groups with no real screens yet are shown collapsed, greyed out, and un-clickable. */
  comingSoon?: boolean;
  /** Omitted for comingSoon groups, which always render in flat grey regardless. */
  color?: NavColor;
}

const SKY: NavColor = { icon: "text-sky-400", activeBg: "bg-sky-500/15", activeBorder: "border-l-sky-400", activeText: "text-sky-300" };
const VIOLET: NavColor = { icon: "text-violet-400", activeBg: "bg-violet-500/15", activeBorder: "border-l-violet-400", activeText: "text-violet-300" };
const AMBER: NavColor = { icon: "text-amber-400", activeBg: "bg-amber-500/15", activeBorder: "border-l-amber-400", activeText: "text-amber-300" };
const EMERALD: NavColor = { icon: "text-emerald-400", activeBg: "bg-emerald-500/15", activeBorder: "border-l-emerald-400", activeText: "text-emerald-300" };
const ROSE: NavColor = { icon: "text-rose-400", activeBg: "bg-rose-500/15", activeBorder: "border-l-rose-400", activeText: "text-rose-300" };
const FUCHSIA: NavColor = { icon: "text-fuchsia-400", activeBg: "bg-fuchsia-500/15", activeBorder: "border-l-fuchsia-400", activeText: "text-fuchsia-300" };
const ORANGE: NavColor = { icon: "text-orange-400", activeBg: "bg-orange-500/15", activeBorder: "border-l-orange-400", activeText: "text-orange-300" };

// Every module from the backend gets a group here, even the ones with no
// screens built yet - that way the nav shows the real shape of the ERP.
// Only Setup has working items; the rest render as a collapsed, greyed
// "coming soon" group so nothing looks clickable that isn't.
const NAV: NavGroup[] = [
  {
    key: "setup",
    label: "Setup",
    icon: Settings,
    color: SKY,
    items: [
      { label: "Companies", path: "/setup/companies", icon: Building2 },
      { label: "Branches", path: "/setup/branches", icon: MapPin },
      { label: "Warehouses", path: "/setup/warehouses", icon: Warehouse },
      { label: "Cost centres", path: "/setup/cost-centres", icon: Receipt },
      { label: "Profit centres", path: "/setup/profit-centres", icon: PieChart },
      { label: "Financial periods", path: "/setup/financial-periods", icon: Calendar },
      { label: "Document series", path: "/setup/document-series", icon: Hash },
      { label: "Master series", path: "/setup/master-series", icon: ListOrdered },
      { label: "Company policies", path: "/setup/company-policies", icon: SlidersHorizontal },
    ],
  },
  {
    key: "masters",
    label: "General Masters",
    icon: LayoutGrid,
    color: VIOLET,
    items: [
      { label: "Currencies", path: "/masters/currencies", icon: Coins },
      { label: "Countries", path: "/masters/countries", icon: Globe2 },
      { label: "Cities", path: "/masters/cities", icon: Map },
      { label: "Areas", path: "/masters/areas", icon: MapPin },
      { label: "Banks", path: "/masters/banks", icon: Landmark },
      { label: "Taxes", path: "/masters/taxes", icon: Percent },
      { label: "Tax groups", path: "/masters/tax-groups", icon: Layers },
      { label: "Units of measure", path: "/masters/uoms", icon: Ruler },
      { label: "UOM conversions", path: "/masters/uom-conversions", icon: ArrowLeftRight },
      { label: "Payment terms", path: "/masters/payment-terms", icon: CalendarClock },
      { label: "Payment methods", path: "/masters/payment-methods", icon: CreditCard },
      { label: "Shipment types", path: "/masters/shipment-types", icon: Ship },
    ],
  },
  {
    key: "products",
    label: "Products",
    icon: Package,
    color: AMBER,
    items: [
      { label: "Raw Materials Master", path: "/products/raw-materials", icon: Wheat },
      { label: "Menu Master", path: "/products/menu", icon: UtensilsCrossed },
      { label: "Item Master", path: "/products/items", icon: Boxes },
      { label: "Item categories", path: "/products/item-categories", icon: FolderTree },
      { label: "Menu categories", path: "/products/menu-categories", icon: FolderTree },
      { label: "Product groups", path: "/products/product-groups", icon: Tags },
      { label: "Product subgroups", path: "/products/product-subgroups", icon: Tags },
      { label: "Product families", path: "/products/product-families", icon: Tags },
      { label: "Brands", path: "/products/brands", icon: Award },
      { label: "Price groups", path: "/products/price-groups", icon: Layers3 },
      { label: "Item types", path: "/products/item-types", icon: SlidersHorizontal },
    ],
  },
  { key: "inventory", label: "Inventory", icon: LayoutGrid, items: [], comingSoon: true },
  {
    key: "procurement",
    label: "Procurement",
    icon: Truck,
    color: EMERALD,
    items: [
      { label: "Vendors", path: "/procurement/vendors", icon: Handshake },
      { label: "Material Requests", path: "/procurement/material-requests", icon: ClipboardList },
      { label: "MR Consolidation", path: "/procurement/mr-consolidation", icon: Boxes },
      { label: "RFQs", path: "/procurement/rfqs", icon: FileText },
      { label: "Purchase Orders", path: "/procurement/purchase-orders", icon: ShoppingCart },
      { label: "Goods Receipt (GRN)", path: "/procurement/grns", icon: PackageCheck },
      { label: "Purchase Invoices", path: "/procurement/purchase-invoices", icon: FileText },
      { label: "Additional Cost Types", path: "/procurement/additional-cost-types", icon: Tags },
    ],
  },
  {
    key: "sales",
    label: "Sales",
    icon: ShoppingCart,
    color: ROSE,
    items: [{ label: "Customers", path: "/sales/customers", icon: Users }],
  },
  { key: "accounting", label: "Accounting", icon: Wallet, items: [], comingSoon: true },
  {
    key: "workflow",
    label: "Workflow and approvals",
    icon: ClipboardList,
    color: FUCHSIA,
    items: [{ label: "Document types", path: "/workflow/document-types", icon: FileText }],
  },
  { key: "reports", label: "Reports", icon: BarChart3, items: [], comingSoon: true },
  {
    key: "admin",
    label: "Security and admin",
    icon: ShieldCheck,
    color: ORANGE,
    items: [
      { label: "Users", path: "/security/users", icon: Users },
      { label: "Roles", path: "/security/roles", icon: ShieldCheck },
    ],
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout, activeCompanyScope } = useAuth();
  const navigate = useNavigate();
  const scopedCompany = user?.companies?.find((c) => c.id === activeCompanyScope);
  const canSwitchCompany = (user?.companies?.length ?? 0) > 1;
  // Accordion, not independent toggles - only one group open at a time, so
  // opening a new one doesn't leave the previous group's items still
  // expanded above it (which pushed the new group's items off-screen and
  // forced scrolling to find them).
  const [openGroup, setOpenGroup] = useState<string | null>("setup");

  function toggleGroup(key: string) {
    setOpenGroup((prev) => (prev === key ? null : key));
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const displayName = user?.displayName ?? user?.email ?? "";

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100">
      <aside className="flex w-72 shrink-0 flex-col bg-navy-800 px-3 py-5">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-200 to-brand-600 text-base font-medium text-navy-900">
            M
          </div>
          <div>
            <div className="text-base font-medium text-white">
              Monetix<span className="text-brand-500">.</span>
            </div>
            <div className="text-xs text-navy-400">Restaurant ERP &middot; {getTenantCode()}</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto">
          {NAV.map((group) => {
            const GroupIcon = group.icon;
            const isOpen = openGroup === group.key;
            return (
              <div key={group.key} className="mb-1">
                <button
                  type="button"
                  onClick={() => !group.comingSoon && toggleGroup(group.key)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                    group.comingSoon ? "cursor-default text-navy-400" : "text-white hover:bg-navy-600"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <GroupIcon size={18} className={group.color ? group.color.icon : undefined} />
                    {group.label}
                  </span>
                  {group.comingSoon ? (
                    <span className="text-[10px] uppercase tracking-wide text-navy-400">Soon</span>
                  ) : isOpen ? (
                    <ChevronDown size={16} className="text-navy-400" />
                  ) : (
                    <ChevronRight size={16} className="text-navy-400" />
                  )}
                </button>

                {!group.comingSoon && isOpen && (
                  <div className="flex flex-col gap-1 pl-1.5 pt-1">
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const c = group.color;
                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 rounded-lg border-l-[3px] px-3 py-2 text-sm transition-colors ${
                              isActive
                                ? `${c ? c.activeBorder : "border-l-brand-500"} ${c ? c.activeBg : "bg-navy-600"} font-semibold ${c ? c.activeText : "text-brand-500"}`
                                : "border-l-transparent text-navy-50 hover:bg-navy-600 hover:text-white"
                            }`
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <ItemIcon size={17} className={isActive && c ? c.icon : undefined} />
                              {item.label}
                            </>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <button
          onClick={() => canSwitchCompany && navigate("/choose-company")}
          disabled={!canSwitchCompany}
          title={canSwitchCompany ? "Switch company" : undefined}
          className={`mt-2 flex items-center gap-2.5 rounded-lg border-t border-navy-600 px-2 pt-3 text-left ${canSwitchCompany ? "hover:bg-navy-600" : "cursor-default"}`}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-navy-700 text-brand-500">
            {scopedCompany ? <Building2 size={15} /> : <Globe2 size={15} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white">{scopedCompany ? scopedCompany.name : "All companies"}</div>
            {canSwitchCompany && <div className="text-xs text-navy-400">Switch company</div>}
          </div>
        </button>

        <div className="flex items-center gap-2.5 px-2 pb-1 pt-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-700 text-xs font-medium text-brand-500">
            {initials(displayName || "?")}
          </div>
          <div className="min-w-0 flex-1 truncate text-sm text-white">{displayName}</div>
          <button onClick={handleLogout} aria-label="Sign out" title="Sign out">
            <LogOut size={17} className="text-navy-400 hover:text-white" />
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
