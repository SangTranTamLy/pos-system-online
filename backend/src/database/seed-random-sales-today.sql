-- Seed du lieu ban hang ngau nhien cho NGAY HOM NAY.
--
-- File nay tao them du lieu that cho AI phan tich trong menu Bao cao/Tong quan:
-- - shifts: 3 ca hom nay, da dong ca
-- - orders: don hang hoan thanh, co gan shift_id va nhan vien ban
-- - order_details: san pham da ban trong tung don
-- - payments: thanh toan thanh cong bang cash hoac qr
-- - audit_logs: dang nhap, mo ca, ban hang/giam gia, dong ca, dang xuat
-- - stock_transactions: xuat kho neu san pham co quan ly ton kho
-- - products: tru ton kho va tat is_available neu het hang
--
-- Cach dung:
-- 1) Chon database truoc khi chay, vi du:
--    USE pos_system;
-- 2) Chay toan bo file nay trong MySQL Workbench.
--
-- Luu y:
-- - Script chi THEM du lieu moi, khong xoa du lieu cu.
-- - Neu chay nhieu lan, du lieu hom nay se duoc cong them.
-- - Don seed co note bat dau bang "SEED_TODAY_RANDOM_SALES".
-- - Ca seed co closing_note bat dau bang "SEED_TODAY_RANDOM_SHIFTS".
-- - Thanh toan chi tao cash hoac qr, khong tao card/the.

SET @seed_today_date = CURDATE();
SET @seed_order_count = 85;
SET @old_sql_safe_updates = @@SQL_SAFE_UPDATES;
SET SQL_SAFE_UPDATES = 0;

DROP PROCEDURE IF EXISTS seed_random_sales_today;

DELIMITER $$

