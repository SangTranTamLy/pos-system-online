export type SettingItem = {
  key: string;
  value: string;
};

export type SettingsMap = Record<string, string>;

export type UploadLogoBody = {
  fileName?: string;
  imageBase64?: string;
};
