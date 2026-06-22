import { Navigate, Outlet } from "react-router-dom";

type ProtectedRouteProps = {
  allowedRoles?: string[];
};

function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const token = localStorage.getItem("auth_token");
  const storedUser = localStorage.getItem("auth_user");

  if (!token || !storedUser) {
    return <Navigate to="/login" replace />;
  }

  // Tính toán redirect path bên trong try/catch (không dùng JSX trong try/catch)
  let redirectTo: string | null = null;
  try {
    const user = JSON.parse(storedUser) as { roleName?: string };
    const userRole = user.roleName?.toLowerCase();

    if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
      redirectTo = userRole === "staff" ? "/pos" : "/dashboard";
    }
  } catch {
    redirectTo = "/login";
  }

  // Render JSX bên ngoài try/catch
  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;