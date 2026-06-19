export interface LoginRequestBody {
  email: string;
  password: string;
}

export interface LoginPinRequestBody {
  pin: string;
}

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  roleId: string;
  roleName: string;
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  fullName: string;
  roleId: string;
  roleName: string;
}

export interface DatabaseRole {
  name: string;
}

export type DatabaseUser = {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  phone: string;
  pinCode: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
}
