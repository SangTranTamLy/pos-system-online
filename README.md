# POS QUẢN LÝ ĐỒ ĂN SÁNG VÀ NƯỚC UỐNG TẠI CỬA HÀNG

Đề tài: **Xây dựng hệ thống POS quản lý bán hàng đồ ăn sáng và nước uống tại cửa hàng**.

Project gồm frontend React, backend Express TypeScript và cơ sở dữ liệu MySQL. Hệ thống tập trung vào nghiệp vụ bán hàng trực tiếp tại cửa hàng: quản lý danh mục, sản phẩm, hóa đơn, thanh toán, tồn kho, khách hàng thân thiết và khuyến mãi.

## Phạm vi đề tài

### Giữ trong hệ thống

- Đăng nhập quản trị viên/nhân viên.
- Dashboard quản trị.
- Quản lý danh mục món ăn/nước uống.
- Quản lý sản phẩm.
- Quản lý bán hàng tại quầy.
- Quản lý hóa đơn và thanh toán.
- Quản lý tồn kho.
- Quản lý khách hàng thân thiết và tích điểm.
- Quản lý khuyến mãi.
- Ghi lịch sử thao tác quản trị.

### Bỏ khỏi phạm vi hiện tại

Đề tài mới không còn tập trung vào đặt hàng online và nhận hàng pickup, nên các phần sau không sử dụng trong phạm vi chính:

- Lịch nhận hàng pickup.
- Mã nhận hàng pickup.
- Giỏ hàng online.
- Thông báo khách hàng online.
- Luồng đặt hàng online.
- Luồng theo dõi đơn online.
- Luồng xử lý đơn pickup.

## Công nghệ sử dụng

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router

### Backend

- Node.js
- Express
- TypeScript
- MySQL
- mysql2/promise
- bcryptjs
- jsonwebtoken

## Cấu trúc thư mục

```text
pos-system/
├─ backend/                 # Backend Express API
│  ├─ src/
│  │  ├─ config/            # Cấu hình database
│  │  ├─ controllers/       # Controller xử lý request
│  │  ├─ database/          # Schema SQL
│  │  ├─ middleware/        # Auth/error middleware
│  │  ├─ repositories/      # Truy vấn MySQL
│  │  ├─ routes/            # Khai báo API routes
│  │  ├─ services/          # Xử lý nghiệp vụ
│  │  ├─ types/             # TypeScript types
│  │  └─ utils/             # Helper dùng chung
│  └─ package.json
│
├─ frontend/                # Frontend React
│  ├─ src/
│  │  ├─ api/               # API client
│  │  ├─ layouts/           # Layout admin dùng chung
│  │  ├─ pages/             # Các trang giao diện
│  │  └─ routes/            # Router và protected route
│  └─ package.json
│
├─ .gitignore
└─ README.md
```

## Yêu cầu môi trường

- Node.js 20+
- npm
- MySQL Server
- MySQL Workbench hoặc công cụ quản lý database tương đương

## Cài đặt và chạy local

### 1. Clone project

```powershell
git clone https://github.com/SangTranTamLy/pos-system-online.git
cd pos-system-online
```

### 2. Cấu hình backend

```powershell
cd backend
npm install
```

Tạo file `backend/.env`:

```env
PORT=5000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=pos_system

JWT_SECRET=your_jwt_secret
```

Tạo database MySQL:

```sql
CREATE DATABASE IF NOT EXISTS pos_system
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
```

Sau đó chạy schema trong:

```text
backend/src/database/schema.sql
```

Chạy backend:

```powershell
npm run dev
```

Backend chạy tại:

```text
http://localhost:5000
```

### 3. Cấu hình frontend

Mở terminal khác:

```powershell
cd frontend
npm install
npm run dev
```

Frontend chạy tại:

```text
http://localhost:5173
```

## Tài khoản test

```text
Email: admin@example.com
Password: 123456
```

Lưu ý: tài khoản test phải tồn tại trong MySQL và `password_hash` phải là bcrypt hash của mật khẩu `123456`.

## API đã hoàn thành

### Auth

```text
POST /api/auth/login
GET  /api/auth/me
```

### Categories

```text
GET    /api/categories
POST   /api/categories
POST   /api/categories/upload-image
PUT    /api/categories/:id
PATCH  /api/categories/:id/status
DELETE /api/categories/:id
```

## API dự kiến làm tiếp

### Products

```text
GET    /api/products
POST   /api/products
PUT    /api/products/:id
PATCH  /api/products/:id/status
DELETE /api/products/:id
```

### Orders / POS

```text
POST /api/orders
GET  /api/orders
GET  /api/orders/:id
```

### Payments

```text
POST /api/payments
```

### Customers

```text
GET   /api/customers
POST  /api/customers
PUT   /api/customers/:id
PATCH /api/customers/:id/points
```

## Kiểm tra API bằng PowerShell

Đăng nhập:

```powershell
$response = Invoke-RestMethod `
  -Uri "http://localhost:5000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"admin@example.com","password":"123456"}'

$response | ConvertTo-Json -Depth 5
```

Lấy thông tin user:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:5000/api/auth/me" `
  -Method GET `
  -Headers @{ Authorization = "Bearer $($response.data.token)" } |
ConvertTo-Json -Depth 5
```

Lấy danh mục:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:5000/api/categories" `
  -Method GET `
  -Headers @{ Authorization = "Bearer $($response.data.token)" } |
ConvertTo-Json -Depth 5
```

## Luồng hoạt động chính

### Đăng nhập

1. Người dùng nhập email và mật khẩu.
2. Frontend gọi `POST /api/auth/login`.
3. Backend lấy user từ MySQL.
4. Backend dùng `bcrypt.compare()` kiểm tra mật khẩu.
5. Nếu hợp lệ, backend tạo JWT bằng `jwt.sign()`.
6. Frontend lưu token vào `localStorage`.
7. Người dùng được chuyển vào dashboard.

### Quản lý danh mục

1. Frontend gọi `GET /api/categories`.
2. Backend truy vấn bảng `categories`.
3. Frontend hiển thị danh sách danh mục.
4. Khi thêm/sửa/ẩn/xóa, frontend gọi API tương ứng.
5. Backend xử lý qua controller, service, repository rồi cập nhật MySQL.

## Trạng thái phát triển

### Đã hoàn thành

- Kết nối backend Express TypeScript với MySQL.
- Đăng nhập bằng JWT và bcrypt.
- Middleware xác thực token.
- Frontend login.
- Frontend dashboard admin.
- Layout admin dùng chung.
- API quản lý danh mục.
- Giao diện quản lý danh mục.
- Thêm/sửa/ẩn/xóa danh mục.
- Upload ảnh danh mục từ file trên máy.

### Đang/chưa hoàn thành

- Product module.
- POS bán hàng tại quầy.
- Order/Invoice module.
- Payment module.
- Customer loyalty/tích điểm.
- Promotion module.
- Stock module.
- Report module.
- Audit log module.

## Ghi chú quan trọng

- Không commit file `.env`.
- Không commit `node_modules`.
- Không commit thư mục `dist`.
- Không commit thư mục upload runtime nếu không cần thiết.
- Frontend hiện gọi backend local tại `http://localhost:5000/api`.
- GitHub Pages chỉ chạy frontend tĩnh, không chạy được backend Express và MySQL.
