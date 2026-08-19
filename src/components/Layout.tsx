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
  DollarSign,
  Link2,
  Package,
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

interface NavGroup {
  key: string;
  label: string;
  icon: typeof Settings;
  items: NavItem[];
  /** Groups with no real screens yet are shown collapsed, greyed out, and un-clickable. */
  comingSoon?: boolean;
}

// Every module from the backend gets a group here, even the ones with no
// screens built yet - that way the nav shows the real shape of the ERP.
// Only Setup has working items; the rest render as a collapsed, greyed
// "coming soon" group so nothing looks clickable that isn't.
const NAV: NavGroup[] = [
  {
    key: "setup",
    label: "Setup",
    icon: Settings,
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
    ],
  },
  {
    key: "products",
    label: "Products",
    icon: Package,
    items: [
      { label: "Raw Materials Master", path: "/products/raw-materials", icon: Wheat },
      { label: "Menu Master", path: "/products/menu", icon: UtensilsCrossed },
      { label: "Item Master", path: "/products/items", icon: Boxes },
      { label: "Item categories", path: "/products/item-categories", icon: FolderTree },
      { label: "Product groups", path: "/products/product-groups", icon: Tags },
      { label: "Product subgroups", path: "/products/product-subgroups", icon: Tags },
      { label: "Product families", path: "/products/product-families", icon: Tags },
      { label: "Brands", path: "/products/brands", icon: Award },
      { label: "Price groups", path: "/products/price-groups", icon: Layers3 },
      { label: "Item prices", path: "/products/item-prices", icon: DollarSign },
      { label: "Item-vendor mapping", path: "/products/item-vendor-mappings", icon: Link2 },
    ],
  },
  { key: "inventory", label: "Inventory", icon: LayoutGrid, items: [], comingSoon: true },
  {
    key: "procurement",
    label: "Procurement",
    icon: Truck,
    items: [{ label: "Vendors", path: "/procurement/vendors", icon: Handshake }],
  },
  {
    key: "sales",
    label: "Sales",
    icon: ShoppingCart,
    items: [{ label: "Customers", path: "/sales/customers", icon: Users }],
  },
  { key: "accounting", label: "Accounting", icon: Wallet, items: [], comingSoon: true },
  {
    key: "workflow",
    label: "Workflow and approvals",
    icon: ClipboardList,
    items: [{ label: "Document types", path: "/workflow/document-types", icon: FileText }],
  },
  { key: "reports", label: "Reports", icon: BarChart3, items: [], comingSoon: true },
  { key: "admin", label: "Security and admin", icon: ShieldCheck, items: [], comingSoon: true },
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
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ setup: true });

  function toggleGroup(key: string) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const displayName = user?.displayName ?? user?.email ?? "";

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100">
      <aside className="flex w-56 shrink-0 flex-col bg-navy-800 px-2.5 py-4">
        <div className="mb-5 flex items-center gap-2 px-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-200 to-brand-600 text-sm font-medium text-navy-900">
            M
          </div>
          <div>
            <div className="text-sm font-medium text-white">
              Monetix<span className="text-brand-500">.</span>
            </div>
            <div className="text-[10px] text-navy-400">Restaurant ERP &middot; {getTenantCode()}</div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto">
          {NAV.map((group) => {
            const GroupIcon = group.icon;
            const isOpen = !!openGroups[group.key];
            return (
              <div key={group.key} className="mb-0.5">
                <button
                  type="button"
                  onClick={() => !group.comingSoon && toggleGroup(group.key)}
                  className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                    group.comingSoon ? "cursor-default text-navy-400" : "text-white hover:bg-navy-600"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <GroupIcon size={15} />
                    {group.label}
                  </span>
                  {group.comingSoon ? (
                    <span className="text-[9px] uppercase tracking-wide text-navy-400">Soon</span>
                  ) : isOpen ? (
                    <ChevronDown size={14} className="text-navy-400" />
                  ) : (
                    <ChevronRight size={14} className="text-navy-400" />
                  )}
                </button>

                {!group.comingSoon && isOpen && (
                  <div className="flex flex-col gap-0.5 pl-1 pt-0.5">
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          className={({ isActive }) =>
                            `flex items-center gap-2 rounded-lg border-l-2 px-2 py-1.5 text-[13px] transition-colors ${
                              isActive
                                ? "border-l-brand-500 bg-navy-600 font-semibold text-brand-500"
                                : "border-l-transparent text-navy-50 hover:bg-navy-600 hover:text-white"
                            }`
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <ItemIcon size={15} className={isActive ? "text-brand-500" : ""} />
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

        <div className="mt-2 flex items-center gap-2 border-t border-navy-600 px-2 pt-3">
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-navy-700 text-[11px] font-medium text-brand-500">
            {initials(displayName || "?")}
          </div>
          <div className="min-w-0 flex-1 truncate text-xs text-white">{displayName}</div>
          <button onClick={handleLogout} aria-label="Sign out" title="Sign out">
            <LogOut size={15} className="text-navy-400 hover:text-white" />
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
