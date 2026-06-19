CREATE DATABASE IF NOT EXISTS pos_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE pos_system;

CREATE TABLE IF NOT EXISTS roles (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) UNIQUE NULL,
  password_hash VARCHAR(255) NULL,
  username VARCHAR(20) UNIQUE NULL,
  pin_code VARCHAR(255) UNIQUE NULL,
  role_id CHAR(36) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role_id FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT chk_users_username_format CHECK (username IS NULL OR username REGEXP '^0[0-9]{9}$')
);

CREATE TABLE IF NOT EXISTS categories (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id CHAR(36) PRIMARY KEY,
  category_id CHAR(36) NOT NULL,
  sku VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  import_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  sale_price DECIMAL(12, 2) NOT NULL,
  stock_quantity INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  description TEXT,
  image_url TEXT,
  requires_preparation BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category_id FOREIGN KEY (category_id) REFERENCES categories(id),
  CONSTRAINT chk_products_import_price CHECK (import_price >= 0),
  CONSTRAINT chk_products_sale_price CHECK (sale_price >= 0),
  CONSTRAINT chk_products_stock_quantity CHECK (stock_quantity >= 0),
  CONSTRAINT chk_products_status CHECK (status IN ('active', 'paused', 'out_of_stock'))
);

CREATE TABLE IF NOT EXISTS customers (
  id CHAR(36) PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(10) NOT NULL UNIQUE,
  address VARCHAR(255),
  total_spent DECIMAL(12, 2) NOT NULL DEFAULT 0,
  order_count INT NOT NULL DEFAULT 0,
  last_order_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_customers_total_spent CHECK (total_spent >= 0),
  CONSTRAINT chk_customers_order_count CHECK (order_count >= 0),
  CONSTRAINT chk_customers_phone_10_digits CHECK (phone REGEXP '^[0-9]{10}$')
);

CREATE TABLE IF NOT EXISTS promotions (
  id CHAR(36) PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  discount_type VARCHAR(30) NOT NULL,
  discount_value DECIMAL(12, 2) NOT NULL,
  start_at DATETIME,
  end_at DATETIME,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_promotions_product_id FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT chk_promotions_discount_value CHECK (discount_value >= 0),
  CONSTRAINT chk_promotions_discount_type CHECK (discount_type IN ('percent', 'fixed'))
);

CREATE TABLE IF NOT EXISTS promotion_rules (
  id CHAR(36) PRIMARY KEY,
  code VARCHAR(80) UNIQUE,
  name VARCHAR(160) NOT NULL,
  rule_type VARCHAR(40) NOT NULL,
  discount_type VARCHAR(40) NOT NULL,
  discount_value DECIMAL(12, 2) NOT NULL DEFAULT 0,
  min_order_amount DECIMAL(12, 2),
  start_time TIME,
  end_time TIME,
  days_of_week VARCHAR(40),
  priority INT NOT NULL DEFAULT 50,
  config JSON,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at DATETIME,
  ends_at DATETIME,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_promotion_rules_discount_value CHECK (discount_value >= 0),
  CONSTRAINT chk_promotion_rules_min_order_amount CHECK (min_order_amount IS NULL OR min_order_amount >= 0),
  CONSTRAINT chk_promotion_rules_type CHECK (rule_type IN ('combo_fixed', 'time_window', 'invoice_threshold', 'code', 'bundle_special_price', 'day_of_week')),
  CONSTRAINT chk_promotion_rules_discount_type CHECK (discount_type IN ('percent', 'fixed', 'special_price', 'buy_x_get_y'))
);

CREATE TABLE IF NOT EXISTS orders (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36),
  created_by CHAR(36),
  promotion_id CHAR(36),
  status VARCHAR(30) NOT NULL DEFAULT 'completed',
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  final_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  note TEXT,
  cancelled_by CHAR(36),
  cancelled_at DATETIME,
  cancel_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_orders_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_orders_promotion_id FOREIGN KEY (promotion_id) REFERENCES promotions(id),
  CONSTRAINT fk_orders_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users(id),
  CONSTRAINT chk_orders_total_amount CHECK (total_amount >= 0),
  CONSTRAINT chk_orders_discount_amount CHECK (discount_amount >= 0),
  CONSTRAINT chk_orders_final_amount CHECK (final_amount >= 0),
  CONSTRAINT chk_orders_status CHECK (status IN ('completed', 'cancelled', 'refunded'))
);

