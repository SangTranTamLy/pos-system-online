import fs from "fs";
import path from "path";
import { db } from "../config/database";

async function runReset() {
  try {
    console.log("Đang bắt đầu reset cơ sở dữ liệu...");
    const sqlPath = path.join(__dirname, "reset-database.sql");
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Không tìm thấy file sql tại: ${sqlPath}`);
    }

    const sqlContent = fs.readFileSync(sqlPath, "utf8");

    // Tách các câu lệnh SQL bằng dấu chấm phẩy
    const lines = sqlContent.split("\n");
    let currentStatement = "";
    const statements: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Bỏ qua dòng trống hoặc dòng comment hoàn toàn
      if (!trimmed || trimmed.startsWith("--")) {
        continue;
      }
      
      currentStatement += line + "\n";
      
      if (trimmed.endsWith(";")) {
        statements.push(currentStatement.trim());
        currentStatement = "";
      }
    }

    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }

    const connection = await db.getConnection();
    try {
      console.log("Đang tắt kiểm tra khóa ngoại (FOREIGN_KEY_CHECKS = 0)...");
      await connection.query("SET FOREIGN_KEY_CHECKS = 0;");

      for (const statement of statements) {
        const cleanStatement = statement.trim();
        if (!cleanStatement) continue;

        // Bỏ qua lệnh SET FOREIGN_KEY_CHECKS vì đã chạy riêng lẻ
        if (cleanStatement.toUpperCase().includes("FOREIGN_KEY_CHECKS")) {
          continue;
        }

        console.log(`Đang thực thi: ${cleanStatement.split("\n")[0]}...`);
        await connection.query(cleanStatement);
      }

      console.log("Đang bật lại kiểm tra khóa ngoại (FOREIGN_KEY_CHECKS = 1)...");
      await connection.query("SET FOREIGN_KEY_CHECKS = 1;");
      console.log("Reset cơ sở dữ liệu hoàn tất thành công!");
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Lỗi khi reset cơ sở dữ liệu:", error);
  } finally {
    process.exit(0);
  }
}

void runReset();
