import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "../pages/auth/LoginPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import ProtectedRoute from "./ProtectedRoute";
import CategoryPage from "../pages/categories/CategoryPage";
import ProductPage from "../pages/products/ProductPage";
import PosPage from "../pages/pos/PosPage";
import InvoicePage from "../pages/invoices/InvoicePage";
import CustomerPage from "../pages/customers/CustomerPage";
import PromotionsPage from "../pages/promotions/PromotionsPage";
import {
  AuditLogsPage,
  EmployeesPage,
  ReportsPage,
  SettingsPage,
  ShiftsPage,
} from "../pages/modules/ModuleScaffoldPage";
import { StockPage } from "../pages/inventory/StockPage";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/pos" element={<PosPage />} />
        <Route path="/products" element={<ProductPage />} />
        <Route path="/categories" element={<CategoryPage />} />
        <Route path="/stock/*" element={<StockPage />} />
        <Route path="/customers" element={<CustomerPage />} />
        <Route path="/invoices" element={<InvoicePage />} />
        <Route path="/promotions" element={<PromotionsPage />} />
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/shifts" element={<ShiftsPage />} />
        <Route path="/audit-logs" element={<AuditLogsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
