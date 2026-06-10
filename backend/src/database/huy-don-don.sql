-- Migration: Logic hủy hóa đơn POS F&B
-- File: backend/src/database/huy-don-don.sql
--
-- Quy tắc nghiệp vụ chuẩn:
-- 1. Món tự làm/tự pha/chế biến tại chỗ như bún, cháo, bánh mì, cà phê, trà trái cây:
--    is_stock_returnable = FALSE
--    Khi hủy hóa đơn: KHÔNG hoàn tồn kho, ghi vào waste_transactions.
--
-- 2. Hàng có sẵn/đóng chai/lon như nước suối, nước ngọt lon, sữa chai:
--    is_stock_returnable = TRUE
--    Khi hủy hóa đơn: hoàn lại tồn kho vào products.stock_quantity.
--
-- Ghi chú:
-- requires_preparation vẫn giữ để mô tả món có cần pha/chế biến hay không.
-- is_stock_returnable mới là cờ quyết định có được hồi kho khi hủy đơn hay không.

USE pos_system;

-- 1. Cột mô tả món tự làm/tự pha/chế biến.
SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'products'
    AND COLUMN_NAME = 'requires_preparation'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE products ADD COLUMN requires_preparation BOOLEAN NOT NULL DEFAULT TRUE AFTER image_url',
  'SELECT "products.requires_preparation already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE products
MODIFY COLUMN requires_preparation BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Cột quyết định có hồi kho khi hủy đơn hay không.
SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'products'
    AND COLUMN_NAME = 'is_stock_returnable'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE products ADD COLUMN is_stock_returnable BOOLEAN NOT NULL DEFAULT FALSE AFTER requires_preparation',
  'SELECT "products.is_stock_returnable already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE products
MODIFY COLUMN is_stock_returnable BOOLEAN NOT NULL DEFAULT FALSE;

-- 2b. Thêm cột tương tự vào categories để đồng bộ cấu hình
SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'categories'
    AND COLUMN_NAME = 'requires_preparation'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE categories ADD COLUMN requires_preparation BOOLEAN NOT NULL DEFAULT TRUE AFTER image_url',
  'SELECT "categories.requires_preparation already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE categories
MODIFY COLUMN requires_preparation BOOLEAN NOT NULL DEFAULT TRUE;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'categories'
    AND COLUMN_NAME = 'is_stock_returnable'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE categories ADD COLUMN is_stock_returnable BOOLEAN NOT NULL DEFAULT FALSE AFTER requires_preparation',
  'SELECT "categories.is_stock_returnable already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE categories
MODIFY COLUMN is_stock_returnable BOOLEAN NOT NULL DEFAULT FALSE;

-- 2c. Backfill: đồng bộ lại flags từ categories -> products để đảm bảo nhất quán
-- (Chạy sau khi đã thêm các cột; an toàn để chạy nhiều lần)
SET @old_safe_updates := @@SQL_SAFE_UPDATES;
SET SQL_SAFE_UPDATES = 0;

UPDATE products p
JOIN categories c ON p.category_id = c.id
SET
  p.requires_preparation = c.requires_preparation,
  p.is_stock_returnable  = c.is_stock_returnable
WHERE p.id IS NOT NULL;

SET SQL_SAFE_UPDATES = @old_safe_updates;

-- 3. Thông tin hủy hóa đơn.
SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'cancelled_by'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE orders ADD COLUMN cancelled_by CHAR(36) NULL AFTER note',
  'SELECT "orders.cancelled_by already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'cancelled_at'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE orders ADD COLUMN cancelled_at DATETIME NULL AFTER cancelled_by',
  'SELECT "orders.cancelled_at already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'cancel_reason'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE orders ADD COLUMN cancel_reason TEXT NULL AFTER cancelled_at',
  'SELECT "orders.cancel_reason already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Khóa ngoại người hủy hóa đơn.
