START TRANSACTION;

CREATE TABLE product_variants (
  id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  product_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  name VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  sku VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  sale_price DECIMAL(12,2) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_variants_sku (sku),
  KEY idx_product_variants_product (product_id),
  CONSTRAINT fk_product_variants_product
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT chk_product_variants_price CHECK (sale_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE variant_recipe_items (
  id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  variant_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  raw_material_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_variant_recipe_material (variant_id, raw_material_id),
  KEY idx_variant_recipe_material (raw_material_id),
  CONSTRAINT fk_variant_recipe_variant
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
  CONSTRAINT fk_variant_recipe_material
    FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id),
  CONSTRAINT chk_variant_recipe_quantity CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE modifier_options (
  id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  name VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  price_delta DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_modifier_price_delta CHECK (price_delta >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_modifier_options (
  product_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  modifier_option_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (product_id, modifier_option_id),
  KEY idx_product_modifier_option (modifier_option_id),
  CONSTRAINT fk_product_modifier_product
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_product_modifier_option
    FOREIGN KEY (modifier_option_id) REFERENCES modifier_options(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE modifier_recipe_items (
  id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  modifier_option_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  raw_material_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_modifier_recipe_material (modifier_option_id, raw_material_id),
  KEY idx_modifier_recipe_material (raw_material_id),
  CONSTRAINT fk_modifier_recipe_option
    FOREIGN KEY (modifier_option_id) REFERENCES modifier_options(id) ON DELETE CASCADE,
  CONSTRAINT fk_modifier_recipe_material
    FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id),
  CONSTRAINT chk_modifier_recipe_quantity CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE raw_material_transactions (
  id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  raw_material_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  order_detail_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  created_by CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  transaction_type VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  stock_delta DECIMAL(12,3) NOT NULL,
  stock_before DECIMAL(12,3) NOT NULL,
  stock_after DECIMAL(12,3) NOT NULL,
  note TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_raw_material_transactions_material (raw_material_id),
  KEY idx_raw_material_transactions_order_detail (order_detail_id),
  KEY idx_raw_material_transactions_created_by (created_by),
  CONSTRAINT fk_raw_material_transaction_material
    FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id),
  CONSTRAINT fk_raw_material_transaction_order_detail
    FOREIGN KEY (order_detail_id) REFERENCES order_details(id) ON DELETE SET NULL,
  CONSTRAINT fk_raw_material_transaction_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_raw_material_transaction_type
    CHECK (transaction_type IN ('sale_consumption', 'return', 'cancel_waste', 'manual_adjustment')),
  CONSTRAINT chk_raw_material_transaction_quantity CHECK (quantity >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE order_details
  ADD COLUMN variant_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER product_id,
  ADD COLUMN item_note VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER line_total,
  ADD COLUMN configuration_snapshot JSON DEFAULT NULL AFTER item_note,
  ADD KEY idx_order_details_variant (variant_id),
  ADD CONSTRAINT fk_order_details_variant
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL;

INSERT INTO product_variants (
  id, product_id, name, sku, sale_price, is_default, is_active
)
SELECT
  UUID(), p.id, 'Mặc định', CONCAT(p.sku, '-DEFAULT'), p.sale_price, 1, 1
FROM products p
WHERE NOT EXISTS (
  SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id
);

COMMIT;
