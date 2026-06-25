import { apiClient } from "./api-client";

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
  const response = await apiClient.post<LoginResponse>("/auth/login", payload);
  return response.data;
}

export async function loginPinApi(pin: string): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>("/auth/login-pin", {
    pin,
  });
  return response.data;
}

export async function getMe(token: string): Promise<MeResponse> {
  const response = await apiClient.get<MeResponse>("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}