SET @constraint_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'orders'
    AND CONSTRAINT_NAME = 'fk_orders_cancelled_by'
);
SET @sql := IF(
  @constraint_exists = 0,
  'ALTER TABLE orders ADD CONSTRAINT fk_orders_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users(id)',
  'SELECT "fk_orders_cancelled_by already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. Metadata audit log.
SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'audit_logs'
    AND COLUMN_NAME = 'metadata'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE audit_logs ADD COLUMN metadata JSON NULL AFTER entity_id',
  'SELECT "audit_logs.metadata already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6. Bảng ghi nhận hao hụt món không được hồi kho.
CREATE TABLE IF NOT EXISTS waste_transactions (
  id CHAR(36) PRIMARY KEY,
  order_id CHAR(36),
  product_id CHAR(36) NOT NULL,
  created_by CHAR(36),
  quantity INT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_waste_transactions_order_id FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_waste_transactions_product_id FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_waste_transactions_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT chk_waste_transactions_quantity CHECK (quantity > 0)
);

-- 7. Index cho waste_transactions.
SET @index_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'waste_transactions'
    AND INDEX_NAME = 'idx_waste_transactions_order_id'
);
SET @sql := IF(
  @index_exists = 0,
  'CREATE INDEX idx_waste_transactions_order_id ON waste_transactions(order_id)',
  'SELECT "idx_waste_transactions_order_id already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'waste_transactions'
    AND INDEX_NAME = 'idx_waste_transactions_product_id'
);
SET @sql := IF(
  @index_exists = 0,
  'CREATE INDEX idx_waste_transactions_product_id ON waste_transactions(product_id)',
  'SELECT "idx_waste_transactions_product_id already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 8. Phân loại sản phẩm hiện có.
SET @old_safe_updates := @@SQL_SAFE_UPDATES;
SET SQL_SAFE_UPDATES = 0;

-- Mặc định toàn bộ sản phẩm F&B tại quầy không được hồi kho khi hủy.
UPDATE products
SET
  requires_preparation = TRUE,
  is_stock_returnable = FALSE
WHERE id IS NOT NULL;

-- Chỉ đồ có sẵn/đóng chai/lon mới được hồi kho.
UPDATE products
SET
  requires_preparation = FALSE,
  is_stock_returnable = TRUE
WHERE id IS NOT NULL
  AND (
    LOWER(name) LIKE '%chai%'
    OR LOWER(name) LIKE '%lon%'
    OR LOWER(name) LIKE '%đóng chai%'
    OR LOWER(name) LIKE '%dong chai%'
    OR LOWER(name) LIKE '%đóng lon%'
    OR LOWER(name) LIKE '%dong lon%'
    OR LOWER(name) LIKE '%nước suối%'
    OR LOWER(name) LIKE '%nuoc suoi%'
    OR LOWER(name) LIKE '%nước khoáng%'
    OR LOWER(name) LIKE '%nuoc khoang%'
    OR LOWER(name) LIKE '%lavie%'
    OR LOWER(name) LIKE '%aquafina%'
    OR LOWER(name) LIKE '%dasani%'
    OR LOWER(name) LIKE '%coca%'
    OR LOWER(name) LIKE '%coke%'
    OR LOWER(name) LIKE '%pepsi%'
    OR LOWER(name) LIKE '%7up%'
    OR LOWER(name) LIKE '%sprite%'
    OR LOWER(name) LIKE '%fanta%'
    OR LOWER(name) LIKE '%sting%'
    OR LOWER(name) LIKE '%red bull%'
    OR LOWER(name) LIKE '%bò húc%'
    OR LOWER(name) LIKE '%bo huc%'
    OR LOWER(name) LIKE '%revive%'
    OR LOWER(name) LIKE '%number one%'
    OR LOWER(name) LIKE '%number 1%'
    OR LOWER(name) LIKE '%c2%'
    OR LOWER(name) LIKE '%tea plus%'
    OR LOWER(name) LIKE '%sữa chai%'
    OR LOWER(name) LIKE '%sua chai%'
    OR LOWER(name) LIKE '%sữa hộp%'
    OR LOWER(name) LIKE '%sua hop%'
  );

SET SQL_SAFE_UPDATES = @old_safe_updates;

-- 9. Kiểm tra sản phẩm nào được hồi kho và không hồi kho.
SELECT
  id,
  name,
  stock_quantity,
  requires_preparation,
  is_stock_returnable,
  CASE
    WHEN is_stock_returnable = TRUE THEN 'HANG_CO_SAN_DUOC_HOAN_KHO'
    ELSE 'TU_LAM_KHONG_HOAN_KHO'
  END AS cancel_stock_rule
FROM products
ORDER BY is_stock_returnable DESC, name ASC;

DESCRIBE products;
DESCRIBE orders;
DESCRIBE audit_logs;
DESCRIBE waste_transactions;