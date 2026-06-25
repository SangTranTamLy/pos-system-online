import type { AxiosRequestConfig } from "axios";
import api from "./axios";

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    total: number;
    limit: number;
    offset: number;
  };
};

export const apiClient = api;

export async function apiRequest<T>(config: AxiosRequestConfig) {
  const response = await api.request<ApiResponse<T>>(config);
  return response.data;
}

export async function apiData<T>(config: AxiosRequestConfig) {
  const response = await apiRequest<T>(config);
  return response.data;
}
