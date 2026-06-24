-- Shift menu backend/database setup for MySQL Workbench.
-- Cách chạy:
-- 1. Mở MySQL Workbench.
-- 2. Chọn database của dự án, ví dụ: USE pos_system;
-- 3. Chạy toàn bộ file này.

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
  CONSTRAINT chk_shifts_status CHECK (
    status IN (
      'PENDING',
      'APPROVED',
      'OPENING_REQUEST',
      'OPEN',
      'CLOSING_REQUEST',
      'CLOSED',
      'CANCELLED'
    )
  ),
  CONSTRAINT chk_shifts_cash CHECK (opening_cash >= 0 AND actual_closing_cash >= 0),
  CONSTRAINT chk_shifts_sales CHECK (
    total_sales_cash >= 0
    AND total_sales_qr >= 0
    AND total_sales >= 0
  )
);

DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;
DROP PROCEDURE IF EXISTS add_fk_if_missing;
DROP PROCEDURE IF EXISTS drop_check_if_exists;
DROP PROCEDURE IF EXISTS add_check_if_missing;

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
    SET @sql = CONCAT('ALTER TABLE `', table_name_in, '` ADD COLUMN ', column_definition_in);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//

CREATE PROCEDURE add_index_if_missing(
  IN table_name_in VARCHAR(64),
  IN index_name_in VARCHAR(64),
  IN columns_in TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_in
      AND INDEX_NAME = index_name_in
  ) THEN
    SET @sql = CONCAT('CREATE INDEX `', index_name_in, '` ON `', table_name_in, '` (', columns_in, ')');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//

CREATE PROCEDURE add_fk_if_missing(
  IN table_name_in VARCHAR(64),
  IN constraint_name_in VARCHAR(64),
  IN fk_sql_in TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_in
      AND CONSTRAINT_NAME = constraint_name_in
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', table_name_in, '` ADD CONSTRAINT `', constraint_name_in, '` ', fk_sql_in);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//

CREATE PROCEDURE drop_check_if_exists(
  IN table_name_in VARCHAR(64),
  IN constraint_name_in VARCHAR(64)
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_in
      AND CONSTRAINT_NAME = constraint_name_in
      AND CONSTRAINT_TYPE = 'CHECK'
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', table_name_in, '` DROP CHECK `', constraint_name_in, '`');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//

CREATE PROCEDURE add_check_if_missing(
  IN table_name_in VARCHAR(64),
  IN constraint_name_in VARCHAR(64),
  IN check_sql_in TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_in
      AND CONSTRAINT_NAME = constraint_name_in
      AND CONSTRAINT_TYPE = 'CHECK'
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', table_name_in, '` ADD CONSTRAINT `', constraint_name_in, '` CHECK (', check_sql_in, ')');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//

DELIMITER ;

CALL add_column_if_missing('shifts', 'actual_start_time', '`actual_start_time` DATETIME NULL AFTER `expected_end_time`');
CALL add_column_if_missing('shifts', 'actual_end_time', '`actual_end_time` DATETIME NULL AFTER `actual_start_time`');
CALL add_column_if_missing('shifts', 'approved_by', '`approved_by` CHAR(36) NULL AFTER `status`');
CALL add_column_if_missing('shifts', 'opened_by', '`opened_by` CHAR(36) NULL AFTER `approved_by`');
CALL add_column_if_missing('shifts', 'closed_by', '`closed_by` CHAR(36) NULL AFTER `opened_by`');
CALL add_column_if_missing('shifts', 'opening_cash', '`opening_cash` DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER `closed_by`');
CALL add_column_if_missing('shifts', 'actual_closing_cash', '`actual_closing_cash` DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER `opening_cash`');
CALL add_column_if_missing('shifts', 'total_sales_cash', '`total_sales_cash` DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER `actual_closing_cash`');
CALL add_column_if_missing('shifts', 'total_sales_qr', '`total_sales_qr` DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER `total_sales_cash`');
CALL add_column_if_missing('shifts', 'total_sales', '`total_sales` DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER `total_sales_qr`');
CALL add_column_if_missing('shifts', 'variance', '`variance` DECIMAL(12, 2) NOT NULL DEFAULT 0 AFTER `total_sales`');
CALL add_column_if_missing('shifts', 'closing_note', '`closing_note` TEXT NULL AFTER `variance`');
CALL add_column_if_missing('shifts', 'created_at', '`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `closing_note`');
CALL add_column_if_missing('shifts', 'updated_at', '`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`');
CALL add_column_if_missing('orders', 'shift_id', '`shift_id` CHAR(36) NULL AFTER `customer_id`');

CALL add_fk_if_missing('shifts', 'fk_shifts_user_id', 'FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)');
CALL add_fk_if_missing('shifts', 'fk_shifts_approved_by', 'FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL');
CALL add_fk_if_missing('shifts', 'fk_shifts_opened_by', 'FOREIGN KEY (`opened_by`) REFERENCES `users`(`id`) ON DELETE SET NULL');
CALL add_fk_if_missing('shifts', 'fk_shifts_closed_by', 'FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL');
CALL add_fk_if_missing('orders', 'fk_orders_shift_id', 'FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON DELETE SET NULL');

CALL drop_check_if_exists('shifts', 'chk_shifts_status');
CALL add_check_if_missing(
  'shifts',
  'chk_shifts_status',
  "`status` IN ('PENDING','APPROVED','OPENING_REQUEST','OPEN','CLOSING_REQUEST','CLOSED','CANCELLED')"
);

CALL add_index_if_missing('shifts', 'idx_shifts_user_id', '`user_id`');
CALL add_index_if_missing('shifts', 'idx_shifts_status', '`status`');
CALL add_index_if_missing('shifts', 'idx_shifts_time', '`expected_start_time`, `expected_end_time`');
CALL add_index_if_missing('orders', 'idx_orders_shift_id', '`shift_id`');

DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;
DROP PROCEDURE IF EXISTS add_fk_if_missing;
DROP PROCEDURE IF EXISTS drop_check_if_exists;
DROP PROCEDURE IF EXISTS add_check_if_missing;