CREATE TABLE IF NOT EXISTS order_details (
  id CHAR(36) PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  line_total DECIMAL(12, 2) NOT NULL,
  CONSTRAINT fk_order_details_order_id FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_details_product_id FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT chk_order_details_quantity CHECK (quantity > 0),
  CONSTRAINT chk_order_details_unit_price CHECK (unit_price >= 0),
  CONSTRAINT chk_order_details_line_total CHECK (line_total >= 0)
);

CREATE TABLE IF NOT EXISTS payments (
  id CHAR(36) PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  payment_method VARCHAR(30) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  payment_status VARCHAR(30) NOT NULL DEFAULT 'paid',
  paid_at DATETIME,
  CONSTRAINT fk_payments_order_id FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT chk_payments_amount CHECK (amount >= 0),
  CONSTRAINT chk_payments_method CHECK (payment_method IN ('cash', 'qr', 'card')),
  CONSTRAINT chk_payments_status CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'))
);

CREATE TABLE IF NOT EXISTS stock_transactions (
  id CHAR(36) PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  created_by CHAR(36),
  transaction_type VARCHAR(30) NOT NULL,
  quantity INT NOT NULL,
  note TEXT,
  cancelled_by CHAR(36),
  cancelled_at DATETIME,
  cancel_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_stock_transactions_product_id FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_stock_transactions_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT chk_stock_transactions_quantity CHECK (quantity > 0),
  CONSTRAINT chk_stock_transactions_type CHECK (transaction_type IN ('import', 'export', 'adjustment'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36),
  action VARCHAR(120) NOT NULL,
  entity_name VARCHAR(120),
  entity_id CHAR(36),
  metadata JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_logs_user_id FOREIGN KEY (user_id) REFERENCES users(id)
);


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
DROP PROCEDURE IF EXISTS create_index_if_missing;

DELIMITER //
CREATE PROCEDURE create_index_if_missing(
  IN table_name_in VARCHAR(64),
  IN index_name_in VARCHAR(64),
  IN index_columns_in TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_in
      AND INDEX_NAME = index_name_in
  ) THEN
    SET @sql = CONCAT(
      'CREATE INDEX `',
      index_name_in,
      '` ON `',
      table_name_in,
      '` (',
      index_columns_in,
      ')'
    );
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//
DELIMITER ;

CALL create_index_if_missing('users', 'idx_users_role_id', 'role_id');
CALL create_index_if_missing('products', 'idx_products_category_id', 'category_id');
CALL create_index_if_missing('products', 'idx_products_status', 'status');
CALL create_index_if_missing('customers', 'idx_customers_phone', 'phone');
CALL create_index_if_missing('promotions', 'idx_promotions_product_id', 'product_id');
CALL create_index_if_missing('promotion_rules', 'idx_promotion_rules_code', 'code');
CALL create_index_if_missing('promotion_rules', 'idx_promotion_rules_active', 'is_active');
CALL create_index_if_missing('orders', 'idx_orders_customer_id', 'customer_id');
CALL create_index_if_missing('orders', 'idx_orders_created_by', 'created_by');
CALL create_index_if_missing('orders', 'idx_orders_status', 'status');
CALL create_index_if_missing('order_details', 'idx_order_details_order_id', 'order_id');
CALL create_index_if_missing('order_details', 'idx_order_details_product_id', 'product_id');
CALL create_index_if_missing('payments', 'idx_payments_order_id', 'order_id');
CALL create_index_if_missing('stock_transactions', 'idx_stock_transactions_product_id', 'product_id');
CALL create_index_if_missing('stock_transactions', 'idx_stock_transactions_created_by', 'created_by');
CALL create_index_if_missing('audit_logs', 'idx_audit_logs_user_id', 'user_id');
CALL create_index_if_missing('waste_transactions', 'idx_waste_transactions_order_id', 'order_id');
CALL create_index_if_missing('waste_transactions', 'idx_waste_transactions_product_id', 'product_id');

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
  CONSTRAINT chk_shifts_status CHECK (status IN ('PENDING', 'APPROVED', 'OPENING_REQUEST', 'OPEN', 'CLOSING_REQUEST', 'CLOSED', 'CANCELLED'))
);

CALL create_index_if_missing('shifts', 'idx_shifts_user_id', 'user_id');
CALL create_index_if_missing('shifts', 'idx_shifts_status', 'status');
CALL create_index_if_missing('shifts', 'idx_shifts_time', 'expected_start_time,expected_end_time');

DROP PROCEDURE IF EXISTS create_index_if_missing;
