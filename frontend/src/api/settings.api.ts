const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  "http://localhost:5000/api";

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

function getAuthToken() {
  return localStorage.getItem("auth_token");
}

function getAuthHeaders() {
  const token = getAuthToken();

  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
}

function logoutAndRedirect() {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");

  if (!window.location.pathname.includes("/login")) {
    window.location.href = `${import.meta.env.BASE_URL}login`;
  }
}

async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const data = await response.json();

  if (response.status === 401) {
    logoutAndRedirect();
    throw new Error(data.message || "Phiên đăng nhập đã hết hạn.");
  }

  if (!response.ok) {
    throw new Error(data.message || "Yêu cầu API thất bại.");
  }

  return data;
}

export async function getSettings() {
  const response = await fetch(`${API_BASE_URL}/settings`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  return handleResponse<Record<string, string>>(response);
}

export async function updateSettings(payload: Record<string, string>) {
  const response = await fetch(`${API_BASE_URL}/settings`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse<Record<string, string>>(response);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Không đọc được file ảnh."));
    };

    reader.onerror = () => {
      reject(new Error("Không đọc được file ảnh."));
    };

    reader.readAsDataURL(file);
  });
}

export async function uploadLogo(file: File) {
  const imageBase64 = await readFileAsDataUrl(file);

  const response = await fetch(`${API_BASE_URL}/settings/upload-logo`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      fileName: file.name,
      imageBase64,
    }),
  });

  return handleResponse<{ logoUrl: string }>(response);
}

export async function downloadBackup() {
  const response = await fetch(`${API_BASE_URL}/settings/backup`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  return handleResponse<Record<string, unknown[]>>(response);
}

export async function restoreDatabase(backupData: Record<string, unknown[]>) {
  const response = await fetch(`${API_BASE_URL}/settings/restore`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(backupData),
  });

  return handleResponse<null>(response);
}

