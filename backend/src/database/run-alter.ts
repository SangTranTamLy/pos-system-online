import { db } from "../config/database";

async function alterTable() {
  try {
    console.log("Đang thêm cột old_values và new_values vào bảng audit_logs...");
    
    // Kiểm tra xem cột đã tồn tại chưa
    const [columns]: any[] = await db.query("SHOW COLUMNS FROM audit_logs LIKE 'old_values'");
    
    if (columns.length === 0) {
      await db.query("ALTER TABLE audit_logs ADD COLUMN old_values JSON NULL AFTER description");
      await db.query("ALTER TABLE audit_logs ADD COLUMN new_values JSON NULL AFTER old_values");
      console.log("Thêm cột thành công!");
    } else {
      console.log("Các cột JSON đã tồn tại.");
    }
  } catch (error) {
    console.error("Lỗi khi thêm cột:", error);
  } finally {
    process.exit(0);
  }
}

void alterTable();
