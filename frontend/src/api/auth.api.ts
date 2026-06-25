import { API_BASE_URL } from "./api-base";
export type LoginPayload = {
  email: string;
  password: string;
};
export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  roleId: string;
  roleName: string;
};
export type LoginResponse = {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: AuthUser;
  };
};
export type MeResponse = {
  success: boolean;
  message: string;
  data: AuthUser;
};
export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Đăng nhập thất bại");
  }

  return data;
}

export async function loginPinApi(pin: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login-pin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ pin }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Đăng nhập mã PIN thất bại");
  }

  return data;
}
export async function getMe(token: string): Promise<MeResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Không lấy được thông tin người dùng");
  }

  return data;
}
