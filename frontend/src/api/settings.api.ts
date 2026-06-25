import { apiRequest } from "./api-client";

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

export function getSettings() {
  return apiRequest<Record<string, string>>({
    method: "GET",
    url: "/settings",
  });
}

export function updateSettings(payload: Record<string, string>) {
  return apiRequest<Record<string, string>>({
    method: "PUT",
    url: "/settings",
    data: payload,
  });
}

export async function uploadLogo(file: File) {
  const imageBase64 = await readFileAsDataUrl(file);

  return apiRequest<{ logoUrl: string }>({
    method: "POST",
    url: "/settings/upload-logo",
    data: {
      fileName: file.name,
      imageBase64,
    },
  });
}

export function downloadBackup() {
  return apiRequest<Record<string, unknown[]>>({
    method: "GET",
    url: "/settings/backup",
  });
}

export function restoreDatabase(backupData: Record<string, unknown[]>) {
  return apiRequest<null>({
    method: "POST",
    url: "/settings/restore",
    data: backupData,
  });
}
