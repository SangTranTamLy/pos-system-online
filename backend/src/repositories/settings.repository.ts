import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { db } from "../config/database";
import type { SettingsMap } from "../types/settings.types";

export async function findAllSettings(): Promise<SettingsMap> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT `key`, `value` FROM settings"
  );
  
  const settings: SettingsMap = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

export async function getSettingByKey(key: string): Promise<string | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT `value` FROM settings WHERE `key` = ? LIMIT 1",
    [key]
  );
  if (rows.length === 0) return null;
  return rows[0].value;
}

export async function updateAllSettings(settings: SettingsMap): Promise<void> {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const [key, value] of Object.entries(settings)) {
      await conn.execute(
        `INSERT INTO settings (\`key\`, \`value\`)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE \`value\` = ?`,
        [key, String(value), String(value)]
      );
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

// List of all database tables to backup/restore in dependency order
const DATABASE_TABLES = [
  "roles",
  "users",
  "categories",
  "products",
  "customers",
  "promotions",
  "promotion_rules",
  "suppliers",
  "goods_receipts",
  "goods_receipt_details",
  "raw_materials",
  "goods_receipt_material_details",
  "orders",
  "order_details",
  "payments",
  "stock_transactions",
  "waste_transactions",
  "shifts",
  "audit_logs",
  "settings"
];

export async function backupDatabase(): Promise<Record<string, unknown[]>> {
  const backupData: Record<string, unknown[]> = {};
  
  for (const tableName of DATABASE_TABLES) {
    try {
      const [rows] = await db.execute<RowDataPacket[]>(`SELECT * FROM \`${tableName}\``);
      backupData[tableName] = rows;
    } catch (error: any) {
      console.warn(`Could not backup table ${tableName} (it might not exist yet):`, error.message);
      // Skip if table does not exist
    }
  }
  
  return backupData;
}

export async function restoreDatabase(backupData: Record<string, unknown[]>): Promise<void> {
  const conn = await db.getConnection();
  try {
    await conn.execute("SET FOREIGN_KEY_CHECKS = 0;");
    
    // Clear and restore tables in the order listed
    for (const tableName of DATABASE_TABLES) {
      // Clean table first
      try {
        await conn.execute(`TRUNCATE TABLE \`${tableName}\``);
      } catch (err: any) {
        console.warn(`Could not truncate table ${tableName}:`, err.message);
        continue; // Skip if table doesn't exist
      }
      
      const rows = backupData[tableName] as Record<string, any>[];
      if (!rows || rows.length === 0) continue;
      
      const columns = Object.keys(rows[0]);
      const keysEscaped = columns.map(col => `\`${col}\``).join(', ');
      const placeholders = columns.map(() => '?').join(', ');
      const query = `INSERT INTO \`${tableName}\` (${keysEscaped}) VALUES (${placeholders})`;
      
      for (const row of rows) {
        const values = columns.map(col => {
          const val = row[col];
          // Handle object/array fields (like metadata or config JSON)
          if (val && typeof val === 'object' && !(val instanceof Date)) {
            return JSON.stringify(val);
          }
          return val;
        });
        await conn.execute(query, values);
      }
    }
  } catch (error) {
    throw error;
  } finally {
    try {
      await conn.execute("SET FOREIGN_KEY_CHECKS = 1;");
    } catch (e) {}
    conn.release();
  }
}
