SET @schema_name = DATABASE();

SELECT id, full_name, phone
FROM customers
WHERE phone IS NULL
   OR phone NOT REGEXP '^[0-9]{10}$';

SET @invalid_customer_phone_count = (
  SELECT COUNT(*)
  FROM customers
  WHERE phone IS NULL
     OR phone NOT REGEXP '^[0-9]{10}$'
);

SET @sql = (
  SELECT IF(
    @invalid_customer_phone_count = 0
      AND (CHARACTER_MAXIMUM_LENGTH <> 10 OR IS_NULLABLE <> 'NO'),
    'ALTER TABLE customers MODIFY phone VARCHAR(10) NOT NULL',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'customers'
    AND COLUMN_NAME = 'phone'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    @invalid_customer_phone_count = 0 AND COUNT(*) = 0,
    'ALTER TABLE customers ADD CONSTRAINT chk_customers_phone_10_digits CHECK (phone REGEXP ''^[0-9]{10}$'')',
    'SELECT ''Chua them constraint: hay sua cac so dien thoai khach hang sai ve dung 10 so, sau do chay lai file nay.'' AS message'
  )
  FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @schema_name
    AND CONSTRAINT_NAME = 'chk_customers_phone_10_digits'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
