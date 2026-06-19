import { db } from "../config/database";
import type { DatabaseUser } from "../types/auth.types";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export type UserRow = RowDataPacket & {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  role_id: string;
  is_active: number;
  phone: string;
  pin_code: string;
  role_name: string;
}

export type RoleRow = RowDataPacket & {
  id: string;
  name: string;
  description: string;
}

export const findUserByEmail = async (
  email: string
): Promise<DatabaseUser | null> => {
  const [rows] = await db.execute<UserRow[]>(
    `SELECT
      users.id,
      users.full_name,
      users.email,
      users.password_hash,
      users.phone,
      users.pin_code,
      users.role_id,
      users.is_active,
      r.name AS role_name
    FROM users
    JOIN roles r ON users.role_id = r.id
    WHERE users.email = ?
    LIMIT 1
    `,
    [email]
  );
  const user = rows[0];
  if (!user) {
    return null;
  }
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    passwordHash: user.password_hash,
    phone: user.phone,
    pinCode: user.pin_code,
    roleId: user.role_id,
    roleName: user.role_name,
    isActive: Boolean(user.is_active),
  };
};

export const findUserById = async (id: string): Promise<DatabaseUser | null> => {
  const [rows] = await db.execute<UserRow[]>(
    `SELECT
      users.id,
      users.full_name,
      users.email,
      users.password_hash,
      users.phone,
      users.pin_code,
      users.role_id,
      users.is_active,
      r.name AS role_name
    FROM users
    JOIN roles r ON users.role_id = r.id
    WHERE users.id = ?
    LIMIT 1
    `,
    [id]
  );
  const user = rows[0];
  if (!user) {
    return null;
  }
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    passwordHash: user.password_hash,
    phone: user.phone,
    pinCode: user.pin_code,
    roleId: user.role_id,
    roleName: user.role_name,
    isActive: Boolean(user.is_active),
  };
};

export const findAllUsers = async (): Promise<DatabaseUser[]> => {
  const [rows] = await db.execute<UserRow[]>(
    `SELECT
      users.id,
      users.full_name,
      users.email,
      users.password_hash,
      users.phone,
      users.pin_code,
      users.role_id,
      users.is_active,
      r.name AS role_name
    FROM users
    JOIN roles r ON users.role_id = r.id
    WHERE r.name != 'admin'
    ORDER BY users.created_at DESC
    `
  );
  return rows.map((user) => ({
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    passwordHash: user.password_hash,
    phone: user.phone,
    pinCode: user.pin_code,
    roleId: user.role_id,
    roleName: user.role_name,
    isActive: Boolean(user.is_active),
  }));
};

export const createUser = async (
  id: string,
  fullName: string,
  email: string | null,
  passwordHash: string | null,
  phone: string | null,
  pinCode: string | null,
  roleId: string,
  isActive: boolean = true
): Promise<void> => {
  await db.execute<ResultSetHeader>(
    `INSERT INTO users (id, full_name, email, password_hash, phone, pin_code, role_id, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, fullName, email, passwordHash, phone, pinCode, roleId, isActive ? 1 : 0]
  );
};

export const updateUser = async (
  id: string,
  fullName: string,
  email: string | null,
  roleId: string,
  isActive: boolean,
  phone: string | null = null,
  pinCode: string | null = null
): Promise<void> => {
  if (phone !== null && pinCode !== null) {
    await db.execute<ResultSetHeader>(
      `UPDATE users
       SET full_name = ?, email = ?, phone = ?, pin_code = ?, role_id = ?, is_active = ?
       WHERE id = ?`,
      [fullName, email, phone, pinCode, roleId, isActive ? 1 : 0, id]
    );
  } else if (phone !== null) {
    await db.execute<ResultSetHeader>(
      `UPDATE users
       SET full_name = ?, email = ?, phone = ?, role_id = ?, is_active = ?
       WHERE id = ?`,
      [fullName, email, phone, roleId, isActive ? 1 : 0, id]
    );
  } else if (pinCode !== null) {
    await db.execute<ResultSetHeader>(
      `UPDATE users
       SET full_name = ?, email = ?, pin_code = ?, role_id = ?, is_active = ?
       WHERE id = ?`,
      [fullName, email, pinCode, roleId, isActive ? 1 : 0, id]
    );
  } else {
    await db.execute<ResultSetHeader>(
      `UPDATE users
       SET full_name = ?, email = ?, role_id = ?, is_active = ?
       WHERE id = ?`,
      [fullName, email, roleId, isActive ? 1 : 0, id]
    );
  }
};

export const updateUserPassword = async (
  id: string,
  passwordHash: string
): Promise<void> => {
  await db.execute<ResultSetHeader>(
    `UPDATE users
     SET password_hash = ?
     WHERE id = ?`,
    [passwordHash, id]
  );
};

export const updateUserStatus = async (
  id: string,
  isActive: boolean
): Promise<void> => {
  await db.execute<ResultSetHeader>(
    `UPDATE users
     SET is_active = ?
     WHERE id = ?`,
    [isActive ? 1 : 0, id]
  );
};

export const getAllRoles = async (): Promise<RoleRow[]> => {
  const [rows] = await db.execute<RoleRow[]>(
    `SELECT id, name, description FROM roles WHERE name != 'admin' ORDER BY name ASC`
  );
  return rows;
};

export const findAllActiveUsersWithRoles = async (): Promise<DatabaseUser[]> => {
  const [rows] = await db.execute<UserRow[]>(
    `SELECT
      users.id,
      users.full_name,
      users.email,
      users.password_hash,
      users.phone,
      users.pin_code,
      users.role_id,
      users.is_active,
      r.name AS role_name
    FROM users
    JOIN roles r ON users.role_id = r.id
    WHERE users.is_active = TRUE
    `
  );
  return rows.map((user) => ({
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    passwordHash: user.password_hash,
    phone: user.phone,
    pinCode: user.pin_code,
    roleId: user.role_id,
    roleName: user.role_name,
    isActive: Boolean(user.is_active),
  }));
};