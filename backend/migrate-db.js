const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config();

async function run() {
  const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log("Starting migrations...");

    // 1. Drop constraints if exist
    try {
      await db.execute("ALTER TABLE products DROP CONSTRAINT chk_products_stock_logic");
      console.log("Dropped constraint chk_products_stock_logic.");
    } catch (e) {
      console.log("Could not drop constraint chk_products_stock_logic (might not exist):", e.message);
    }

    try {
      await db.execute("ALTER TABLE categories DROP CONSTRAINT chk_categories_stock_logic");
      console.log("Dropped constraint chk_categories_stock_logic.");
    } catch (e) {
      console.log("Could not drop constraint chk_categories_stock_logic (might not exist):", e.message);
    }

    // 2. Alter categories
    try {
      await db.execute("ALTER TABLE categories ADD COLUMN is_tracked_stock TINYINT(1) DEFAULT 0 AFTER image_url");
      console.log("Added column is_tracked_stock to categories.");
    } catch (e) {
      console.log("Could not add is_tracked_stock to categories (might already exist):", e.message);
    }

    try {
      await db.execute("ALTER TABLE categories DROP COLUMN requires_preparation");
      console.log("Dropped requires_preparation from categories.");
    } catch (e) {
      console.log("requires_preparation already dropped or missing:", e.message);
    }

    try {
      await db.execute("ALTER TABLE categories DROP COLUMN is_stock_returnable");
      console.log("Dropped is_stock_returnable from categories.");
    } catch (e) {
      console.log("is_stock_returnable already dropped or missing:", e.message);
    }

    // 3. Alter products
    try {
      await db.execute("ALTER TABLE products ADD COLUMN is_tracked_stock TINYINT(1) DEFAULT 0 AFTER sale_price");
      console.log("Added column is_tracked_stock to products.");
    } catch (e) {
      console.log("Could not add is_tracked_stock to products (might already exist):", e.message);
    }

    try {
      await db.execute("ALTER TABLE products MODIFY COLUMN stock_quantity INT DEFAULT NULL");
      console.log("Modified stock_quantity to allow NULL in products.");
    } catch (e) {
      console.log("Could not modify stock_quantity:", e.message);
    }

    try {
      await db.execute("ALTER TABLE products ADD COLUMN is_available TINYINT(1) DEFAULT 1 AFTER stock_quantity");
      console.log("Added column is_available to products.");
    } catch (e) {
      console.log("Could not add is_available to products (might already exist):", e.message);
    }

    try {
      await db.execute("ALTER TABLE products DROP COLUMN requires_preparation");
      console.log("Dropped requires_preparation from products.");
    } catch (e) {
      console.log("requires_preparation already dropped or missing:", e.message);
    }

    try {
      await db.execute("ALTER TABLE products DROP COLUMN is_stock_returnable");
      console.log("Dropped is_stock_returnable from products.");
    } catch (e) {
      console.log("is_stock_returnable already dropped or missing:", e.message);
    }

    // 4. Drop recipes
    await db.execute("DROP TABLE IF EXISTS recipes");
    console.log("Dropped recipes table if existed.");

    // 5. Update data
    console.log("Syncing database default values...");
    
    // Set categories that contain lon/chai/nước to is_tracked_stock = 1
    await db.execute(`
      UPDATE categories
      SET is_tracked_stock = 1
      WHERE LOWER(name) LIKE '%nước%' 
         OR LOWER(name) LIKE '%đóng chai%' 
         OR LOWER(name) LIKE '%đóng lon%' 
         OR LOWER(name) LIKE '%lon%' 
         OR LOWER(name) LIKE '%chai%'
    `);

    // Sync products is_tracked_stock with their categories
    await db.execute(`
      UPDATE products p
      JOIN categories c ON p.category_id = c.id
      SET p.is_tracked_stock = c.is_tracked_stock
    `);

    // Set stock_quantity = NULL for products with is_tracked_stock = 0
    await db.execute(`
      UPDATE products
      SET stock_quantity = NULL
      WHERE is_tracked_stock = 0
    `);

    // Set default stock for products with is_tracked_stock = 1
    await db.execute(`
      UPDATE products
      SET stock_quantity = COALESCE(stock_quantity, 10), is_available = 1
      WHERE is_tracked_stock = 1
    `);

    console.log("Database migrations completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    process.exit(0);
  }
}

void run();
