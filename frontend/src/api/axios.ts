import axios, { AxiosError } from "axios";
import { API_BASE_URL } from "./api-base";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
});

function logoutAndRedirect() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");

  if (!window.location.pathname.includes("/login")) {
    window.location.href = `${import.meta.env.BASE_URL}login`;
  }
}

api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("accessToken") || localStorage.getItem("auth_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    if (error.code === "ECONNABORTED") {
      throw new Error("Kết nối API quá lâu, vui lòng thử lại sau.");
    }

    if (error.response?.status === 401) {
      logoutAndRedirect();
      throw new Error(
        error.response.data?.message || "Phiên đăng nhập đã hết hạn."
      );
    }

    throw new Error(
      error.response?.data?.message ||
        error.message ||
        "Không kết nối được API."
    );
  }
);

export default api;
