# POS System Online Pickup

Hệ thống POS tích hợp đặt hàng online và nhận tại cửa hàng. Project gồm frontend React, backend Express và cơ sở dữ liệu MySQL.

## Chức năng chính

- Đăng nhập quản trị bằng JWT.
- Dashboard quản trị.
- Quản lý danh mục sản phẩm.
- Kết nối backend với MySQL.
- Bảo vệ route frontend bằng token.
- API backend theo mô hình route → controller → service → repository.
- Tài liệu/sơ đồ hệ thống trong thư mục `docs`.

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
- bcryptjs
- jsonwebtoken

## Cấu trúc thư mục

```text
pos-system/
├─ backend/                 # Backend Express API
│  ├─ src/
│  │  ├─ config/            # Cấu hình database
│  │  ├─ controllers/       # Controller xử lý request
│  │  ├─ middleware/        # Auth/error middleware
│  │  ├─ repositories/      # Truy vấn MySQL
│  │  ├─ routes/            # Khai báo API routes
│  │  ├─ services/          # Xử lý nghiệp vụ
│  │  ├─ types/             # TypeScript types
│  │  └─ database/          # Schema SQL
│  └─ package.json
│
├─ frontend/                # Frontend React
│  ├─ src/
│  │  ├─ api/               # API client
│  │  ├─ layouts/           # Layout dùng chung admin
│  │  ├─ pages/             # Các trang giao diện
│  │  └─ routes/            # Router và protected route
│  └─ package.json
│
├─ docs/                    # Tài liệu và sơ đồ
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

Vào thư mục backend:

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
CREATE DATABASE pos_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
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

Lưu ý: tài khoản test phải tồn tại trong database MySQL và `password_hash` phải là bcrypt hash của mật khẩu `123456`.

## API đã hoàn thành

### Auth

```text
POST /api/auth/login
GET  /api/auth/me
```

### Categories

```text
GET   /api/categories
POST  /api/categories
PUT   /api/categories/:id
PATCH /api/categories/:id/status
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

## Deploy frontend lên GitHub Pages

Frontend có thể deploy lên GitHub Pages, nhưng GitHub Pages chỉ chạy được giao diện tĩnh. Backend Express và MySQL không chạy trên GitHub Pages.

Build frontend:

```powershell
cd frontend
npm run build
```

Deploy thủ công bằng `gh-pages`:

```powershell
npm run deploy
```

Link GitHub Pages:

```text
https://sangtrantamly.github.io/pos-system-online/
```

Nếu muốn login thật trên web online, cần deploy backend riêng lên Render/Railway/VPS và dùng database online.

## Ghi chú quan trọng

- Không commit file `.env`.
- Không commit `node_modules`.
- Không commit thư mục `dist`.
- Frontend hiện gọi backend tại `http://localhost:5000/api`.
- Khi deploy online, cần đổi API base URL sang backend online.

## Trạng thái phát triển

Đã hoàn thành:

- Backend auth.
- Backend category CRUD.
- Frontend login.
- Frontend dashboard admin.
- Frontend category management.
- Layout admin dùng chung.

Đang/chưa hoàn thành:

- Product module.
- Stock module.
- Order/Pickup module.
- Customer module.
- Invoice/Payment module.
- Report module.
- Deploy backend online.
