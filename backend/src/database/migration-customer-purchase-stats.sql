SET @schema_name = DATABASE();
SET @old_sql_safe_updates = @@SQL_SAFE_UPDATES;
SET SQL_SAFE_UPDATES = 0;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'CREATE UNIQUE INDEX uq_customers_phone ON customers(phone)',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'customers'
    AND NON_UNIQUE = 0
    AND COLUMN_NAME = 'phone'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE customers ADD COLUMN order_count INT NOT NULL DEFAULT 0',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'customers'
    AND COLUMN_NAME = 'order_count'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE customers ADD COLUMN last_order_at DATETIME NULL',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'customers'
    AND COLUMN_NAME = 'last_order_at'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE customers c
LEFT JOIN (
  SELECT
    customer_id,
    COUNT(*) AS order_count,
    COALESCE(SUM(final_amount), 0) AS total_spent,
    MAX(created_at) AS last_order_at
  FROM orders
  WHERE customer_id IS NOT NULL
    AND status = 'completed'
  GROUP BY customer_id
) o ON o.customer_id = c.id
SET
  c.order_count = COALESCE(o.order_count, 0),
  c.total_spent = COALESCE(o.total_spent, 0),
  c.last_order_at = o.last_order_at
WHERE c.id <> '';

SET SQL_SAFE_UPDATES = @old_sql_safe_updates;
