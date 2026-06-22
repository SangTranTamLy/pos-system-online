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
    console.log("Moving Sting and Aquafina products to Nước đóng chai category...");
    await db.execute(`
      UPDATE products
      SET category_id = 'd2016e3b-410d-4894-a9bf-560ccf936c47',
          is_tracked_stock = 1,
          stock_quantity = COALESCE(stock_quantity, 10)
      WHERE name LIKE '%Sting%' OR name LIKE '%Aquafina%'
    `);

    const [trackedProducts] = await db.execute("SELECT id, name, category_id, is_tracked_stock, stock_quantity FROM products WHERE is_tracked_stock = 1");
    console.log("=== UPDATED TRACKED PRODUCTS ===");
    console.table(trackedProducts);

  } catch (error) {
    console.error("Database query failed:", error);
  } finally {
    process.exit(0);
  }
}

void run();
