import { type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Companies from "./pages/setup/Companies";
import Branches from "./pages/setup/Branches";
import Warehouses from "./pages/setup/Warehouses";
import CostCentres from "./pages/setup/CostCentres";
import ProfitCentres from "./pages/setup/ProfitCentres";
import FinancialPeriods from "./pages/setup/FinancialPeriods";
import DocumentSeries from "./pages/setup/DocumentSeries";
import MasterSeries from "./pages/setup/MasterSeries";
import CompanyPolicies from "./pages/setup/CompanyPolicies";
import Currencies from "./pages/masters/Currencies";
import Countries from "./pages/masters/Countries";
import Cities from "./pages/masters/Cities";
import Areas from "./pages/masters/Areas";
import Banks from "./pages/masters/Banks";
import Taxes from "./pages/masters/Taxes";
import TaxGroups from "./pages/masters/TaxGroups";
import Uoms from "./pages/masters/Uoms";
import UomConversions from "./pages/masters/UomConversions";
import PaymentTerms from "./pages/masters/PaymentTerms";
import PaymentMethods from "./pages/masters/PaymentMethods";
import Vendors from "./pages/procurement/Vendors";
import Customers from "./pages/sales/Customers";
import DocumentTypes from "./pages/workflow/DocumentTypes";
import RawMaterialsMaster from "./pages/products/RawMaterialsMaster";
import MenuMaster from "./pages/products/MenuMaster";
import ItemMaster from "./pages/products/ItemMaster";
import ItemCategories from "./pages/products/ItemCategories";
import ProductGroups from "./pages/products/ProductGroups";
import ProductSubgroups from "./pages/products/ProductSubgroups";
import ProductFamilies from "./pages/products/ProductFamilies";
import Brands from "./pages/products/Brands";
import PriceGroups from "./pages/products/PriceGroups";
import ItemPrices from "./pages/products/ItemPrices";
import ItemVendorMappings from "./pages/products/ItemVendorMappings";

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/setup/companies" element={<RequireAuth><Companies /></RequireAuth>} />
          <Route path="/setup/branches" element={<RequireAuth><Branches /></RequireAuth>} />
          <Route path="/setup/warehouses" element={<RequireAuth><Warehouses /></RequireAuth>} />
          <Route path="/setup/cost-centres" element={<RequireAuth><CostCentres /></RequireAuth>} />
          <Route path="/setup/profit-centres" element={<RequireAuth><ProfitCentres /></RequireAuth>} />
          <Route path="/setup/financial-periods" element={<RequireAuth><FinancialPeriods /></RequireAuth>} />
          <Route path="/setup/document-series" element={<RequireAuth><DocumentSeries /></RequireAuth>} />
          <Route path="/setup/master-series" element={<RequireAuth><MasterSeries /></RequireAuth>} />
          <Route path="/setup/company-policies" element={<RequireAuth><CompanyPolicies /></RequireAuth>} />

          <Route path="/masters/currencies" element={<RequireAuth><Currencies /></RequireAuth>} />
          <Route path="/masters/countries" element={<RequireAuth><Countries /></RequireAuth>} />
          <Route path="/masters/cities" element={<RequireAuth><Cities /></RequireAuth>} />
          <Route path="/masters/areas" element={<RequireAuth><Areas /></RequireAuth>} />
          <Route path="/masters/banks" element={<RequireAuth><Banks /></RequireAuth>} />
          <Route path="/masters/taxes" element={<RequireAuth><Taxes /></RequireAuth>} />
          <Route path="/masters/tax-groups" element={<RequireAuth><TaxGroups /></RequireAuth>} />
          <Route path="/masters/uoms" element={<RequireAuth><Uoms /></RequireAuth>} />
          <Route path="/masters/uom-conversions" element={<RequireAuth><UomConversions /></RequireAuth>} />
          <Route path="/masters/payment-terms" element={<RequireAuth><PaymentTerms /></RequireAuth>} />
          <Route path="/masters/payment-methods" element={<RequireAuth><PaymentMethods /></RequireAuth>} />

          <Route path="/procurement/vendors" element={<RequireAuth><Vendors /></RequireAuth>} />
          <Route path="/sales/customers" element={<RequireAuth><Customers /></RequireAuth>} />
          <Route path="/workflow/document-types" element={<RequireAuth><DocumentTypes /></RequireAuth>} />

          <Route path="/products/raw-materials" element={<RequireAuth><RawMaterialsMaster /></RequireAuth>} />
          <Route path="/products/menu" element={<RequireAuth><MenuMaster /></RequireAuth>} />
          <Route path="/products/items" element={<RequireAuth><ItemMaster /></RequireAuth>} />
          <Route path="/products/item-categories" element={<RequireAuth><ItemCategories /></RequireAuth>} />
          <Route path="/products/product-groups" element={<RequireAuth><ProductGroups /></RequireAuth>} />
          <Route path="/products/product-subgroups" element={<RequireAuth><ProductSubgroups /></RequireAuth>} />
          <Route path="/products/product-families" element={<RequireAuth><ProductFamilies /></RequireAuth>} />
          <Route path="/products/brands" element={<RequireAuth><Brands /></RequireAuth>} />
          <Route path="/products/price-groups" element={<RequireAuth><PriceGroups /></RequireAuth>} />
          <Route path="/products/item-prices" element={<RequireAuth><ItemPrices /></RequireAuth>} />
          <Route path="/products/item-vendor-mappings" element={<RequireAuth><ItemVendorMappings /></RequireAuth>} />

          <Route path="/" element={<Navigate to="/setup/companies" replace />} />
          <Route path="*" element={<Navigate to="/setup/companies" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
