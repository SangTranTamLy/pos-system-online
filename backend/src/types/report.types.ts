export interface EmployeeRevenueReport {
  id: string; // UUID của nhân viên
  full_name: string;
  role_id: string;
  total_orders: number;
  total_revenue: number;
}
