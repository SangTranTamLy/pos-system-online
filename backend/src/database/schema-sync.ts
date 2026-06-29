import { db } from "../config/database";

type ColumnDefinition = {
  table: string;
  column: string;
  definition: string;
};

async function runSchemaStep(label: string, action: () => Promise<void>) {
  try {
    await action();
  } catch (error) {
    console.error(`Database schema sync step failed (${label}):`, error);
  }
}

async function tableExists(table: string) {
  const [rows] = await db.query<any[]>(
    `
    SELECT 1
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    LIMIT 1
    `,
    [table]
  );

  return rows.length > 0;
}

async function columnExists(table: string, column: string) {
  const [rows] = await db.query<any[]>(
    `
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    LIMIT 1
    `,
    [table, column]
  );

  return rows.length > 0;
}

async function indexExists(table: string, index: string) {
  const [rows] = await db.query<any[]>(
    `
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND INDEX_NAME = ?
    LIMIT 1
    `,
    [table, index]
  );

  return rows.length > 0;
}

async function addColumnIfMissing({ table, column, definition }: ColumnDefinition) {
  if (!(await tableExists(table)) || (await columnExists(table, column))) {
    return;
  }

  await db.query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
}

async function addIndexIfMissing(table: string, index: string, columns: string) {
  if (!(await tableExists(table)) || (await indexExists(table, index))) {
    return;
  }

  await db.query(`CREATE INDEX \`${index}\` ON \`${table}\` (${columns})`);
}

