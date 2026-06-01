import { db } from "../config/database";
import type { DatabaseUser } from "../types/auth.types";
import type { RowDataPacket } from "mysql2";

type UserRow = RowDataPacket & {
  id: string;
  full_name:string;
  email:string;
  password_hash:string;
  role_id:string;
  is_active:number;
  role_name:string;
}
export const findUserByEmail = async(
  email: string
): Promise<DatabaseUser | null> => {
  const [rows] = await db.execute<UserRow[]>(
    `SELECT
      users.id,
      users.full_name,
      users.email,
      users.password_hash,
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
    roleId: user.role_id,
    roleName: user.role_name,
    isActive: Boolean(user.is_active),
  };
};