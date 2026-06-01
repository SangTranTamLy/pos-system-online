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
  reserved_quantity INT NOT NULL DEFAULT 0,
  available_quantity INT GENERATED ALWAYS AS (stock_quantity - reserved_quantity) STORED,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category_id FOREIGN KEY (category_id) REFERENCES categories(id),
  CONSTRAINT chk_products_import_price CHECK (import_price >= 0),
  CONSTRAINT chk_products_sale_price CHECK (sale_price >= 0),
  CONSTRAINT chk_products_stock_quantity CHECK (stock_quantity >= 0),
  CONSTRAINT chk_products_reserved_quantity CHECK (reserved_quantity >= 0),
  CONSTRAINT chk_products_quantity CHECK (stock_quantity >= reserved_quantity),
  CONSTRAINT chk_products_status CHECK (status IN ('active', 'paused', 'out_of_stock'))
);

CREATE TABLE IF NOT EXISTS customers (
  id CHAR(36) PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pickup_schedules (
  id CHAR(36) PRIMARY KEY,
  pickup_time DATETIME NOT NULL,
  store_name VARCHAR(160) NOT NULL,
  store_address TEXT,
  max_orders INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_pickup_schedules_max_orders CHECK (max_orders >= 0)
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
  pickup_schedule_id CHAR(36),
  order_type VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL,
  pickup_code VARCHAR(80) UNIQUE,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_orders_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_orders_promotion_id FOREIGN KEY (promotion_id) REFERENCES promotions(id),
  CONSTRAINT fk_orders_pickup_schedule_id FOREIGN KEY (pickup_schedule_id) REFERENCES pickup_schedules(id),
  CONSTRAINT chk_orders_total_amount CHECK (total_amount >= 0),
  CONSTRAINT chk_orders_type CHECK (order_type IN ('pos', 'online')),
  CONSTRAINT chk_orders_status CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'))
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
  payment_status VARCHAR(30) NOT NULL,
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
  CONSTRAINT chk_stock_transactions_type CHECK (transaction_type IN ('import', 'export', 'adjustment', 'reserve', 'release'))
);

CREATE TABLE IF NOT EXISTS carts (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36),
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_carts_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT chk_carts_status CHECK (status IN ('active', 'ordered', 'abandoned'))
);

CREATE TABLE IF NOT EXISTS cart_items (
  id CHAR(36) PRIMARY KEY,
  cart_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cart_items_cart_id FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_product_id FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT chk_cart_items_quantity CHECK (quantity > 0),
  CONSTRAINT chk_cart_items_unit_price CHECK (unit_price >= 0)
);

CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY,
  order_id CHAR(36),
  customer_id CHAR(36),
  title VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_order_id FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_customer_id FOREIGN KEY (customer_id) REFERENCES customers(id)
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
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_created_by ON orders(created_by);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_pickup_schedule_id ON orders(pickup_schedule_id);
CREATE INDEX idx_order_details_order_id ON order_details(order_id);
CREATE INDEX idx_order_details_product_id ON order_details(product_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_stock_transactions_product_id ON stock_transactions(product_id);
CREATE INDEX idx_stock_transactions_created_by ON stock_transactions(created_by);
CREATE INDEX idx_carts_customer_id ON carts(customer_id);
CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);
CREATE INDEX idx_notifications_order_id ON notifications(order_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
