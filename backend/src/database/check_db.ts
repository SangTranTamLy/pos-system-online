const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '123456',
    database: 'pos_system'
  });

  try {
    const [products] = await connection.execute("SELECT id, name, sku FROM products WHERE name LIKE '%cà phê%' OR name LIKE '%sữa%' OR name LIKE '%bánh mì%' OR name LIKE '%trà%' LIMIT 50");
    console.log('--- Matching Products ---');
    console.log(products);

  } catch (error) {
    console.error('Error querying DB:', error);
  } finally {
    await connection.end();
  }
}

main();
