-- Remove the whole loyalty-points feature from an existing pos_system database.
-- Run this once after deploying the code that no longer uses points.

USE pos_system;

DROP PROCEDURE IF EXISTS drop_check_if_exists;
DELIMITER //
CREATE PROCEDURE drop_check_if_exists(
  IN table_name_in VARCHAR(64),
  IN constraint_name_in VARCHAR(64)
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_in
      AND CONSTRAINT_NAME = constraint_name_in
      AND CONSTRAINT_TYPE = 'CHECK'
  ) THEN
    SET @sql = CONCAT(
      'ALTER TABLE `',
      table_name_in,
      '` DROP CHECK `',
      constraint_name_in,
      '`'
    );
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//
DELIMITER ;

DROP PROCEDURE IF EXISTS drop_column_if_exists;
DELIMITER //
CREATE PROCEDURE drop_column_if_exists(
  IN table_name_in VARCHAR(64),
  IN column_name_in VARCHAR(64)
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name_in
      AND COLUMN_NAME = column_name_in
  ) THEN
    SET @sql = CONCAT(
      'ALTER TABLE `',
      table_name_in,
      '` DROP COLUMN `',
      column_name_in,
      '`'
    );
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//
DELIMITER ;

DROP TABLE IF EXISTS customer_points;

CALL drop_check_if_exists('customers', 'chk_customers_loyalty_points');
CALL drop_column_if_exists('customers', 'loyalty_points');

CALL drop_check_if_exists('orders', 'chk_orders_points_used');
CALL drop_check_if_exists('orders', 'chk_orders_points_earned');
CALL drop_column_if_exists('orders', 'points_used');
CALL drop_column_if_exists('orders', 'points_earned');

DROP PROCEDURE IF EXISTS drop_check_if_exists;
DROP PROCEDURE IF EXISTS drop_column_if_exists;
