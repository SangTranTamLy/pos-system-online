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


-- =========================================================
-- SCRIPT BỔ SUNG RÀNG BUỘC LOGIC TỒN KHO CHO HỆ THỐNG POS
-- Mục đích:
-- 1. Bổ sung khóa ngoại và index cho bảng stock_transactions.
-- 2. Bổ sung ràng buộc loại giao dịch kho.
-- 3. Bổ sung ràng buộc logic danh mục/sản phẩm:
--    - Món cần chế biến: requires_preparation = 1, is_stock_returnable = 0
--    - Hàng có sẵn/đóng chai: requires_preparation = 0, is_stock_returnable = 1
-- 4. Đồng bộ lại logic từ categories xuống products.
-- =========================================================


-- =========================================================
-- PHẦN 1: KIỂM TRA DỮ LIỆU SAI TRƯỚC KHI THÊM CONSTRAINT
-- Nếu 2 câu SELECT bên dưới trả về 0 dòng thì dữ liệu đang hợp lệ.
-- Dữ liệu sai gồm:
-- requires_preparation = 1 AND is_stock_returnable = 1  => vừa chế biến vừa hoàn kho, không hợp lệ
-- requires_preparation = 0 AND is_stock_returnable = 0  => không thuộc loại nào, không hợp lệ
-- =========================================================

-- Kiểm tra danh mục sai logic
SELECT id, name, requires_preparation, is_stock_returnable
FROM categories
WHERE
  (requires_preparation = 1 AND is_stock_returnable = 1)
  OR
  (requires_preparation = 0 AND is_stock_returnable = 0);

-- Kiểm tra sản phẩm sai logic
SELECT id, name, requires_preparation, is_stock_returnable
FROM products
WHERE
  (requires_preparation = 1 AND is_stock_returnable = 1)
  OR
  (requires_preparation = 0 AND is_stock_returnable = 0);


-- =========================================================
-- PHẦN 2: ĐỒNG BỘ LOGIC TỪ DANH MỤC XUỐNG SẢN PHẨM
-- Mục đích:
-- Sản phẩm thuộc danh mục nào thì kế thừa logic tồn kho của danh mục đó.
-- Ví dụ:
-- - Danh mục "Trà sữa": requires_preparation = 1, is_stock_returnable = 0
-- - Sản phẩm thuộc "Trà sữa" cũng sẽ được cập nhật theo đúng 2 giá trị này.
--
-- Lưu ý:
-- Tắt SQL_SAFE_UPDATES tạm thời để MySQL Workbench cho phép UPDATE nhiều dòng.
-- Sau khi UPDATE xong thì bật lại.
-- =========================================================

SET SQL_SAFE_UPDATES = 0;

UPDATE products p
JOIN categories c ON p.category_id = c.id
SET
  p.requires_preparation = c.requires_preparation,
  p.is_stock_returnable = c.is_stock_returnable;

SET SQL_SAFE_UPDATES = 1;


-- =========================================================
-- PHẦN 3: KIỂM TRA SAU KHI ĐỒNG BỘ
-- Mục đích:
-- Xem từng sản phẩm đang kế thừa đúng logic từ danh mục chưa.
-- =========================================================

SELECT
  p.name AS product_name,
  c.name AS category_name,
  p.requires_preparation,
  p.is_stock_returnable
FROM products p
JOIN categories c ON p.category_id = c.id
ORDER BY p.created_at DESC;


-- =========================================================
-- PHẦN 4: THÊM INDEX VÀ KHÓA NGOẠI CHO BẢNG stock_transactions
-- Mục đích:
-- Đảm bảo mỗi giao dịch kho luôn gắn với một sản phẩm hợp lệ trong bảng products.
-- =========================================================

ALTER TABLE stock_transactions
ADD INDEX idx_stock_transactions_product_id (product_id);

ALTER TABLE stock_transactions
ADD CONSTRAINT fk_stock_transactions_product_id
FOREIGN KEY (product_id) REFERENCES products(id);


-- =========================================================
-- PHẦN 5: THÊM RÀNG BUỘC LOẠI GIAO DỊCH KHO
-- Mục đích:
-- Chỉ cho phép transaction_type thuộc các loại hợp lệ:
-- import      : nhập kho
-- export      : xuất kho do bán hàng
-- adjustment  : điều chỉnh kho
-- return      : hoàn kho
-- =========================================================

ALTER TABLE stock_transactions
ADD CONSTRAINT chk_stock_transactions_type
CHECK (transaction_type IN ('import', 'export', 'adjustment', 'return'));


-- =========================================================
-- PHẦN 6: THÊM CONSTRAINT CHO categories
-- Mục đích:
-- Chặn dữ liệu danh mục sai logic.
--
-- Hợp lệ:
-- requires_preparation = 1 AND is_stock_returnable = 0
-- => Món cần chế biến, không hoàn kho khi hủy.
--
-- requires_preparation = 0 AND is_stock_returnable = 1
-- => Hàng có sẵn/đóng chai, được hoàn kho khi hủy.
-- =========================================================

ALTER TABLE categories
ADD CONSTRAINT chk_categories_stock_logic
CHECK (
  (requires_preparation = 1 AND is_stock_returnable = 0)
  OR
  (requires_preparation = 0 AND is_stock_returnable = 1)
);


-- =========================================================
-- PHẦN 7: THÊM CONSTRAINT CHO products
-- Mục đích:
-- Chặn dữ liệu sản phẩm sai logic.
-- Sản phẩm chỉ được thuộc một trong hai nhóm:
-- 1. Món cần chế biến
-- 2. Hàng có sẵn/được hoàn kho
-- =========================================================

ALTER TABLE products
ADD CONSTRAINT chk_products_stock_logic
CHECK (
  (requires_preparation = 1 AND is_stock_returnable = 0)
  OR
  (requires_preparation = 0 AND is_stock_returnable = 1)
);


-- =========================================================
-- PHẦN 8: KIỂM TRA LẠI CẤU TRÚC BẢNG SAU KHI THÊM CONSTRAINT
-- Mục đích:
-- Xác nhận các ràng buộc đã được thêm vào bảng.
-- =========================================================

SHOW CREATE TABLE stock_transactions;
SHOW CREATE TABLE categories;
SHOW CREATE TABLE products;


-- =========================================================
-- PHẦN 9: KIỂM TRA DANH SÁCH CHECK CONSTRAINT TRONG DATABASE HIỆN TẠI
-- Mục đích:
-- Kiểm tra nhanh các constraint đã tồn tại trong database.
-- =========================================================

SELECT
  TABLE_NAME,
  CONSTRAINT_NAME,
  CHECK_CLAUSE
FROM information_schema.CHECK_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE()
  AND CONSTRAINT_NAME IN (
    'chk_stock_transactions_type',
    'chk_categories_stock_logic',
    'chk_products_stock_logic'
  );

