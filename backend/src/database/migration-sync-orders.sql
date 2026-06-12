-- Migration: đồng bộ cấu trúc bảng orders với code hiện tại.
-- Dùng khi database được tạo từ schema cũ (CREATE TABLE IF NOT EXISTS không tự thêm cột mới).
-- Chạy file này trong MySQL Workbench sau khi đã chạy schema.sql.

USE pos_system;

DROP PROCEDURE IF EXISTS add_column_if_missing;

DELIMITER //
CREATE PROCEDURE add_column_if_missing(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND COLUMN_NAME = p_column
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN ', p_definition);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

-- Các cột bảng orders mà API POS cần
CALL add_column_if_missing('orders', 'promotion_id', '`promotion_id` CHAR(36) NULL');
CALL add_column_if_missing('orders', 'discount_amount', '`discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0');
CALL add_column_if_missing('orders', 'final_amount', '`final_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0');
CALL add_column_if_missing('orders', 'points_used', '`points_used` INT NOT NULL DEFAULT 0');
CALL add_column_if_missing('orders', 'points_earned', '`points_earned` INT NOT NULL DEFAULT 0');
CALL add_column_if_missing('orders', 'cancelled_by', '`cancelled_by` CHAR(36) NULL');
CALL add_column_if_missing('orders', 'cancelled_at', '`cancelled_at` DATETIME NULL');
CALL add_column_if_missing('orders', 'cancel_reason', '`cancel_reason` TEXT NULL');

DROP PROCEDURE IF EXISTS add_column_if_missing;
