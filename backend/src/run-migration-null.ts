import { db } from './config/database';

async function run() {
  try {
    console.log('Altering users table to allow NULLs...');
    await db.query(`ALTER TABLE users 
      MODIFY email VARCHAR(255) UNIQUE NULL,
      MODIFY password_hash VARCHAR(255) NULL,
      MODIFY phone VARCHAR(20) UNIQUE NULL,
      MODIFY pin_code VARCHAR(255) UNIQUE NULL;
    `);
    console.log('Migration successful.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

run();
