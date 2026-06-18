import fs from 'fs';
import path from 'path';
import { db } from '../config/database';

async function runMigration() {
  try {
    const sqlPath = path.join(__dirname, 'migration-shifts.sql');
    const sqlStr = fs.readFileSync(sqlPath, 'utf8');
    const statements = sqlStr.split(/;(?=(?:[^']*'[^']*')*[^']*$)/).filter(s => s.trim().length > 0);

    for (let statement of statements) {
      statement = statement.trim();
      if (!statement) continue;
      
      // Basic splitting isn't perfect for DELIMITER //, we might need to handle PROCEDURE specially.
      // Actually, since mysql2/promise doesn't support multiple statements nicely with custom delimiters,
      // it's better to just run the raw statements if we handle DELIMITER correctly.
      // Wait, let's use a simpler approach: we can just manually split out the PROCEDURE blocks.
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

// Simple direct execution for the table
async function runSimple() {
  try {
    console.log('Running shift migration...');
    
    await db.query(`
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
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        CONSTRAINT fk_shifts_user_id FOREIGN KEY (user_id) REFERENCES users(id),
        CONSTRAINT fk_shifts_approved_by FOREIGN KEY (approved_by) REFERENCES users(id),
        CONSTRAINT fk_shifts_opened_by FOREIGN KEY (opened_by) REFERENCES users(id),
        CONSTRAINT fk_shifts_closed_by FOREIGN KEY (closed_by) REFERENCES users(id),
        CONSTRAINT chk_shifts_status CHECK (status IN ('PENDING', 'APPROVED', 'OPEN', 'CLOSING_REQUEST', 'CLOSED', 'CANCELLED'))
      )
    `);
    
    console.log('Shifts table created.');

    // Attempt to add column shift_id to orders
    try {
      await db.query(`ALTER TABLE orders ADD COLUMN shift_id CHAR(36) NULL AFTER customer_id`);
      await db.query(`ALTER TABLE orders ADD CONSTRAINT fk_orders_shift_id FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL`);
      console.log('Added shift_id to orders table.');
    } catch (err: any) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('Column shift_id already exists in orders.');
      } else {
        console.log('Warning altering orders table:', err.message);
      }
    }

    try {
      await db.query(`CALL create_index_if_missing('shifts', 'idx_shifts_user_id', 'user_id')`);
      await db.query(`CALL create_index_if_missing('shifts', 'idx_shifts_status', 'status')`);
      await db.query(`CALL create_index_if_missing('shifts', 'idx_shifts_time', 'expected_start_time,expected_end_time')`);
      await db.query(`CALL create_index_if_missing('orders', 'idx_orders_shift_id', 'shift_id')`);
      console.log('Indexes created.');
    } catch(e: any) {
      console.log('Index creation warning:', e.message);
    }
    
    console.log('Migration done!');
  } catch(e) {
    console.error('Error', e);
  } finally {
    process.exit(0);
  }
}

runSimple();
