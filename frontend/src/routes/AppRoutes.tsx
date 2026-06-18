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
import EmployeePage from "../pages/employees/EmployeePage";
import {
  AuditLogsPage,
  ReportsPage,
  SettingsPage,
} from "../pages/modules/ModuleScaffoldPage";
import ShiftsPage from "../pages/shifts/ShiftsPage";
import { StockPage } from "../pages/inventory/StockPage";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Routes for everyone (Admin, Manager, Staff) */}
      <Route element={<ProtectedRoute allowedRoles={["admin", "manager", "staff"]} />}>
        <Route path="/pos" element={<PosPage />} />
        <Route path="/invoices" element={<InvoicePage />} />
        <Route path="/customers" element={<CustomerPage />} />
        <Route path="/shifts" element={<ShiftsPage />} />
      </Route>

      {/* Routes for Admin & Manager only */}
      <Route element={<ProtectedRoute allowedRoles={["admin", "manager"]} />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/products" element={<ProductPage />} />
        <Route path="/categories" element={<CategoryPage />} />
        <Route path="/stock/*" element={<StockPage />} />
        <Route path="/promotions" element={<PromotionsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/employees" element={<EmployeePage />} />
      </Route>

      {/* Routes for Admin only */}
      <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
        <Route path="/audit-logs" element={<AuditLogsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
