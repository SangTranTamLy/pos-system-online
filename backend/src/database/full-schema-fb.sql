-- =========================================================================
-- ĐỒ ÁN CƠ SỞ: HỆ THỐNG QUẢN LÝ BÁN HÀNG & KHO F&B (QUICKSERVE POS)
-- SCRIPT TẠO TOÀN BỘ CẤU TRÚC BẢNG (DATABASE SCHEMA) CHUẨN KHÓA NGOẠI
-- Thứ tự chạy script: Bảng độc lập -> Bảng con -> Bảng trung gian
-- =========================================================================

-- -----------------------------------------------------
-- 1. BẢNG DANH MỤC SẢN PHẨM (categories)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 2. BẢNG NHÀ CUNG CẤP (suppliers)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  contact_name VARCHAR(120),
  email VARCHAR(255),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 3. BẢNG NGUYÊN LIỆU THÔ / THÀNH PHẦN (raw_materials)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS raw_materials (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  sku VARCHAR(80) NOT NULL UNIQUE,
  unit VARCHAR(30) NOT NULL,
  stock_quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  import_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  min_stock DECIMAL(12,2) NOT NULL DEFAULT 0.00,            -- Ngưỡng cảnh báo hết hàng
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  category VARCHAR(120),
  supplier_id CHAR(36),
  -- Ràng buộc khóa ngoại: Khi xóa supplier, đặt supplier_id của nguyên liệu thành NULL
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 4. BẢNG SẢN PHẨM BÁN RA (products)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id CHAR(36) PRIMARY KEY,
  category_id CHAR(36) NOT NULL,
  sku VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  sale_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  import_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  stock_quantity INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- Ràng buộc khóa ngoại: Sản phẩm thuộc về một Danh mục cụ thể
  FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- 5. BẢNG ĐỊNH LƯỢNG MÓN ĂN / CÔNG THỨC (recipes) - Trung gian
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS recipes (
  id CHAR(36) PRIMARY KEY,
  product_id CHAR(36) NOT NULL,                           -- Tham chiếu đến sản phẩm
  ingredient_id CHAR(36) NOT NULL,                        -- Tham chiếu đến nguyên liệu
  quantity_needed DECIMAL(12,4) NOT NULL,                 -- Lượng tiêu hao cho 1 sản phẩm
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- Khóa duy nhất (Unique Key): Tránh trùng lặp công thức của cùng một nguyên liệu trên một sản phẩm
  UNIQUE KEY uq_product_ingredient (product_id, ingredient_id),
  -- Ràng buộc khóa ngoại: Khi sản phẩm hoặc nguyên liệu bị xóa, công thức liên quan bị xóa tự động
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES raw_materials(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
