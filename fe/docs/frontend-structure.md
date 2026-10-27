# Cấu trúc frontend

Frontend của project nằm trong `fe/`. Mã nguồn được cập nhật từ `C:\Users\PC\Documents\sba\fe-sba-project`; thư mục nguồn được giữ nguyên.

```text
fe/
  index.html                  # HTML entry của React SPA
  public/                     # Tài nguyên công khai và MSW worker
  src/
    assets/                   # Tài nguyên được Vite xử lý
    components/common/        # Component dùng chung giữa các tính năng
    components/ui/            # Button, Input, Select và các UI cơ bản
    features/
      admin/                  # Quản trị hệ thống
      auth/                   # Đăng nhập, đăng ký, xác minh, khôi phục mật khẩu
      home/                   # Trang chủ
      leasing/                # Lịch hẹn, đặt phòng, thanh toán
      manager/                # Quản lý vận hành
      owner/                  # Chủ trọ, chi nhánh, quản lý phòng
      rooms/                  # Tìm kiếm và chi tiết phòng
      tenant/                 # Người thuê
      user/                   # Tài khoản và thông báo
    hooks/                    # Hook dùng chung
    interfaces/               # Kiểu dữ liệu và schema
    layouts/                  # Bố cục theo vai trò
    lib/                      # Hàm tiện ích
    mocks/                    # Dữ liệu và API mô phỏng
    pages/                    # Trang lỗi, preview và trang cấp ứng dụng
    services/                 # Kết nối API
    index.css                 # CSS dùng chung, theme, typography, biểu đồ
    main.tsx                  # Khởi tạo React và import index.css
    router.tsx                # Ánh xạ URL tới từng view
  tests/e2e/                  # Kiểm tra trình duyệt
  docs/view-migration.json    # Bảng đối chiếu tên view và file mới
  legacy/                    # Mã cũ của project, không được router sử dụng
```

## Tìm và sửa từng view

Mỗi view đã tách có file `kebab-case-page.tsx`, ví dụ `features/auth/login-page.tsx`, `features/admin/admin-dashboard-page.tsx` và `features/owner/owner-property-detail-page.tsx`. Các view tạo/sửa sử dụng cùng editor khi có cùng giao diện và chỉ khác tham số URL.

Các file `*-shared.tsx` chứa giao diện dùng chung trong nhóm tính năng. Hook truy vấn chi nhánh nằm ở `features/owner/hooks/use-property.ts`. Các file `*-pages.tsx` cũ chỉ re-export để giữ tương thích cho import hiện có; sửa giao diện trong file view riêng. Router tải trực tiếp từng file view.

## HTML và CSS

Project dùng React SPA: `index.html` là HTML entry; markup từng trang nằm trong JSX/TSX để giữ state, form, router và xử lý sự kiện. Không tạo một HTML độc lập cho mỗi URL.

CSS tùy chỉnh được đặt riêng ở `src/index.css` và import một lần trong `main.tsx`. Các class tiện ích Tailwind vẫn nằm trong `className`; Tailwind sinh CSS qua `@import 'tailwindcss'` trong `index.css`.

Quy tắc kích thước biểu đồ nằm trong `.chart-bar--horizontal` và `.chart-bar--vertical` ở `index.css`. Component `ChartBar` chỉ truyền giá trị động qua biến CSS `--chart-value`; không nhúng các quy tắc trình bày vào từng view.

## Chạy tại máy

```sh
cd fe
npm ci
# Tạo .env từ .env.example nếu chưa có.
npm run dev
```

`.env.example` dùng mock để xem giao diện không cần backend. Đặt `VITE_API_MODE=real` và cấu hình API khi tích hợp backend thật. Không đưa `.env`, `node_modules`, `dist` hay kết quả test vào Git.

```sh
npm run build
npm run lint
npm test
npx playwright test tests/e2e/mock-preview.spec.ts --workers=2
```
