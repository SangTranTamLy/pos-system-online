import { db } from "../config/database";

async function runSettingsMigration() {
  try {
    console.log("Running settings migration...");

    // Create table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS settings (
        \`key\` VARCHAR(120) PRIMARY KEY,
        \`value\` TEXT NOT NULL,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log("Settings table created or already exists.");

    // Seed default settings
    const defaultSettings = [
      ["store_name", "Quán ABC - Chi nhánh 1"],
      ["store_address", "123 Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh"],
      ["store_phone", "0901 234 567"],
      ["store_email", "contact@quickserve.vn"],
      ["store_website", "https://quickserve.vn"],
      ["store_timezone", "GMT+7"],
      ["store_logo", ""],
      ["invoice_prefix", "HD-"],
      ["invoice_start_index", "1"],
      ["invoice_print_after_payment", "true"],
      ["invoice_show_logo", "true"],
      ["invoice_show_address", "true"],
      ["invoice_show_thank_you", "true"],
      ["inventory_min_warning", "5"],
      ["inventory_default_unit", "kg"],
      ["inventory_allow_expiry", "true"],
      ["inventory_auto_deduct", "true"],
      ["shift_require_open_before_sale", "true"],
      ["shift_require_close_end_of_day", "true"],
      ["shift_default_opening_cash", "500000"],
      ["payment_bank_code", "MoMo"],
      ["payment_account_no", "PSP2605210000000331"],
      ["payment_account_name", "CHAU THANH SANG"],
      ["payment_display_name", "Ví MoMo"]
    ];

    for (const [key, value] of defaultSettings) {
      await db.query(`
        INSERT INTO settings (\`key\`, \`value\`)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE \`key\` = \`key\`
      `, [key, value]);
    }
    console.log("Default settings seeded.");
    console.log("Migration done!");
  } catch (error) {
    console.error("Settings migration error:", error);
  } finally {
    process.exit(0);
  }
}

void runSettingsMigration();
