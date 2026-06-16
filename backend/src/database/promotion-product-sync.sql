USE pos_system;

DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS create_index_if_missing;
DROP PROCEDURE IF EXISTS add_fk_if_missing;

DELIMITER //

CREATE PROCEDURE add_column_if_missing(
  IN table_name_in VARCHAR(64),
  IN column_name_in VARCHAR(64),
  IN column_definition_in TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_in
      AND COLUMN_NAME = column_name_in
  ) THEN
    SET @sql = CONCAT(
      'ALTER TABLE `',
      table_name_in,
      '` ADD COLUMN ',
      column_definition_in
    );
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//

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

CREATE PROCEDURE add_fk_if_missing(
  IN table_name_in VARCHAR(64),
  IN fk_name_in VARCHAR(64),
  IN fk_definition_in TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_in
      AND CONSTRAINT_NAME = fk_name_in
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    SET @sql = CONCAT(
      'ALTER TABLE `',
      table_name_in,
      '` ADD CONSTRAINT `',
      fk_name_in,
      '` ',
      fk_definition_in
    );
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//

DELIMITER ;

CALL add_column_if_missing(
  'promotions',
  'product_id',
  '`product_id` CHAR(36) NULL AFTER `id`'
);

CALL create_index_if_missing(
  'promotions',
  'idx_promotions_product_id',
  'product_id'
);

CALL add_fk_if_missing(
  'promotions',
  'fk_promotions_product_id',
  'FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)'
);

-- Chay cau nay de xem cac ma khuyen mai cu chua gan san pham.
-- POS se khong ap dung cac ma chua co product_id.
SELECT id, code, name, product_id
FROM promotions
WHERE product_id IS NULL;

-- Gan san pham cho ma cu bang mau lenh ben duoi:
-- UPDATE promotions SET product_id = 'ID_SAN_PHAM' WHERE code = 'MA_KHUYEN_MAI';

DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS create_index_if_missing;
DROP PROCEDURE IF EXISTS add_fk_if_missing;