CREATE PROCEDURE seed_random_sales_today()
BEGIN
  DECLARE v_shift_index INT DEFAULT 0;
  DECLARE v_order_index INT DEFAULT 0;
  DECLARE v_line_index INT DEFAULT 0;
  DECLARE v_line_count INT DEFAULT 0;

  DECLARE v_employee_count INT DEFAULT 0;
  DECLARE v_product_count INT DEFAULT 0;
  DECLARE v_manager_id CHAR(36);

  DECLARE v_shift_id CHAR(36);
  DECLARE v_shift_start DATETIME;
  DECLARE v_shift_end DATETIME;
  DECLARE v_actual_start DATETIME;
  DECLARE v_actual_end DATETIME;
  DECLARE v_opening_cash DECIMAL(12,2) DEFAULT 500000;

  DECLARE v_order_id CHAR(36);
  DECLARE v_detail_id CHAR(36);
  DECLARE v_payment_id CHAR(36);
  DECLARE v_employee_id CHAR(36);
  DECLARE v_employee_name VARCHAR(120);
  DECLARE v_product_id CHAR(36);
  DECLARE v_product_name VARCHAR(160);
  DECLARE v_order_time DATETIME;
  DECLARE v_quantity INT DEFAULT 1;
  DECLARE v_unit_price DECIMAL(12,2) DEFAULT 0;
  DECLARE v_line_total DECIMAL(12,2) DEFAULT 0;
  DECLARE v_total_amount DECIMAL(12,2) DEFAULT 0;
  DECLARE v_discount_amount DECIMAL(12,2) DEFAULT 0;
  DECLARE v_final_amount DECIMAL(12,2) DEFAULT 0;
  DECLARE v_payment_method VARCHAR(30);
  DECLARE v_action_type VARCHAR(50);
  DECLARE v_audit_description TEXT;
  DECLARE v_is_tracked_stock TINYINT DEFAULT 0;
  DECLARE v_stock_quantity INT DEFAULT NULL;

  DROP TEMPORARY TABLE IF EXISTS tmp_seed_today_employees;
  CREATE TEMPORARY TABLE tmp_seed_today_employees (
    seq INT AUTO_INCREMENT PRIMARY KEY,
    id CHAR(36) NOT NULL,
    full_name VARCHAR(120) NOT NULL
  );

  INSERT INTO tmp_seed_today_employees (id, full_name)
  SELECT id, full_name
  FROM users
  WHERE id IN (
    '1635f7f4-eea4-4bd7-88f2-c9476e2b6dc3',
    '290026c7-b83a-4ee7-b405-e40cac173621',
    '39f62ef6-61ea-40d3-90c8-1581c03a0dec'
  )
    AND is_active = 1
  ORDER BY full_name;

  SELECT COUNT(*) INTO v_employee_count FROM tmp_seed_today_employees;

  IF v_employee_count < 3 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Khong tim du 3 nhan vien seed. Kiem tra lai bang users.';
  END IF;

  SELECT u.id
  INTO v_manager_id
  FROM users u
  JOIN roles r ON r.id = u.role_id
  WHERE u.is_active = 1
    AND LOWER(r.name) IN ('admin', 'manager')
  ORDER BY FIELD(LOWER(r.name), 'admin', 'manager'), u.created_at
  LIMIT 1;

  IF v_manager_id IS NULL THEN
    SELECT id INTO v_manager_id
    FROM tmp_seed_today_employees
    ORDER BY seq
    LIMIT 1;
  END IF;

  SELECT COUNT(*) INTO v_product_count
  FROM products
  WHERE status = 'active'
    AND is_available = 1
    AND sale_price BETWEEN 10000 AND 150000
    AND (is_tracked_stock = 0 OR COALESCE(stock_quantity, 0) >= 2);

  IF v_product_count = 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Khong co san pham active phu hop de seed don hang.';
  END IF;

  DROP TEMPORARY TABLE IF EXISTS tmp_seed_today_shifts;
  CREATE TEMPORARY TABLE tmp_seed_today_shifts (
    shift_id CHAR(36) PRIMARY KEY,
    employee_id CHAR(36) NOT NULL,
    employee_name VARCHAR(120) NOT NULL,
    shift_start DATETIME NOT NULL,
    shift_end DATETIME NOT NULL
  );

  START TRANSACTION;

  WHILE v_shift_index < 3 DO
    SELECT id, full_name
    INTO v_employee_id, v_employee_name
    FROM tmp_seed_today_employees
    WHERE seq = v_shift_index + 1
    LIMIT 1;

    SET v_shift_id = UUID();

    IF v_shift_index = 0 THEN
      SET v_shift_start = TIMESTAMP(@seed_today_date, '06:00:00');
      SET v_shift_end = TIMESTAMP(@seed_today_date, '11:30:00');
    ELSEIF v_shift_index = 1 THEN
      SET v_shift_start = TIMESTAMP(@seed_today_date, '11:30:00');
      SET v_shift_end = TIMESTAMP(@seed_today_date, '17:00:00');
    ELSE
      SET v_shift_start = TIMESTAMP(@seed_today_date, '17:00:00');
      SET v_shift_end = TIMESTAMP(@seed_today_date, '22:00:00');
    END IF;

    SET v_actual_start = DATE_ADD(v_shift_start, INTERVAL FLOOR(RAND() * 10) MINUTE);
    SET v_actual_end = DATE_ADD(v_shift_end, INTERVAL FLOOR(RAND() * 12) MINUTE);
    SET v_opening_cash = ELT(1 + FLOOR(RAND() * 3), 300000, 500000, 600000);

    INSERT INTO shifts (
      id,
      user_id,
      expected_start_time,
      expected_end_time,
      actual_start_time,
      actual_end_time,
      status,
      approved_by,
      opened_by,
      closed_by,
      opening_cash,
      actual_closing_cash,
      total_sales_cash,
      total_sales_qr,
      total_sales,
      variance,
      closing_note,
      created_at,
      updated_at
    )
    VALUES (
      v_shift_id,
      v_employee_id,
      v_shift_start,
      v_shift_end,
      v_actual_start,
      v_actual_end,
      'CLOSED',
      v_manager_id,
      v_employee_id,
      v_employee_id,
      v_opening_cash,
      v_opening_cash,
      0,
      0,
      0,
      0,
      'SEED_TODAY_RANDOM_SHIFTS | Ca hom nay da dong tu dong de phuc vu AI',
      v_actual_start,
      v_actual_end
    );

    INSERT INTO tmp_seed_today_shifts (shift_id, employee_id, employee_name, shift_start, shift_end)
    VALUES (v_shift_id, v_employee_id, v_employee_name, v_shift_start, v_shift_end);

    INSERT INTO audit_logs (
      id,
      `timestamp`,
      user_id,
      user_name,
      `role`,
      action_type,
      target_object,
      description,
      old_values,
      new_values
    )
    VALUES
    (
      UUID(),
      DATE_SUB(v_actual_start, INTERVAL 2 MINUTE),
      v_employee_id,
      v_employee_name,
      'TN',
      'DANG_NHAP',
      'Thiet bi POS',
      'SEED_TODAY_RANDOM_SHIFTS | Nhan vien dang nhap truoc khi mo ca.',
      NULL,
      NULL
    ),
    (
      UUID(),
      v_actual_start,
      v_employee_id,
      v_employee_name,
      'TN',
      'MO_CA',
      CONCAT('Ca lam #', v_shift_id),
      CONCAT('SEED_TODAY_RANDOM_SHIFTS | Mo ca. Tien dau ca: ', FORMAT(v_opening_cash, 0), 'd.'),
      NULL,
      NULL
    );

    SET v_shift_index = v_shift_index + 1;
  END WHILE;

  WHILE v_order_index < @seed_order_count DO
    SET v_order_id = UUID();
    SET v_total_amount = 0;
    SET v_discount_amount = 0;
    SET v_final_amount = 0;
    SET v_line_count = 1 + FLOOR(RAND() * 3);
    SET v_line_index = 0;

    SELECT shift_id, employee_id, employee_name, shift_start, shift_end
    INTO v_shift_id, v_employee_id, v_employee_name, v_shift_start, v_shift_end
    FROM tmp_seed_today_shifts
    ORDER BY RAND()
    LIMIT 1;

    SET v_order_time = DATE_ADD(
      v_shift_start,
      INTERVAL FLOOR(RAND() * GREATEST(TIMESTAMPDIFF(MINUTE, v_shift_start, v_shift_end), 1)) MINUTE
    );
    SET v_order_time = DATE_ADD(v_order_time, INTERVAL FLOOR(RAND() * 60) SECOND);

    INSERT INTO orders (
      id,
      customer_id,
      shift_id,
      created_by,
      promotion_id,
      status,
      total_amount,
      discount_amount,
      final_amount,
      note,
      created_at,
      updated_at
    )
    VALUES (
      v_order_id,
      NULL,
      v_shift_id,
      v_employee_id,
      NULL,
      'completed',
      0,
      0,
      0,
      CONCAT('SEED_TODAY_RANDOM_SALES | Nhan vien: ', v_employee_name),
      v_order_time,
      v_order_time
    );

    WHILE v_line_index < v_line_count DO
      SET v_quantity = 1 + FLOOR(RAND() * 2);

      SELECT id, name, sale_price, is_tracked_stock, stock_quantity
      INTO v_product_id, v_product_name, v_unit_price, v_is_tracked_stock, v_stock_quantity
      FROM products
      WHERE status = 'active'
        AND is_available = 1
        AND sale_price BETWEEN 10000 AND 150000
        AND (is_tracked_stock = 0 OR COALESCE(stock_quantity, 0) >= v_quantity)
      ORDER BY RAND()
      LIMIT 1;

      SET v_detail_id = UUID();
      SET v_line_total = v_unit_price * v_quantity;
      SET v_total_amount = v_total_amount + v_line_total;

      INSERT INTO order_details (
        id,
        order_id,
        product_id,
        quantity,
        unit_price,
        line_total,
        options
      )
      VALUES (
        v_detail_id,
        v_order_id,
        v_product_id,
        v_quantity,
        v_unit_price,
        v_line_total,
        NULL
      );

      IF v_is_tracked_stock = 1 THEN
        UPDATE products
        SET
          stock_quantity = stock_quantity - v_quantity,
          is_available = CASE
            WHEN stock_quantity - v_quantity <= 0 THEN 0
            ELSE is_available
          END
        WHERE id = v_product_id;

        INSERT INTO stock_transactions (
          id,
          product_id,
          created_by,
          transaction_type,
          quantity,
          note,
          created_at
        )
        VALUES (
          UUID(),
          v_product_id,
          v_employee_id,
          'export',
          v_quantity,
          CONCAT('SEED_TODAY_RANDOM_SALES | Ban hang tai quay - don ', v_order_id, ' - ', v_product_name),
          v_order_time
        );
      END IF;

      SET v_line_index = v_line_index + 1;
    END WHILE;

    IF RAND() < 0.16 THEN
      SET v_discount_amount = ROUND(v_total_amount * 0.05, 0);
    ELSE
      SET v_discount_amount = 0;
    END IF;

    SET v_final_amount = v_total_amount - v_discount_amount;

    UPDATE orders
    SET
      total_amount = v_total_amount,
      discount_amount = v_discount_amount,
      final_amount = v_final_amount,
      updated_at = v_order_time
    WHERE id = v_order_id;

    SET v_payment_method = CASE
      WHEN RAND() < 0.55 THEN 'cash'
      ELSE 'qr'
    END;

    SET v_payment_id = UUID();

    INSERT INTO payments (
      id,
      order_id,
      payment_method,
      amount,
      payment_status,
      paid_at
    )
    VALUES (
      v_payment_id,
      v_order_id,
      v_payment_method,
      v_final_amount,
      'paid',
      v_order_time
    );

    SET v_action_type = IF(v_discount_amount > 0, 'GIAM_GIA', 'BAN_HANG');
    SET v_audit_description = IF(
      v_discount_amount > 0,
      CONCAT(
        'Thanh toan thanh cong don hang. Tong tien goc: ',
        FORMAT(v_total_amount, 0),
        'd, Giam gia: ',
        FORMAT(v_discount_amount, 0),
        'd, Thuc thu: ',
        FORMAT(v_final_amount, 0),
        'd.'
      ),
      CONCAT(
        'Thanh toan thanh cong don hang. Tong tien: ',
        FORMAT(v_final_amount, 0),
        'd.'
      )
    );

    INSERT INTO audit_logs (
      id,
      `timestamp`,
      user_id,
      user_name,
      `role`,
      action_type,
      target_object,
      description,
      old_values,
      new_values
    )
    VALUES (
      UUID(),
      v_order_time,
      v_employee_id,
      v_employee_name,
      'TN',
      v_action_type,
      CONCAT('Don #', v_order_id),
      v_audit_description,
      NULL,
      NULL
    );

    SET v_order_index = v_order_index + 1;
  END WHILE;

  UPDATE shifts s
  LEFT JOIN (
    SELECT
      o.shift_id,
      SUM(CASE WHEN p.payment_method = 'cash' THEN p.amount ELSE 0 END) AS cash_total,
      SUM(CASE WHEN p.payment_method = 'qr' THEN p.amount ELSE 0 END) AS qr_total,
      SUM(p.amount) AS paid_total
    FROM orders o
    JOIN payments p ON p.order_id = o.id
    WHERE o.note LIKE 'SEED_TODAY_RANDOM_SALES%'
      AND o.status = 'completed'
      AND p.payment_status = 'paid'
      AND DATE(o.created_at) = @seed_today_date
    GROUP BY o.shift_id
  ) pay ON pay.shift_id = s.id
  JOIN tmp_seed_today_shifts tss ON tss.shift_id = s.id
  SET
    s.total_sales_cash = COALESCE(pay.cash_total, 0),
    s.total_sales_qr = COALESCE(pay.qr_total, 0),
    s.total_sales = COALESCE(pay.paid_total, 0),
    s.variance = CASE
      WHEN COALESCE(pay.paid_total, 0) = 0 THEN 0
      WHEN RAND() < 0.85 THEN 0
      WHEN RAND() < 0.93 THEN 5000
      ELSE -5000
    END,
    s.actual_closing_cash = s.opening_cash + COALESCE(pay.cash_total, 0),
    s.updated_at = s.actual_end_time
  WHERE s.id = tss.shift_id
    AND s.closing_note LIKE 'SEED_TODAY_RANDOM_SHIFTS%';

  UPDATE shifts s
  JOIN tmp_seed_today_shifts tss ON tss.shift_id = s.id
  SET s.actual_closing_cash = s.opening_cash + s.total_sales_cash + s.variance
  WHERE s.id = tss.shift_id
    AND s.closing_note LIKE 'SEED_TODAY_RANDOM_SHIFTS%';

  INSERT INTO audit_logs (
    id,
    `timestamp`,
    user_id,
    user_name,
    `role`,
    action_type,
    target_object,
    description,
    old_values,
    new_values
  )
  SELECT
    UUID(),
    s.actual_end_time,
    s.user_id,
    u.full_name,
    'TN',
    'DONG_CA',
    CONCAT('Ca lam #', s.id),
    CONCAT(
      'SEED_TODAY_RANDOM_SHIFTS | Dong ca. Doanh thu: ',
      FORMAT(s.total_sales, 0),
      'd, tien mat: ',
      FORMAT(s.total_sales_cash, 0),
      'd, QR: ',
      FORMAT(s.total_sales_qr, 0),
      'd, chenh lech: ',
      FORMAT(s.variance, 0),
      'd.'
    ),
    NULL,
    NULL
  FROM shifts s
  JOIN tmp_seed_today_shifts tss ON tss.shift_id = s.id
  JOIN users u ON u.id = s.user_id
  WHERE s.closing_note LIKE 'SEED_TODAY_RANDOM_SHIFTS%';

  INSERT INTO audit_logs (
    id,
    `timestamp`,
    user_id,
    user_name,
    `role`,
    action_type,
    target_object,
    description,
    old_values,
    new_values
  )
  SELECT
    UUID(),
    DATE_ADD(s.actual_end_time, INTERVAL 1 MINUTE),
    s.user_id,
    u.full_name,
    'TN',
    'DANG_XUAT',
    'He thong',
    'SEED_TODAY_RANDOM_SHIFTS | Nhan vien dang xuat sau khi dong ca.',
    NULL,
    NULL
  FROM shifts s
  JOIN tmp_seed_today_shifts tss ON tss.shift_id = s.id
  JOIN users u ON u.id = s.user_id
  WHERE s.closing_note LIKE 'SEED_TODAY_RANDOM_SHIFTS%';

  COMMIT;

  SELECT
    'Da seed du lieu ban hang ngau nhien cho hom nay' AS message,
    @seed_today_date AS seed_date,
    @seed_order_count AS created_orders,
    (SELECT COUNT(*) FROM tmp_seed_today_shifts) AS created_shifts,
    'orders, order_details, payments, shifts, audit_logs, stock_transactions, products.stock_quantity' AS affected_features;
END$$

DELIMITER ;

CALL seed_random_sales_today();

DROP PROCEDURE IF EXISTS seed_random_sales_today;

SET SQL_SAFE_UPDATES = @old_sql_safe_updates;
