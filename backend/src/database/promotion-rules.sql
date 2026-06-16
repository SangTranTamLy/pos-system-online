USE pos_system;

CREATE TABLE IF NOT EXISTS promotion_rules (
  id CHAR(36) PRIMARY KEY,
  code VARCHAR(80) UNIQUE,
  name VARCHAR(160) NOT NULL,
  rule_type VARCHAR(40) NOT NULL,
  discount_type VARCHAR(40) NOT NULL,
  discount_value DECIMAL(12, 2) NOT NULL DEFAULT 0,
  min_order_amount DECIMAL(12, 2),
  start_time TIME,
  end_time TIME,
  days_of_week VARCHAR(40),
  priority INT NOT NULL DEFAULT 50,
  config JSON,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at DATETIME,
  ends_at DATETIME,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_promotion_rules_discount_value CHECK (discount_value >= 0),
  CONSTRAINT chk_promotion_rules_min_order_amount CHECK (min_order_amount IS NULL OR min_order_amount >= 0),
  CONSTRAINT chk_promotion_rules_type CHECK (rule_type IN ('combo_fixed', 'time_window', 'invoice_threshold', 'code', 'bundle_special_price', 'day_of_week')),
  CONSTRAINT chk_promotion_rules_discount_type CHECK (discount_type IN ('percent', 'fixed', 'special_price', 'buy_x_get_y'))
);

DROP PROCEDURE IF EXISTS create_index_if_missing;

DELIMITER //
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
DELIMITER ;

CALL create_index_if_missing('promotion_rules', 'idx_promotion_rules_code', 'code');
CALL create_index_if_missing('promotion_rules', 'idx_promotion_rules_active', 'is_active');

DROP PROCEDURE IF EXISTS create_index_if_missing;

INSERT INTO promotion_rules (
  id, code, name, rule_type, discount_type, discount_value,
  min_order_amount, start_time, end_time, days_of_week, priority, config, is_active
)
SELECT UUID(), NULL, 'Combo sang: banh mi + ca phe giam 8.000d',
       'combo_fixed', 'fixed', 8000,
       NULL, NULL, NULL, NULL, 10,
       JSON_OBJECT('requiredProductNameIncludes', JSON_ARRAY('banh mi', 'ca phe')),
       TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM promotion_rules WHERE name = 'Combo sang: banh mi + ca phe giam 8.000d'
);

INSERT INTO promotion_rules (
  id, code, name, rule_type, discount_type, discount_value,
  min_order_amount, start_time, end_time, days_of_week, priority, config, is_active
)
SELECT UUID(), NULL, 'Happy Hour 06:00-08:00 giam 10% do uong',
       'time_window', 'percent', 10,
       NULL, '06:00:00', '08:00:00', NULL, 20,
       JSON_OBJECT(
         'categoryNameIncludes', JSON_ARRAY('do uong', 'ca phe', 'tra', 'nuoc'),
         'productNameIncludes', JSON_ARRAY('ca phe', 'tra', 'sting', 'nuoc')
       ),
       TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM promotion_rules WHERE name = 'Happy Hour 06:00-08:00 giam 10% do uong'
);

INSERT INTO promotion_rules (
  id, code, name, rule_type, discount_type, discount_value,
  min_order_amount, start_time, end_time, days_of_week, priority, config, is_active
)
SELECT UUID(), NULL, 'Hoa don tu 120.000d giam 15.000d',
       'invoice_threshold', 'fixed', 15000,
       120000, NULL, NULL, NULL, 40,
       JSON_OBJECT(),
       TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM promotion_rules WHERE name = 'Hoa don tu 120.000d giam 15.000d'
);

INSERT INTO promotion_rules (
  id, code, name, rule_type, discount_type, discount_value,
  min_order_amount, start_time, end_time, days_of_week, priority, config, is_active
)
SELECT UUID(), 'SANG10', 'Ma SANG10 giam 10%',
       'code', 'percent', 10,
       NULL, NULL, NULL, NULL, 30,
       JSON_OBJECT(),
       TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM promotion_rules WHERE code = 'SANG10'
);

INSERT INTO promotion_rules (
  id, code, name, rule_type, discount_type, discount_value,
  min_order_amount, start_time, end_time, days_of_week, priority, config, is_active
)
SELECT UUID(), 'KHACHMOI15', 'Ma KHACHMOI15 giam 15.000d',
       'code', 'fixed', 15000,
       NULL, NULL, NULL, NULL, 30,
       JSON_OBJECT(),
       TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM promotion_rules WHERE code = 'KHACHMOI15'
);

INSERT INTO promotion_rules (
  id, code, name, rule_type, discount_type, discount_value,
  min_order_amount, start_time, end_time, days_of_week, priority, config, is_active
)
SELECT UUID(), NULL, 'Mua banh mi thi ca phe con 15.000d',
       'bundle_special_price', 'special_price', 15000,
       NULL, NULL, NULL, NULL, 25,
       JSON_OBJECT(
         'requiredProductNameIncludes', JSON_ARRAY('banh mi'),
         'discountedProductNameIncludes', JSON_ARRAY('ca phe'),
         'specialPrice', 15000
       ),
       FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM promotion_rules WHERE name = 'Mua banh mi thi ca phe con 15.000d'
);

INSERT INTO promotion_rules (
  id, code, name, rule_type, discount_type, discount_value,
  min_order_amount, start_time, end_time, days_of_week, priority, config, is_active
)
SELECT UUID(), NULL, 'Thu 2 giam 10% ca phe',
       'day_of_week', 'percent', 10,
       NULL, NULL, NULL, '1', 45,
       JSON_OBJECT('productNameIncludes', JSON_ARRAY('ca phe')),
       TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM promotion_rules WHERE name = 'Thu 2 giam 10% ca phe'
);

INSERT INTO promotion_rules (
  id, code, name, rule_type, discount_type, discount_value,
  min_order_amount, start_time, end_time, days_of_week, priority, config, is_active
)
SELECT UUID(), NULL, 'Thu 6 mua 2 nuoc tang 1',
       'day_of_week', 'buy_x_get_y', 0,
       NULL, NULL, NULL, '5', 45,
       JSON_OBJECT(
         'categoryNameIncludes', JSON_ARRAY('do uong', 'ca phe', 'tra', 'nuoc'),
         'productNameIncludes', JSON_ARRAY('ca phe', 'tra', 'sting', 'nuoc'),
         'buyQuantity', 2,
         'getQuantity', 1
       ),
       TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM promotion_rules WHERE name = 'Thu 6 mua 2 nuoc tang 1'
);

SELECT id, code, name, rule_type, discount_type, discount_value, priority, is_active
FROM promotion_rules
ORDER BY priority, created_at;
