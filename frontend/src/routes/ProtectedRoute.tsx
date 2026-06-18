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

  try {
    const user = JSON.parse(storedUser);
    const userRole = user.roleName?.toLowerCase();

    if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
      // Redirect to a safe default page based on role if unauthorized
      if (userRole === "staff") {
        return <Navigate to="/pos" replace />;
      }
      return <Navigate to="/dashboard" replace />;
    }
  } catch (error) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;