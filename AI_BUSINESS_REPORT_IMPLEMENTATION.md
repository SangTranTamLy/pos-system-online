# QuickServe-AI Business Report

Tài liệu này ghi lại luồng code hiện tại của tính năng báo cáo AI để dễ đọc, dễ test và dễ bàn giao.

## Mục tiêu

- AI phân tích dựa trên dữ liệu thật từ hệ thống POS.
- Không bịa số liệu nếu SQL/context không có dữ liệu.
- Mỗi nhận định phải đi qua: Data -> Validation -> Insight -> Root Cause -> Confidence -> Recommendation.
- JSON AI trả về được lưu vào database để xem lại lịch sử phân tích.
- Báo cáo có thể mở rộng để hiển thị bảng dữ liệu kiểu Excel, đặc biệt là bảng tồn kho.

## File database

### `backend/src/database/migration-ai-report-logs.sql`

Tạo bảng lưu lịch sử báo cáo AI:

- `input_context`: lưu toàn bộ dữ liệu đầu vào backend gom từ SQL.
- `ai_result`: lưu JSON AI trả về hoặc fallback JSON khi AI lỗi.
- `data_quality_score`: điểm chất lượng dữ liệu.
- `confidence`: độ tin cậy.
- `is_fallback`: đánh dấu báo cáo dùng dữ liệu fallback.
- `created_by`: user tạo báo cáo.

Trước khi dùng chức năng lưu AI report, chạy file SQL này trong MySQL.

## File backend

### `backend/src/services/report-ai-context.service.ts`

Đây là nơi gom dữ liệu đầu vào cho AI.

Nguồn dữ liệu chính:

- Doanh thu tổng quan.
- Doanh thu kỳ trước để so sánh tăng/giảm.
- Doanh thu theo giờ.
- Sản phẩm bán ra.
- Sản phẩm bán chậm.
- Phương thức thanh toán.
- Đơn hủy.
- Tồn kho thấp.
- Lịch sử lệch ca.

Service này cũng tính `dataQuality` để AI biết dữ liệu đủ hay thiếu.

### `backend/src/services/report.service.ts`

Đây là nơi gọi AI và xử lý kết quả.

Luồng chính:

1. Gọi `getAiInsightsContextService(startDate, endDate)`.
2. Lấy context từ `buildAiBusinessContext`.
3. Gửi context + `AI_REPORT_SYSTEM_PROMPT` lên AI API.
4. Parse JSON bằng `extractJsonFromAiText`.
5. Nếu AI thành công, lưu JSON vào bảng `ai_report_logs`.
6. Nếu AI lỗi, tạo fallback JSON và cũng lưu vào bảng `ai_report_logs`.
7. Trả response cho frontend.

### `backend/src/repositories/ai-report-log.repository.ts`

Repository chuyên lưu báo cáo AI vào database.

Hàm chính:

- `saveAiReportLog(input)`

Các bảng bị ảnh hưởng:

- `ai_report_logs`

### `backend/src/controllers/report.controller.ts`

Controller nhận request từ frontend.

Endpoint liên quan:

- `GET /api/reports/ai-insights`
- `GET /api/reports/ai-insights-context`

Controller kiểm tra quyền admin/manager, lấy khoảng ngày, gọi service và truyền `user.id` xuống để lưu `created_by`.

### `backend/src/prompts/report-ai.prompt.ts`

Đây là system prompt cố định cho AI.

Prompt hiện yêu cầu:

- Chỉ trả về một JSON object hợp lệ.
- Không markdown.
- Không bịa dữ liệu.
- Dùng `context.dataQuality`.
- Nếu confidence dưới 70%, phải ghi rõ nhận định chỉ mang tính tham khảo.
- Có schema cho:
  - `meta`
  - `summary`
  - `insights`
  - `possible_causes`
  - `action_plan`
  - `warnings`
  - `report_tables`
  - `chart_suggestions`

Trong `report_tables`, AI có thể trả bảng:

- `inventory_table`: bảng tồn kho cần chú ý.
- `sales_table`: bảng sản phẩm bán ra.
- `payment_table`: bảng phương thức thanh toán.

## File frontend

### `frontend/src/api/report.api.ts`

Đây là file gọi API báo cáo từ frontend.

Các hàm liên quan:

- Gọi báo cáo tài chính.
- Gọi context AI.
- Gọi AI insights.

Khi mở rộng hiển thị bảng AI, cần bổ sung type cho `report_tables`.
Hiện tại file này đã có type:

- `AiReportTable`
- `AiReportTables`
- `AiReportInsightData.report_tables`

### `frontend/src/pages/reports/ReportsPage.tsx`

Đây là giao diện menu Báo cáo.

Khu vực QuickServe-AI hiện đang render theo kiểu business report:

- Header báo cáo AI.
- Executive summary.
- Bảng chỉ số chính.
- Phân tích doanh thu.
- Phân tích vận hành.
- Nguyên nhân có thể.
- Kế hoạch hành động.
- Cảnh báo.
- Biểu đồ AI đề xuất.

Bước tiếp theo là render thêm `report_tables` từ JSON AI để hiển thị bảng dữ liệu đầy đủ hơn.

## Luồng dữ liệu hoàn chỉnh

```text
Frontend ReportsPage
  -> GET /api/reports/ai-insights?startDate=...&endDate=...
  -> report.controller.ts
  -> report.service.ts
  -> report-ai-context.service.ts
  -> report.repository.ts + dashboard.repository.ts
  -> AI API
  -> parse JSON
  -> ai-report-log.repository.ts
  -> ai_report_logs
  -> trả JSON về frontend
```

## Cần chạy SQL nào?

Chạy file này trước:

```sql
backend/src/database/migration-ai-report-logs.sql
```

Sau khi chạy, kiểm tra:

```sql
SELECT id, start_date, end_date, data_quality_score, confidence, is_fallback, created_at
FROM ai_report_logs
ORDER BY created_at DESC;
```

## Bước tiếp theo nên làm

1. Tạo component hiển thị bảng AI trong `ReportsPage.tsx`.
2. Cho phép xuất Excel từ các bảng AI nếu cần.
3. Tạo API xem lại lịch sử AI report từ bảng `ai_report_logs`.
4. Thêm kiểm tra JSON schema chặt hơn trước khi lưu database.
