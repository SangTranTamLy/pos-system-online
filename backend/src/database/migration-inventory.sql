-- Migration to create tables for Inventory Goods Receipts (Nhập Kho) and Suppliers

CREATE TABLE IF NOT EXISTS suppliers (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  contact_name VARCHAR(120),
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(255),
  address TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS goods_receipts (
  id CHAR(36) PRIMARY KEY,
  supplier_id CHAR(36),
  created_by CHAR(36),
  note TEXT,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_goods_receipts_supplier_id FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  CONSTRAINT fk_goods_receipts_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS goods_receipt_details (
  id CHAR(36) PRIMARY KEY,
  receipt_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  line_total DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gr_details_receipt_id FOREIGN KEY (receipt_id) REFERENCES goods_receipts(id) ON DELETE CASCADE,
  CONSTRAINT fk_gr_details_product_id FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT chk_gr_details_quantity CHECK (quantity > 0),
  CONSTRAINT chk_gr_details_unit_price CHECK (unit_price >= 0),
  CONSTRAINT chk_gr_details_line_total CHECK (line_total >= 0)
);
