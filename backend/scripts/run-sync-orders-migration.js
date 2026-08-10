const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

async function run() {
  const migrationPath = path.resolve(
    __dirname,
    "..",
    "src",
    "database",
    "migration-sync-orders.sql",
  );
  const migrationSql = fs.readFileSync(migrationPath, "utf8");

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    await connection.query(migrationSql);

    const [tables] = await connection.query(
      `SELECT COUNT(*) AS table_count
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_name = 'pos_sync_operations'`,
    );

    if (Number(tables[0]?.table_count) !== 1) {
      throw new Error("pos_sync_operations was not created.");
    }

    const [operations] = await connection.query(
      `SELECT status, COUNT(*) AS operation_count
       FROM pos_sync_operations
       GROUP BY status
       ORDER BY status`,
    );

    const total = operations.reduce(
      (sum, row) => sum + Number(row.operation_count || 0),
      0,
    );
    const statusSummary = operations
      .map((row) => `${row.status}=${Number(row.operation_count || 0)}`)
      .join(", ");

    console.log(`Sync migration ready. Recorded operations: ${total}`);
    if (statusSummary) console.log(`Sync operation statuses: ${statusSummary}`);
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error("Sync migration failed:", error.message);
  process.exitCode = 1;
});
