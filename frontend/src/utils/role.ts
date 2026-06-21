export function translateRole(roleName: string | null | undefined): string {
  if (!roleName) return "";
  const name = roleName.trim().toLowerCase();
  switch (name) {
    case "admin":
      return "Quản trị viên";
    case "manager":
      return "Quản lý";
    case "staff":
      return "Nhân viên";
    case "cashier":
      return "Thu ngân";
    default:
      return roleName;
  }
}
