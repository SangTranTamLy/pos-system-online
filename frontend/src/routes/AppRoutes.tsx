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
import StaffDashboard from "../pages/dashboard/StaffDashboard";

function RootRedirect() {
  const rawUser = localStorage.getItem("auth_user");
  if (!rawUser) return <Navigate to="/login" replace />;

  let role: string | undefined;
  try {
    const user = JSON.parse(rawUser);
    role = user.roleName?.trim().toLowerCase();
  } catch {
    return <Navigate to="/login" replace />;
  }

  if (role === "admin" || role === "manager") {
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/staff-dashboard" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RootRedirect />} />

      {/* Routes for everyone (Admin, Manager, Staff) */}
      <Route element={<ProtectedRoute allowedRoles={["admin", "manager", "staff"]} />}>
        <Route path="/pos" element={<PosPage />} />
        <Route path="/invoices" element={<InvoicePage />} />
        <Route path="/customers" element={<CustomerPage />} />
        <Route path="/shifts" element={<ShiftsPage />} />
      </Route>

      {/* Routes for Staff only */}
      <Route element={<ProtectedRoute allowedRoles={["staff", "cashier"]} />}>
        <Route path="/staff-dashboard" element={<StaffDashboard />} />
      </Route>

      {/* Routes for Admin & Manager only */}
      <Route element={<ProtectedRoute allowedRoles={["admin", "manager"]} />}>
        <Route path="/dashboard" element={<DashboardPage />} />
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
