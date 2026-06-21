-- ==========================================================
-- MIGRATION: THÊM CỘT MIN_STOCK VÀ TẠO BẢNG ĐỊNH LƯỢNG RECIPES
-- Dự án: Đồ án Cơ sở Hệ thống POS
-- ==========================================================

-- 1. Thêm cột ngưỡng cảnh báo tồn tối thiểu vào bảng nguyên liệu
ALTER TABLE raw_materials ADD COLUMN min_stock DECIMAL(12,2) NOT NULL DEFAULT 0.00;

-- 2. Tạo bảng trung gian recipes định lượng món ăn (Many-to-Many)
CREATE TABLE IF NOT EXISTS recipes (
  id CHAR(36) PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  ingredient_id CHAR(36) NOT NULL,
  quantity_needed DECIMAL(12,4) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES raw_materials(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
