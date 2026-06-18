const API_BASE_URL = "http://localhost:5000/api";

export type Role = {
  id: string;
  name: string;
  description: string;
};

export type User = {
  id: string;
  fullName: string;
  email: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
};

export type CreateUserPayload = {
  fullName: string;
  email: string;
  password?: string;
  roleId: string;
  isActive?: boolean;
};

export type UpdateUserPayload = {
  fullName: string;
  email: string;
  roleId: string;
  isActive: boolean;
  password?: string;
};

function getAuthHeaders() {
  const token = localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchUsers(): Promise<User[]> {
  const response = await fetch(`${API_BASE_URL}/users`, {
    headers: getAuthHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Lỗi lấy danh sách nhân viên");
  return data.data;
}

export async function fetchRoles(): Promise<Role[]> {
  const response = await fetch(`${API_BASE_URL}/users/roles`, {
    headers: getAuthHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Lỗi lấy danh sách quyền");
  return data.data;
}

export async function createUser(payload: CreateUserPayload): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/users`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Lỗi tạo nhân viên");
  return data.data;
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/users/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Lỗi cập nhật nhân viên");
  return data.data;
}

export async function updateUserStatus(id: string, isActive: boolean): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/users/${id}/status`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ isActive }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Lỗi cập nhật trạng thái nhân viên");
}
