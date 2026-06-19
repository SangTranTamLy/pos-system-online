import {
  getRevenueAllEmployees,
  getRevenueByEmployeeId,
} from "../repositories/report.repository";

export async function getEmployeeRevenueService(
  userRole: string,
  userId: string,
  startDate?: string,
  endDate?: string
) {
  const role = userRole.trim().toUpperCase();

  if (role === "ADMIN" || role === "MANAGER") {
    return getRevenueAllEmployees(startDate, endDate);
  }

  // Cashier or Staff
  return getRevenueByEmployeeId(userId, startDate, endDate);
}
