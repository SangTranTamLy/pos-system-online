const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'pos_system'
  });
  
  const [s30] = await conn.execute('SELECT COUNT(DISTINCT gr.id) AS receiptsCount, COALESCE(SUM(grmd.line_total), 0) AS totalPurchaseCost FROM goods_receipts gr JOIN goods_receipt_material_details grmd ON grmd.receipt_id = gr.id WHERE DATE(gr.created_at) BETWEEN "2026-06-29" AND "2026-07-28" AND grmd.quantity > 0 AND grmd.unit_price > 0');
  console.log('30 days:', s30);
  
  const [sAll] = await conn.execute('SELECT COUNT(DISTINCT gr.id) AS receiptsCount, COALESCE(SUM(grmd.line_total), 0) AS totalPurchaseCost FROM goods_receipts gr JOIN goods_receipt_material_details grmd ON grmd.receipt_id = gr.id WHERE grmd.quantity > 0 AND grmd.unit_price > 0');
  console.log('All time:', sAll);
  
  process.exit(0);
}
run();
