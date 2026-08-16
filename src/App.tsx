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

          <Route path="/" element={<Navigate to="/setup/companies" replace />} />
          <Route path="*" element={<Navigate to="/setup/companies" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
