# Seed du lieu hom nay cho QuickServe-AI

File SQL da tao:

```text
backend/src/database/seed-random-sales-today.sql
```

## Muc dich

Tao du lieu ban hang ngau nhien cho ngay hien tai de AI co du lieu phan tich trong menu Bao cao.

## File nay tao gi?

- 3 ca lam trong ngay hom nay.
- 85 don hang hoan thanh.
- Chi tiet san pham da ban.
- Thanh toan bang `cash` hoac `qr`.
- Nhat ky he thong:
  - Dang nhap
  - Mo ca
  - Ban hang
  - Giam gia neu co
  - Dong ca
  - Dang xuat
- Giao dich xuat kho trong `stock_transactions`.
- Tru ton kho trong `products.stock_quantity` neu san pham co quan ly kho.

## File nay khong lam gi?

- Khong xoa database.
- Khong xoa du lieu cu.
- Khong tao thanh toan the/card.
- Khong hoan kho neu ban chay nhieu lan.

## Cach chay

Trong MySQL Workbench:

```sql
USE pos_system;
```

Sau do chay toan bo file:

```text
backend/src/database/seed-random-sales-today.sql
```

## Cach kiem tra nhanh

```sql
SELECT COUNT(*) AS today_orders
FROM orders
WHERE DATE(created_at) = CURDATE()
  AND note LIKE 'SEED_TODAY_RANDOM_SALES%';
```

```sql
SELECT COUNT(*) AS today_shifts
FROM shifts
WHERE DATE(expected_start_time) = CURDATE()
  AND closing_note LIKE 'SEED_TODAY_RANDOM_SHIFTS%';
```

```sql
SELECT payment_method, COUNT(*) AS payment_count, SUM(amount) AS total_amount
FROM payments p
JOIN orders o ON o.id = p.order_id
WHERE DATE(o.created_at) = CURDATE()
  AND o.note LIKE 'SEED_TODAY_RANDOM_SALES%'
GROUP BY payment_method;
```

## AI hoat dong voi du lieu nay nhu the nao?

1. Frontend menu Bao cao goi API `/api/reports/ai-insights`.
2. Backend gom du lieu tu `orders`, `order_details`, `payments`, `shifts`, `products`, `stock_transactions`.
3. Backend tao context trong `report-ai-context.service.ts`.
4. `report.service.ts` gui context do len AI kem prompt trong `report-ai.prompt.ts`.
5. AI tra ve JSON gom summary, insights, causes, action_plan, warnings, charts va report_tables.
6. Backend luu JSON AI vao bang `ai_report_logs`.
7. Frontend hien thi bao cao AI trong `ReportsPage.tsx`.

## Luu y khi test

- Sau khi seed, vao menu Bao cao.
- Chon bo loc thoi gian la hom nay.
- Bam `Lam moi AI`.
- Neu muon du lieu nhieu hon, co the chay lai file seed, nhung doanh thu va don hang se cong them.
