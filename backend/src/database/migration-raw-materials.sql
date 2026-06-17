USE pos_system;

CREATE TABLE IF NOT EXISTS raw_materials (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  sku VARCHAR(80) NOT NULL UNIQUE,
  category VARCHAR(120) NOT NULL DEFAULT 'Khac',
  unit VARCHAR(30) NOT NULL,
  supplier_id CHAR(36),
  stock_quantity DECIMAL(12, 2) NOT NULL DEFAULT 0,
  import_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_raw_materials_stock_quantity CHECK (stock_quantity >= 0),
  CONSTRAINT chk_raw_materials_import_price CHECK (import_price >= 0)
);

ALTER TABLE raw_materials
  ADD COLUMN IF NOT EXISTS category VARCHAR(120) NOT NULL DEFAULT 'Khac',
  ADD COLUMN IF NOT EXISTS supplier_id CHAR(36) NULL;

CREATE INDEX IF NOT EXISTS idx_raw_materials_supplier_id ON raw_materials(supplier_id);

CREATE TABLE IF NOT EXISTS goods_receipt_material_details (
  id CHAR(36) PRIMARY KEY,
  receipt_id CHAR(36) NOT NULL,
  material_id CHAR(36) NOT NULL,
  quantity DECIMAL(12, 2) NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  line_total DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gr_material_details_receipt_id FOREIGN KEY (receipt_id) REFERENCES goods_receipts(id) ON DELETE CASCADE,
  CONSTRAINT fk_gr_material_details_material_id FOREIGN KEY (material_id) REFERENCES raw_materials(id) ON DELETE RESTRICT,
  CONSTRAINT chk_gr_material_details_quantity CHECK (quantity > 0),
  CONSTRAINT chk_gr_material_details_unit_price CHECK (unit_price >= 0),
  CONSTRAINT chk_gr_material_details_line_total CHECK (line_total >= 0)
);

INSERT INTO raw_materials (id, name, sku, unit, stock_quantity, import_price)
SELECT UUID(), 'Ca phe hat', 'NL-CAFE-HAT', 'kg', 0, 120000
WHERE NOT EXISTS (SELECT 1 FROM raw_materials WHERE sku = 'NL-CAFE-HAT');

INSERT INTO raw_materials (id, name, sku, unit, stock_quantity, import_price)
SELECT UUID(), 'Sua dac', 'NL-SUA-DAC', 'lon', 0, 25000
WHERE NOT EXISTS (SELECT 1 FROM raw_materials WHERE sku = 'NL-SUA-DAC');

INSERT INTO raw_materials (id, name, sku, unit, stock_quantity, import_price)
SELECT UUID(), 'Duong cat', 'NL-DUONG-CAT', 'kg', 0, 22000
WHERE NOT EXISTS (SELECT 1 FROM raw_materials WHERE sku = 'NL-DUONG-CAT');

INSERT INTO raw_materials (id, name, sku, unit, stock_quantity, import_price)
SELECT UUID(), 'Tran chau den', 'NL-TRAN-CHAU', 'kg', 0, 45000
WHERE NOT EXISTS (SELECT 1 FROM raw_materials WHERE sku = 'NL-TRAN-CHAU');

INSERT INTO raw_materials (id, name, sku, unit, stock_quantity, import_price)
SELECT UUID(), 'Bot mi', 'NL-BOT-MI', 'kg', 0, 18000
WHERE NOT EXISTS (SELECT 1 FROM raw_materials WHERE sku = 'NL-BOT-MI');
