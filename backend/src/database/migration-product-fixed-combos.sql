-- Chạy sau migration-product-recipes-v1.sql và migration-remove-finished-product-stock.sql.
-- Combo này là một sản phẩm bán cố định; không liên quan đến combo khuyến mãi.
-- MySQL sẽ tự COMMIT các lệnh ALTER TABLE.

ALTER TABLE products
  ADD COLUMN product_type VARCHAR(20) NOT NULL DEFAULT 'single' AFTER is_available;

ALTER TABLE products
  ADD CONSTRAINT chk_products_product_type
  CHECK (product_type IN ('single', 'combo'));

CREATE TABLE combo_items (
  id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  combo_product_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  component_product_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  component_variant_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_combo_component (combo_product_id, component_product_id, component_variant_id),
  KEY idx_combo_component_product (component_product_id),
  KEY idx_combo_component_variant (component_variant_id),
  CONSTRAINT fk_combo_parent_product
    FOREIGN KEY (combo_product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_combo_component_product
    FOREIGN KEY (component_product_id) REFERENCES products(id),
  CONSTRAINT fk_combo_component_variant
    FOREIGN KEY (component_variant_id) REFERENCES product_variants(id),
  CONSTRAINT chk_combo_quantity CHECK (quantity > 0),
  CONSTRAINT chk_combo_no_self CHECK (combo_product_id <> component_product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
