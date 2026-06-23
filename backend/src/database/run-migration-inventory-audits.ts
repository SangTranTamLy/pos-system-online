import { db } from "../config/database";

async function runInventoryAuditsMigration() {
  try {
    console.log("Running inventory audits migration...");

    // Create inventory_audits table
    await db.query(`
      CREATE TABLE IF NOT EXISTS inventory_audits (
        id CHAR(36) PRIMARY KEY,
        created_by CHAR(36) NOT NULL,
        status VARCHAR(30) NOT NULL,
        note TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_inventory_audits_created_by FOREIGN KEY (created_by) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("Table 'inventory_audits' created or already exists.");

    // Create inventory_audit_details table
    await db.query(`
      CREATE TABLE IF NOT EXISTS inventory_audit_details (
        id CHAR(36) PRIMARY KEY,
        audit_id CHAR(36) NOT NULL,
        material_id CHAR(36) NOT NULL,
        system_quantity DECIMAL(12, 2) NOT NULL,
        actual_quantity DECIMAL(12, 2) NOT NULL,
        variance DECIMAL(12, 2) NOT NULL,
        note TEXT NULL,
        CONSTRAINT fk_inventory_audit_details_audit_id FOREIGN KEY (audit_id) REFERENCES inventory_audits(id) ON DELETE CASCADE,
        CONSTRAINT fk_inventory_audit_details_material_id FOREIGN KEY (material_id) REFERENCES raw_materials(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("Table 'inventory_audit_details' created or already exists.");

    // Create indexes if they don't exist
    const indexes = [
      { table: "inventory_audits", name: "idx_inventory_audits_created_by", columns: "created_by" },
      { table: "inventory_audits", name: "idx_inventory_audits_status", columns: "status" },
      { table: "inventory_audit_details", name: "idx_inventory_audit_details_audit_id", columns: "audit_id" },
      { table: "inventory_audit_details", name: "idx_inventory_audit_details_material_id", columns: "material_id" }
    ];

    for (const idx of indexes) {
      try {
        await db.query(`CREATE INDEX \`${idx.name}\` ON \`${idx.table}\` (\`${idx.columns}\`)`);
        console.log(`Index '${idx.name}' created on '${idx.table}'.`);
      } catch (err: any) {
        if (err.code === "ER_DUP_KEYNAME" || err.errno === 1061) {
          console.log(`Index '${idx.name}' already exists on '${idx.table}'.`);
        } else {
          console.warn(`Could not create index '${idx.name}':`, err.message);
        }
      }
    }

    console.log("Inventory audits migration done!");
  } catch (error) {
    console.error("Inventory audits migration error:", error);
  } finally {
    process.exit(0);
  }
}

void runInventoryAuditsMigration();