async function ensureCoreTables() {
  await runSchemaStep("create suppliers", () => db.query(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id CHAR(36) PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      contact_name VARCHAR(120),
      phone VARCHAR(30) NOT NULL,
      email VARCHAR(255),
      address TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `).then(() => undefined));

  await runSchemaStep("create raw_materials", () => db.query(`
    CREATE TABLE IF NOT EXISTS raw_materials (
      id CHAR(36) PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      sku VARCHAR(80) NOT NULL UNIQUE,
      category VARCHAR(120) NOT NULL DEFAULT 'Khac',
      unit VARCHAR(40) NOT NULL,
      supplier_id CHAR(36) NULL,
      stock_quantity DECIMAL(12, 2) NOT NULL DEFAULT 0,
      import_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `).then(() => undefined));

  await runSchemaStep("create shifts", () => db.query(`
    CREATE TABLE IF NOT EXISTS shifts (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      expected_start_time DATETIME NOT NULL,
      expected_end_time DATETIME NOT NULL,
      actual_start_time DATETIME NULL,
      actual_end_time DATETIME NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      approved_by CHAR(36) NULL,
      opened_by CHAR(36) NULL,
      closed_by CHAR(36) NULL,
      opening_cash DECIMAL(12, 2) NOT NULL DEFAULT 0,
      actual_closing_cash DECIMAL(12, 2) NOT NULL DEFAULT 0,
      total_sales_cash DECIMAL(12, 2) NOT NULL DEFAULT 0,
      total_sales_qr DECIMAL(12, 2) NOT NULL DEFAULT 0,
      total_sales DECIMAL(12, 2) NOT NULL DEFAULT 0,
      variance DECIMAL(12, 2) NOT NULL DEFAULT 0,
      closing_note TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `).then(() => undefined));

  await runSchemaStep("create promotion_rules", () => db.query(`
    CREATE TABLE IF NOT EXISTS promotion_rules (
      id CHAR(36) PRIMARY KEY,
      code VARCHAR(80) UNIQUE,
      name VARCHAR(160) NOT NULL,
      rule_type VARCHAR(40) NOT NULL,
      discount_type VARCHAR(40) NOT NULL,
      discount_value DECIMAL(12, 2) NOT NULL DEFAULT 0,
      min_order_amount DECIMAL(12, 2),
      start_time TIME,
      end_time TIME,
      days_of_week VARCHAR(40),
      priority INT NOT NULL DEFAULT 50,
      config JSON,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      starts_at DATETIME,
      ends_at DATETIME,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `).then(() => undefined));

  await runSchemaStep("create orders", () => db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id CHAR(36) PRIMARY KEY,
      customer_id CHAR(36) NULL,
      created_by CHAR(36) NULL,
      promotion_id CHAR(36) NULL,
      shift_id CHAR(36) NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'completed',
      total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
      discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
      final_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
      note TEXT NULL,
      cancelled_by CHAR(36) NULL,
      cancelled_at DATETIME NULL,
      cancel_reason TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `).then(() => undefined));

  await runSchemaStep("create payments", () => db.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id CHAR(36) PRIMARY KEY,
      order_id CHAR(36) NOT NULL,
      payment_method VARCHAR(30) NOT NULL DEFAULT 'cash',
      amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
      payment_status VARCHAR(30) NOT NULL DEFAULT 'paid',
      paid_at DATETIME NULL
    )
  `).then(() => undefined));

  await runSchemaStep("create order_details", () => db.query(`
    CREATE TABLE IF NOT EXISTS order_details (
      id CHAR(36) PRIMARY KEY,
      order_id CHAR(36) NOT NULL,
      product_id CHAR(36) NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
      line_total DECIMAL(12, 2) NOT NULL DEFAULT 0
    )
  `).then(() => undefined));
}

async function syncColumns() {
  const columns: ColumnDefinition[] = [
    { table: "categories", column: "is_tracked_stock", definition: "`is_tracked_stock` BOOLEAN NOT NULL DEFAULT FALSE" },
    { table: "products", column: "is_tracked_stock", definition: "`is_tracked_stock` BOOLEAN NOT NULL DEFAULT FALSE" },
    { table: "products", column: "is_available", definition: "`is_available` BOOLEAN NOT NULL DEFAULT TRUE" },
    { table: "products", column: "requires_preparation", definition: "`requires_preparation` BOOLEAN NOT NULL DEFAULT FALSE" },
    { table: "products", column: "is_stock_returnable", definition: "`is_stock_returnable` BOOLEAN NOT NULL DEFAULT FALSE" },
    { table: "products", column: "category_id", definition: "`category_id` CHAR(36) NULL" },
    { table: "products", column: "sku", definition: "`sku` VARCHAR(80) NULL" },
    { table: "products", column: "name", definition: "`name` VARCHAR(160) NULL" },
    { table: "products", column: "import_price", definition: "`import_price` DECIMAL(12, 2) NOT NULL DEFAULT 0" },
    { table: "products", column: "sale_price", definition: "`sale_price` DECIMAL(12, 2) NOT NULL DEFAULT 0" },
    { table: "products", column: "stock_quantity", definition: "`stock_quantity` INT NULL DEFAULT 0" },
    { table: "products", column: "status", definition: "`status` VARCHAR(30) NOT NULL DEFAULT 'active'" },
    { table: "products", column: "description", definition: "`description` TEXT NULL" },
    { table: "products", column: "image_url", definition: "`image_url` TEXT NULL" },
    { table: "products", column: "created_at", definition: "`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP" },
    { table: "products", column: "updated_at", definition: "`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },

    { table: "categories", column: "description", definition: "`description` TEXT NULL" },
    { table: "categories", column: "image_url", definition: "`image_url` TEXT NULL" },
    { table: "categories", column: "is_active", definition: "`is_active` BOOLEAN NOT NULL DEFAULT TRUE" },
    { table: "categories", column: "created_at", definition: "`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP" },
    { table: "categories", column: "updated_at", definition: "`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },

    { table: "customers", column: "phone", definition: "`phone` VARCHAR(10) NULL" },
    { table: "customers", column: "address", definition: "`address` VARCHAR(255) NULL" },
    { table: "customers", column: "total_spent", definition: "`total_spent` DECIMAL(12, 2) NOT NULL DEFAULT 0" },
    { table: "customers", column: "order_count", definition: "`order_count` INT NOT NULL DEFAULT 0" },
    { table: "customers", column: "last_order_at", definition: "`last_order_at` DATETIME NULL" },
    { table: "customers", column: "created_at", definition: "`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP" },
    { table: "customers", column: "updated_at", definition: "`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },

    { table: "orders", column: "customer_id", definition: "`customer_id` CHAR(36) NULL" },
    { table: "orders", column: "created_by", definition: "`created_by` CHAR(36) NULL" },
    { table: "orders", column: "promotion_id", definition: "`promotion_id` CHAR(36) NULL" },
    { table: "orders", column: "status", definition: "`status` VARCHAR(30) NOT NULL DEFAULT 'completed'" },
    { table: "orders", column: "total_amount", definition: "`total_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0" },
    { table: "orders", column: "discount_amount", definition: "`discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0" },
    { table: "orders", column: "final_amount", definition: "`final_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0" },
    { table: "orders", column: "note", definition: "`note` TEXT NULL" },
    { table: "orders", column: "shift_id", definition: "`shift_id` CHAR(36) NULL" },
    { table: "orders", column: "cancelled_by", definition: "`cancelled_by` CHAR(36) NULL" },
    { table: "orders", column: "cancelled_at", definition: "`cancelled_at` DATETIME NULL" },
    { table: "orders", column: "cancel_reason", definition: "`cancel_reason` TEXT NULL" },
    { table: "orders", column: "created_at", definition: "`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP" },
    { table: "orders", column: "updated_at", definition: "`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },

    { table: "payments", column: "order_id", definition: "`order_id` CHAR(36) NULL" },
    { table: "payments", column: "payment_method", definition: "`payment_method` VARCHAR(30) NOT NULL DEFAULT 'cash'" },
    { table: "payments", column: "amount", definition: "`amount` DECIMAL(12, 2) NOT NULL DEFAULT 0" },
    { table: "payments", column: "payment_status", definition: "`payment_status` VARCHAR(30) NOT NULL DEFAULT 'paid'" },
    { table: "payments", column: "paid_at", definition: "`paid_at` DATETIME NULL" },

    { table: "order_details", column: "order_id", definition: "`order_id` CHAR(36) NULL" },
    { table: "order_details", column: "product_id", definition: "`product_id` CHAR(36) NULL" },
    { table: "order_details", column: "quantity", definition: "`quantity` INT NOT NULL DEFAULT 1" },
    { table: "order_details", column: "unit_price", definition: "`unit_price` DECIMAL(12, 2) NOT NULL DEFAULT 0" },
    { table: "order_details", column: "line_total", definition: "`line_total` DECIMAL(12, 2) NOT NULL DEFAULT 0" },

    { table: "raw_materials", column: "category", definition: "`category` VARCHAR(120) NOT NULL DEFAULT 'Khac'" },
    { table: "raw_materials", column: "supplier_id", definition: "`supplier_id` CHAR(36) NULL" },
    { table: "raw_materials", column: "stock_quantity", definition: "`stock_quantity` DECIMAL(12, 2) NOT NULL DEFAULT 0" },
    { table: "raw_materials", column: "import_price", definition: "`import_price` DECIMAL(12, 2) NOT NULL DEFAULT 0" },
    { table: "raw_materials", column: "is_active", definition: "`is_active` BOOLEAN NOT NULL DEFAULT TRUE" },
    { table: "raw_materials", column: "created_at", definition: "`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP" },
    { table: "raw_materials", column: "updated_at", definition: "`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },

    { table: "suppliers", column: "contact_name", definition: "`contact_name` VARCHAR(120) NULL" },
    { table: "suppliers", column: "email", definition: "`email` VARCHAR(255) NULL" },
    { table: "suppliers", column: "address", definition: "`address` TEXT NULL" },
    { table: "suppliers", column: "created_at", definition: "`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP" },
    { table: "suppliers", column: "updated_at", definition: "`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },

    { table: "shifts", column: "actual_start_time", definition: "`actual_start_time` DATETIME NULL" },
    { table: "shifts", column: "actual_end_time", definition: "`actual_end_time` DATETIME NULL" },
    { table: "shifts", column: "approved_by", definition: "`approved_by` CHAR(36) NULL" },
    { table: "shifts", column: "opened_by", definition: "`opened_by` CHAR(36) NULL" },
    { table: "shifts", column: "closed_by", definition: "`closed_by` CHAR(36) NULL" },
    { table: "shifts", column: "opening_cash", definition: "`opening_cash` DECIMAL(12, 2) NOT NULL DEFAULT 0" },
    { table: "shifts", column: "actual_closing_cash", definition: "`actual_closing_cash` DECIMAL(12, 2) NOT NULL DEFAULT 0" },
    { table: "shifts", column: "total_sales_cash", definition: "`total_sales_cash` DECIMAL(12, 2) NOT NULL DEFAULT 0" },
    { table: "shifts", column: "total_sales_qr", definition: "`total_sales_qr` DECIMAL(12, 2) NOT NULL DEFAULT 0" },
    { table: "shifts", column: "total_sales", definition: "`total_sales` DECIMAL(12, 2) NOT NULL DEFAULT 0" },
    { table: "shifts", column: "variance", definition: "`variance` DECIMAL(12, 2) NOT NULL DEFAULT 0" },
    { table: "shifts", column: "closing_note", definition: "`closing_note` TEXT NULL" },
    { table: "shifts", column: "created_at", definition: "`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP" },
    { table: "shifts", column: "updated_at", definition: "`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },

    { table: "promotions", column: "product_id", definition: "`product_id` CHAR(36) NULL" },
    { table: "promotions", column: "code", definition: "`code` VARCHAR(80) NULL" },
    { table: "promotions", column: "name", definition: "`name` VARCHAR(160) NULL" },
    { table: "promotions", column: "discount_type", definition: "`discount_type` VARCHAR(30) NOT NULL DEFAULT 'fixed'" },
    { table: "promotions", column: "discount_value", definition: "`discount_value` DECIMAL(12, 2) NOT NULL DEFAULT 0" },
    { table: "promotions", column: "start_at", definition: "`start_at` DATETIME NULL" },
    { table: "promotions", column: "end_at", definition: "`end_at` DATETIME NULL" },
    { table: "promotions", column: "is_active", definition: "`is_active` BOOLEAN NOT NULL DEFAULT TRUE" },
    { table: "promotions", column: "created_at", definition: "`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP" },
    { table: "promotions", column: "updated_at", definition: "`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },

    { table: "promotion_rules", column: "code", definition: "`code` VARCHAR(80) NULL" },
    { table: "promotion_rules", column: "rule_type", definition: "`rule_type` VARCHAR(40) NOT NULL DEFAULT 'code'" },
    { table: "promotion_rules", column: "discount_type", definition: "`discount_type` VARCHAR(40) NOT NULL DEFAULT 'fixed'" },
    { table: "promotion_rules", column: "discount_value", definition: "`discount_value` DECIMAL(12, 2) NOT NULL DEFAULT 0" },
    { table: "promotion_rules", column: "min_order_amount", definition: "`min_order_amount` DECIMAL(12, 2) NULL" },
    { table: "promotion_rules", column: "start_time", definition: "`start_time` TIME NULL" },
    { table: "promotion_rules", column: "end_time", definition: "`end_time` TIME NULL" },
    { table: "promotion_rules", column: "days_of_week", definition: "`days_of_week` VARCHAR(40) NULL" },
    { table: "promotion_rules", column: "priority", definition: "`priority` INT NOT NULL DEFAULT 50" },
    { table: "promotion_rules", column: "config", definition: "`config` JSON NULL" },
    { table: "promotion_rules", column: "is_active", definition: "`is_active` BOOLEAN NOT NULL DEFAULT TRUE" },
    { table: "promotion_rules", column: "starts_at", definition: "`starts_at` DATETIME NULL" },
    { table: "promotion_rules", column: "ends_at", definition: "`ends_at` DATETIME NULL" },
    { table: "promotion_rules", column: "created_at", definition: "`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP" },
    { table: "promotion_rules", column: "updated_at", definition: "`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },

    { table: "audit_logs", column: "timestamp", definition: "`timestamp` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP" },
    { table: "audit_logs", column: "user_name", definition: "`user_name` VARCHAR(120) NULL" },
    { table: "audit_logs", column: "role", definition: "`role` VARCHAR(50) NULL" },
    { table: "audit_logs", column: "action_type", definition: "`action_type` VARCHAR(50) NULL" },
    { table: "audit_logs", column: "target_object", definition: "`target_object` VARCHAR(100) NULL" },
    { table: "audit_logs", column: "description", definition: "`description` TEXT NULL" },
    { table: "audit_logs", column: "old_values", definition: "`old_values` JSON NULL" },
    { table: "audit_logs", column: "new_values", definition: "`new_values` JSON NULL" },
  ];

  for (const column of columns) {
    await runSchemaStep(
      `add ${column.table}.${column.column}`,
      () => addColumnIfMissing(column)
    );
  }

  if (await columnExists("audit_logs", "action")) {
    await runSchemaStep("make audit_logs.action nullable", () =>
      db.query("ALTER TABLE `audit_logs` MODIFY COLUMN `action` VARCHAR(120) NULL").then(() => undefined)
    );
  }
}

async function syncIndexes() {
  await runSchemaStep("index raw_materials.supplier_id", () =>
    addIndexIfMissing("raw_materials", "idx_raw_materials_supplier_id", "`supplier_id`")
  );
  await runSchemaStep("index orders.shift_id", () =>
    addIndexIfMissing("orders", "idx_orders_shift_id", "`shift_id`")
  );
  await runSchemaStep("index orders.created_by", () =>
    addIndexIfMissing("orders", "idx_orders_created_by", "`created_by`")
  );
  await runSchemaStep("index orders.status", () =>
    addIndexIfMissing("orders", "idx_orders_status", "`status`")
  );
  await runSchemaStep("index payments.order_id", () =>
    addIndexIfMissing("payments", "idx_payments_order_id", "`order_id`")
  );
  await runSchemaStep("index order_details.order_id", () =>
    addIndexIfMissing("order_details", "idx_order_details_order_id", "`order_id`")
  );
  await runSchemaStep("index order_details.product_id", () =>
    addIndexIfMissing("order_details", "idx_order_details_product_id", "`product_id`")
  );
  await runSchemaStep("index products.category_id", () =>
    addIndexIfMissing("products", "idx_products_category_id", "`category_id`")
  );
  await runSchemaStep("index products.status", () =>
    addIndexIfMissing("products", "idx_products_status", "`status`")
  );
  await runSchemaStep("index shifts.user_id", () =>
    addIndexIfMissing("shifts", "idx_shifts_user_id", "`user_id`")
  );
  await runSchemaStep("index shifts.status", () =>
    addIndexIfMissing("shifts", "idx_shifts_status", "`status`")
  );
  await runSchemaStep("index promotion_rules.code", () =>
    addIndexIfMissing("promotion_rules", "idx_promotion_rules_code", "`code`")
  );
  await runSchemaStep("index promotion_rules.is_active", () =>
    addIndexIfMissing("promotion_rules", "idx_promotion_rules_active", "`is_active`")
  );
}

export async function syncDatabaseSchema() {
  try {
    await ensureCoreTables();
    await syncColumns();
    await syncIndexes();
    console.log("Database schema sync completed");
  } catch (error) {
    console.error("Database schema sync failed:", error);
  }
}
