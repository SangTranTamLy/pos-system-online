# QuickServe AI Report - Kiểm tra nguồn nội dung

File này giải thích rõ nội dung nào do AI sinh, nội dung nào do backend hệ thống tạo từ SQL/fallback.

## Kết luận ngắn

- **AI có phân tích thật** khi API Gemini gọi thành công và response trả `fallback: false`.
- **Hệ thống dùng báo cáo dự phòng** khi thiếu API key, API lỗi, Gemini trả JSON lỗi, hoặc request bị giới hạn. Khi đó response trả `fallback: true`.
- **Bảng và biểu đồ không do AI tự bịa số liệu.** Backend khóa `report_tables` và `chart_suggestions` theo dữ liệu SQL/fallback.
- **AI chỉ được ghi phần chữ**: tóm tắt, phân tích chuyên sâu, chiến lược hành động. Cảnh báo bị lọc theo warning signals từ backend.

## File chính cần kiểm tra

### 1. Backend service xử lý AI

File:

`backend/src/services/report.service.ts`

Các đoạn quan trọng:

- `getAiReportInsightsService(...)`
  - Tạo context từ dữ liệu hệ thống.
  - Gọi Gemini.
  - Nếu thành công: trả `success: true`, `fallback: false`.
  - Nếu lỗi: trả `success: false`, `fallback: true`.

- `buildSmartFallbackAiData(context)`
  - Tạo báo cáo dự phòng từ dữ liệu SQL khi AI không khả dụng.
  - Đây là phần “hệ thống”, không phải AI.

- `normalizeAiReportData(rawData, context)`
  - Trộn kết quả AI với dữ liệu hệ thống.
  - Quan trọng: luôn khóa các phần sau theo backend:
    - `report_tables`
    - `chart_suggestions`

- `normalizeWarnings(...)`
  - Cảnh báo AI chỉ được giữ lại nếu type cảnh báo đã tồn tại trong warning signals backend.
  - Tránh AI tự tạo cảnh báo không có dữ liệu.

### 2. Context dữ liệu AI

File:

`backend/src/services/report-ai-context.service.ts`

Đây là nơi backend gom dữ liệu thật từ hệ thống:

- Doanh thu
- Đơn hàng
- Doanh thu kỳ trước
- Sản phẩm bán ra
- Sản phẩm bán chậm
- Thanh toán
- Đơn hủy
- Tồn kho thấp
- Doanh thu theo danh mục
- Độ đầy đủ dữ liệu `dataQuality.coverageScore`

Nếu AI phân tích đúng, nội dung AI phải dựa trên context này.

### 3. SQL lấy dữ liệu báo cáo

File:

`backend/src/repositories/report.repository.ts`

Các hàm quan trọng:

- `getFinancialSummary`
- `getFinancialTrend`
- `getAiSoldProducts`
- `getAiCategoryRevenue`
- `getAiPaymentSummary`
- `getAiCancelledOrders`

Đây là nguồn dữ liệu thật từ database.

### 4. Prompt điều khiển AI

File:

`backend/src/prompts/report-ai.prompt.ts`

Prompt đang bắt buộc:

- AI chỉ phân tích từ JSON context backend gửi.
- Không bịa số liệu.
- Không tự tạo bảng, biểu đồ, labels, datasets.
- Không tạo `report_tables`, `chart_suggestions`.
- Không kết luận tăng/giảm nếu thiếu dữ liệu kỳ trước.
- Phân tích chuyên sâu phải đúng 5 mục.
- Chiến lược hành động phải đúng 5 mục.
- Cảnh báo tối đa 5 mục và phải dựa vào `warningSignals`.

### 5. Frontend hiển thị báo cáo AI

File:

`frontend/src/pages/reports/ReportsPage.tsx`

Các đoạn quan trọng:

- `isAiFallbackReport(response)`
  - Kiểm tra báo cáo hiện tại là AI thật hay fallback.

- `AiPaperReportHeader`
  - Hiển thị trạng thái fallback hoặc AI.

- `AiPaperDataTablesSection`
  - Hiển thị 4 biểu đồ.
  - Nếu AI không khả dụng thì dùng biểu đồ từ bảng SQL dự phòng.

- `AiPaperDeepAnalysisSection`
  - Hiển thị 5 phân tích chuyên sâu.

- `AiPaperWarningSection`
  - Hiển thị cảnh báo.

## Nội dung nào là AI?

Khi `fallback: false`, các phần sau có thể là AI viết:

- `summary.main_insight`
- `summary.revenue_text`
- `summary.orders_text`
- `summary.best_selling_product`
- `summary.best_shift`
- `phan_tich_chuyen_sau`
- `action_plan`

Nhưng các phần này vẫn bị backend chuẩn hóa theo cấu trúc cố định.

## Nội dung nào là hệ thống?

Các phần sau là hệ thống/SQL, không phải AI tự bịa:

- `context`
- `dataQuality.coverageScore`
- `meta.period`
- `meta.score`
- `meta.confidence`
- `report_tables`
- `chart_suggestions`
- Biểu đồ doanh thu theo ngày
- Biểu đồ doanh thu theo danh mục
- Biểu đồ top sản phẩm theo doanh thu
- Biểu đồ phương thức thanh toán
- Warning signals dùng để quyết định cảnh báo

## Cách nhận biết nhanh trên Network

Mở DevTools -> Network -> gọi:

`GET /api/reports/ai-insights?...`

Nếu response có:

```json
{
  "success": true,
  "fallback": false
}
```

thì AI đã chạy thành công.

Nếu response có:

```json
{
  "success": false,
  "fallback": true
}
```

thì nội dung đang là báo cáo dự phòng từ hệ thống.

## Ghi chú quan trọng

Hiện tại thiết kế đúng hướng an toàn:

- AI không được tự sinh số liệu biểu đồ/bảng.
- Backend tạo số liệu từ SQL.
- AI chỉ diễn giải bằng ngôn ngữ quản lý quầy.
- Nếu AI lỗi, hệ thống vẫn có fallback để không làm trang báo cáo trống.
