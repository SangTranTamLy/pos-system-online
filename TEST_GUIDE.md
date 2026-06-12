# 📋 Hướng Dẫn Test Hệ Thống POS - Tích Điểm, Khuyến Mãi, Thanh Toán

## ✅ Các Tính Năng Đã Triển Khai

### Backend API
- ✅ Xác thực mã khuyến mãi
- ✅ Tìm kiếm khách hàng
- ✅ Tính toán tích điểm (1 điểm/10,000 VND)
- ✅ Sử dụng điểm giảm giá (1 điểm = 100 VND)
- ✅ Cập nhật khách hàng tự động
- ✅ Ghi nhận lịch sử điểm

### Frontend UI
- ✅ Chọn khách hàng (search)
- ✅ Hiển thị điểm tích lũy
- ✅ Nhập mã khuyến mãi
- ✅ Sử dụng điểm để giảm giá
- ✅ Tính tiền thừa (auto-fill)
- ✅ Fix lỗi controlled input

---

## 🧪 Cách Test

### 1. Đăng Nhập
- Truy cập: http://localhost:5173
- Dùng tài khoản demo

### 2. Vào Trang Bán Hàng (POS)
- Menu → Bán hàng tại quầy

### 3. Scenario Test

#### **Test 1: Bán Hàng Không Khách Hàng**
1. Chọn sản phẩm → thêm vào giỏ
2. Giữ nguyên "Khách lẻ"
3. Chọn phương thức thanh toán
4. Click "Thanh toán"
✓ Kỳ vọng: Tạo đơn thành công, không cập nhật điểm

#### **Test 2: Chọn Khách Hàng**
1. Click vào field "Khách hàng"
2. Gõ tên/SĐT khách (ví dụ: "Nguyễn" hoặc "090...")
3. Chọn từ danh sách → hiển thị điểm tích lũy
✓ Kỳ vọng: Danh sách khách hàng xuất hiện, show điểm

#### **Test 3: Tích Điểm**
1. Chọn khách hàng
2. Thêm sản phẩm: 100,000 VND
3. Không dùng khuyến mãi, không dùng điểm
4. Bán hàng
✓ Kỳ vọng: Tích 10 điểm (100,000 ÷ 10,000 = 10 điểm)

#### **Test 4: Dùng Điểm Giảm Giá**
1. Chọn khách hàng (phải có ≥ 5 điểm)
2. Thêm sản phẩm: 50,000 VND
3. Input "Sử dụng điểm": 5 điểm
4. Tổng cộng sẽ giảm 500 VND (5 × 100)
5. Click "Thanh toán"
✓ Kỳ vọng: Dùng được điểm, tính toán đúng

#### **Test 5: Mã Khuyến Mãi (nếu có)**
1. Thêm sản phẩm: 100,000 VND
2. Click "Áp dụng" mã khuyến mãi
3. Xem giảm giá được tính
✓ Kỳ vọng: Nếu mã hợp lệ → hiện thông báo, giảm giá được tính

#### **Test 6: Tiền Thừa (Cash)**
1. Chọn "Tiền mặt" thanh toán
2. Thêm sản phẩm: 96,000 VND
3. Field "Tiền khách đưa" tự điền 96,000
4. Thay đổi thành 100,000
5. Xem "Tiền thừa: 4,000 VND"
✓ Kỳ vọng: Auto-fill finalAmount, tính tiền thừa chính xác

#### **Test 7: Kết Hợp (Full Flow)**
1. Chọn khách hàng có 50+ điểm
2. Thêm sản phẩm: 200,000 VND
3. Áp dụng khuyến mãi (-10%) → giảm 20,000
4. Dùng 20 điểm → giảm 2,000
5. Tổng cộng: 200,000 - 20,000 - 2,000 = **178,000**
6. Tiền mặt: 180,000 → Tiền thừa: 2,000
✓ Kỳ vọng: Tất cả tính toán đúng

---

## 📊 Kiểm Tra Dữ Liệu

### Khách hàng (Cần có trong DB)
```sql
SELECT id, full_name, phone, loyalty_points 
FROM customers LIMIT 5;
```

### Mã khuyến mãi (Optional - nếu muốn test)
```sql
SELECT code, name, discount_type, discount_value, is_active 
FROM promotions 
WHERE is_active = 1 
  AND (start_at IS NULL OR start_at <= NOW())
  AND (end_at IS NULL OR end_at > NOW())
LIMIT 5;
```

### Kiểm tra đơn hàng vừa tạo
```sql
SELECT id, customer_id, total_amount, discount_amount, 
       final_amount, points_earned, points_used 
FROM orders 
ORDER BY created_at DESC LIMIT 5;
```

---

## 🐛 Nếu Gặp Lỗi

### Lỗi: "Không tìm thấy khách hàng"
→ Khách hàng ID không tồn tại trong DB

### Lỗi: "Mã khuyến mãi không hợp lệ"
→ Mã không tồn tại hoặc đã hết hạn

### Lỗi: "Điểm sử dụng không thể vượt quá tổng tiền"
→ Giá trị điểm > tổng tiền → kiểm tra logic tính toán

### Lỗi Controlled Input (React Warning)
✓ Đã sửa! Input "Tiền khách đưa" giờ hoạt động bình thường

---

## 📝 Ghi Chú

- **Tỷ giá điểm**: 1 điểm/10,000 VND = 1 điểm (1 điểm = 100 VND khi dùng)
- **Thanh toán**: Cash/QR/Thẻ (tất cả record transaction)
- **Khách lẻ**: Không tích điểm, không dùng được
- **Tiền thừa**: Chỉ show khi chọn "Tiền mặt"

---

Hãy test các scenario trên và cho tôi biết kết quả! 🎯
