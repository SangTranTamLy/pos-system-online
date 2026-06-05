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
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id CHAR(36) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role_id FOREIGN KEY (role_id) REFERENCES roles(id)
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
  phone VARCHAR(30) NOT NULL UNIQUE,
  email VARCHAR(255),
  loyalty_points INT NOT NULL DEFAULT 0,
  total_spent DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_customers_loyalty_points CHECK (loyalty_points >= 0),
  CONSTRAINT chk_customers_total_spent CHECK (total_spent >= 0)
);

CREATE TABLE IF NOT EXISTS promotions (
  id CHAR(36) PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  discount_type VARCHAR(30) NOT NULL,
  discount_value DECIMAL(12, 2) NOT NULL,
  start_at DATETIME,
  end_at DATETIME,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_promotions_discount_value CHECK (discount_value >= 0),
  CONSTRAINT chk_promotions_discount_type CHECK (discount_type IN ('percent', 'fixed'))
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
  points_used INT NOT NULL DEFAULT 0,
  points_earned INT NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_orders_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_orders_promotion_id FOREIGN KEY (promotion_id) REFERENCES promotions(id),
  CONSTRAINT chk_orders_total_amount CHECK (total_amount >= 0),
  CONSTRAINT chk_orders_discount_amount CHECK (discount_amount >= 0),
  CONSTRAINT chk_orders_final_amount CHECK (final_amount >= 0),
  CONSTRAINT chk_orders_points_used CHECK (points_used >= 0),
  CONSTRAINT chk_orders_points_earned CHECK (points_earned >= 0),
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
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_stock_transactions_product_id FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_stock_transactions_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT chk_stock_transactions_quantity CHECK (quantity > 0),
  CONSTRAINT chk_stock_transactions_type CHECK (transaction_type IN ('import', 'export', 'adjustment'))
);

CREATE TABLE IF NOT EXISTS customer_points (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  order_id CHAR(36),
  points INT NOT NULL,
  transaction_type VARCHAR(30) NOT NULL,
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_customer_points_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_customer_points_order_id FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT chk_customer_points_type CHECK (transaction_type IN ('earn', 'redeem', 'adjust'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36),
  action VARCHAR(120) NOT NULL,
  entity_name VARCHAR(120),
  entity_id CHAR(36),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_logs_user_id FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_created_by ON orders(created_by);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_details_order_id ON order_details(order_id);
CREATE INDEX idx_order_details_product_id ON order_details(product_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_stock_transactions_product_id ON stock_transactions(product_id);
CREATE INDEX idx_stock_transactions_created_by ON stock_transactions(created_by);
CREATE INDEX idx_customer_points_customer_id ON customer_points(customer_id);
CREATE INDEX idx_customer_points_order_id ON customer_points(order_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
