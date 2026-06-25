import { apiData } from "./api-client";

export type Role = {
  id: string;
  name: string;
  description: string;
};

export type User = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
  passwordHash?: string;
  pinCode?: string;
};

export type CreateUserPayload = {
  fullName: string;
  email: string;
  phone: string;
  pinCode: string;
  password?: string;
  roleId: string;
  isActive?: boolean;
};

export type UpdateUserPayload = {
  fullName: string;
  email: string;
  phone?: string;
  pinCode?: string;
  roleId: string;
  isActive: boolean;
  password?: string;
};

export function fetchUsers(): Promise<User[]> {
  return apiData<User[]>({ method: "GET", url: "/users" });
}

export function fetchRoles(): Promise<Role[]> {
  return apiData<Role[]>({ method: "GET", url: "/users/roles" });
}

export function createUser(payload: CreateUserPayload): Promise<User> {
  return apiData<User>({ method: "POST", url: "/users", data: payload });
}

export function updateUser(
  id: string,
  payload: UpdateUserPayload
): Promise<User> {
  return apiData<User>({
    method: "PUT",
    url: `/users/${id}`,
    data: payload,
  });
}

export async function updateUserStatus(
  id: string,
  isActive: boolean
): Promise<void> {
  await apiData<unknown>({
    method: "PATCH",
    url: `/users/${id}/status`,
    data: { isActive },
  });
}
