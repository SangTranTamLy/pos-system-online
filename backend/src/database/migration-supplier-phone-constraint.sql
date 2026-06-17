SET @schema_name = DATABASE();

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE suppliers ADD CONSTRAINT chk_suppliers_phone_10_digits CHECK (phone REGEXP ''^[0-9]{10}$'')',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @schema_name
    AND CONSTRAINT_NAME = 'chk_suppliers_phone_10_digits'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
