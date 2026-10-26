# fe-sba-project — Giao diện quản lý phòng trọ (SBA301)

React 19 + Vite + TypeScript + Tailwind CSS v4 + shadcn/ui (Radix) + lucide-react + React Router 7.

Guest + Auth + User đã được triển khai trên `feature/fe-rebuild`, dùng Zustand cho phiên đăng nhập, TanStack Query cho dữ liệu máy chủ và MSW cho API mô phỏng. Chi tiết API và kết quả kiểm thử: [API contract](../docs/frontend/guest-user-api-contract.md), [Implementation status](../docs/frontend/guest-user-implementation-status.md).

Mặc định chạy ở chế độ `mock`. Tài khoản thử: `an@tropro.demo` / `TroPro@123`. Không chuyển tiền thật trong bản demo.

Sao chép `.env.example` sang `.env.local`, đổi `VITE_API_MODE=hybrid` để dùng auth/notification BE và các tính năng còn thiếu qua mock. `real` gửi mọi yêu cầu đến BE và hiển thị lỗi khi endpoint chưa tồn tại. Khởi động lại Vite sau khi đổi cấu hình. Backend mặc định tạo liên kết xác minh tới `http://localhost:5173`; đặt `FRONTEND_BASE_URL` nếu FE chạy ở địa chỉ khác.

Để chỉ dùng API thật cho đăng ký, đăng nhập và xác minh email trong khi giữ các chức năng khác ở mock, cấu hình `.env.local` như sau:

```dotenv
VITE_API_MODE=mock
VITE_AUTH_PROVIDER=real
```

Frontend gọi `/api/auth/*` qua Vite proxy tới `http://localhost:8080` mặc định. Backend cần có cấu hình database hợp lệ và SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`). `SMTP_FROM` mặc định dùng `SMTP_USERNAME`; nếu nhà cung cấp mail yêu cầu địa chỉ gửi khác, hãy đặt `SMTP_FROM` thành địa chỉ đã xác thực. Backend mặc định tạo liên kết xác minh tới `http://localhost:5173`; đặt `FRONTEND_BASE_URL` nếu FE chạy ở địa chỉ khác. Đăng ký sẽ thất bại nếu BE không gửi được email; khi đó kiểm tra lỗi trên trang và log BE. Khởi động lại Vite sau khi sửa `.env.local`.
Sao chép `.env.example` sang `.env.local` nếu cần cấu hình; giữ `VITE_API_MODE=real`. Vite chuyển `/api` tới `VITE_BACKEND_PROXY_TARGET` (mặc định `http://localhost:8080`). Khi deploy khác origin, đặt `VITE_API_BASE_URL` và cấu hình CORS/cookie ở BE theo origin thực tế. Khởi động lại Vite sau khi đổi cấu hình. Đặt `FRONTEND_BASE_URL=http://localhost:5173` ở BE để liên kết xác minh mở đúng FE.

## Chạy

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # kiểm tra type + build
npm run lint
npm run typecheck
npm test           # test nghiệp vụ và adapter API
npm run test:e2e   # desktop/mobile; dùng Edge cài trên máy
```

## Design system

Toàn bộ token nằm ở `src/index.css` (theo "Frontend Brief" mục 3):

- Một font **Be Vietnam Pro**, hai độ đậm (`font-normal`, `font-bold`).
- Cỡ chữ: `text-xs` 12, `text-sm` 14, `text-base` 16, `text-xl` 24. Riêng tiêu đề homepage dùng `text-display`.
- Màu: `primary`, `primary-soft`, `background`, `surface`, `foreground`, `muted-foreground`, `border`, `success`, `warning`, `danger`, `info`.
  Bảng màu mặc định của Tailwind đã bị tắt, nên class như `bg-red-500` sẽ không có tác dụng.
- Trạng thái luôn hiển thị bằng `<StatusBadge tone="success|warning|danger|info|neutral">`.

## Cấu trúc

```
src/
  components/ui/       # component shadcn/ui (button, select, input, label, skeleton)
  components/common/   # dùng chung: StatusBadge, EmptyState, ErrorState, Logo, Container
  layouts/             # PublicLayout (header + footer cho khách)
  features/home/       # homepage
  features/rooms/      # tìm phòng, chi tiết, chi nhánh, service, hook, RoomCard
  features/auth/       # auth và session Zustand
  features/leasing/    # lịch hẹn, giữ chỗ và thanh toán demo
  features/user/       # tổng quan, hồ sơ, thông báo
  interfaces/          # DTO/schema Zod dùng chung
  services/            # provider, HTTP client, API adapter và query cache
  mocks/               # MSW, fixtures và state machine nghiệp vụ
  pages/               # Owner entry, 404 và lỗi route
  lib/                 # cn(), formatVnd(), formatDate(), routes, site
  router.tsx
```

## Nối backend

Dữ liệu được lấy qua `src/services/guest-user.ts`. Provider theo feature được chọn trong `src/services/config.ts`; mock fixtures nằm trong `src/mocks/fixtures.ts`. Component không import trực tiếp mảng dữ liệu giả. Lỗi API thật không tự chuyển sang dữ liệu mock.

Xem thử trạng thái của danh sách phòng: thêm `?demo=loading`, `?demo=empty` hoặc `?demo=error` vào URL.

## Video hero (trang chủ)

- File nằm ở `src/assets/hero/`: `living-room-1080.mp4` (máy tính), `living-room-720.mp4` (điện thoại), `living-room-poster.webp` (ảnh chờ).
- Trang cuộn bình thường; nhịp cuộn đầu tiên làm video phát và lặp lại liên tục, tự dừng khi hero khuất màn hình. Logic ở `src/features/home/components/hero-video.tsx`.
- Đổi video: thay 3 file trên (giữ tên). Nên nén lại cho nhẹ:

```bash
ffmpeg -i input.mp4 -an -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -movflags +faststart living-room-1080.mp4
ffmpeg -i input.mp4 -an -vf "scale=-2:720,fps=30" -c:v libx264 -preset slow -crf 25 -pix_fmt yuv420p -movflags +faststart living-room-720.mp4
ffmpeg -i input.mp4 -frames:v 1 -vf scale=1280:-2 -c:v libwebp -quality 72 living-room-poster.webp
```

- Người dùng bật "giảm chuyển động" trong hệ điều hành sẽ thấy ảnh tĩnh thay cho video.

## Thêm component shadcn

`components.json` đã cấu hình sẵn: `npx shadcn@latest add dialog`.

## Không gian chủ trọ (O01–O20)

Với `VITE_API_MODE=mock`, đăng nhập `owner@tropro.demo` / `TroPro@123`, mở `/owner/dashboard`. Owner quản trị Branch, Manager, policy, QR, tài chính và phê duyệt; vận hành dùng lại các trang Manager với scope sở hữu. Guest/User/Tenant/Manager dùng cùng domain mock và được giữ nguyên.

Owner APIs chưa có đầy đủ trên Backend; provider real sẽ hiển thị lỗi nếu endpoint thiếu. Quyết định duyệt điều chỉnh không tự sửa hóa đơn đã phát hành. Không dùng giấy tờ hoặc giao dịch thật trong demo.

- [Hướng dẫn demo Owner](../docs/frontend/owner-demo-guide.md)
- [Hợp đồng API và phần BE còn thiếu](../docs/frontend/owner-api-contract.md)
- [Trạng thái O01–O20 và kiểm thử](../docs/frontend/owner-implementation-status.md)

## Không gian quản trị (A01–A13)

Với `VITE_API_MODE=mock`, đăng nhập `admin@tropro.demo` / `TroPro@123`, mở `/admin/dashboard`. Có quản lý/mời User, account lifecycle, xét duyệt Owner, roles/directory read-only và safe audit; dùng chung dữ liệu với các vai trò hiện có. A14 moderation hoãn Phase3.

`hybrid` dùng API User thật qua feature `adminUsers`; các domain Admin còn thiếu BE dùng mock nhưng chưa có trusted ADMIN bridge cho real identity. Full verification demo dùng fully mock. Preview tài liệu là ảnh mẫu vô danh, không phải giấy tờ đã upload. Disable account BE hiện chưa bảo đảm thu hồi JWT cũ; các giới hạn production được ghi rõ trong contract.

- [Hướng dẫn demo Admin và reset](../docs/frontend/admin-demo-guide.md)
- [Hợp đồng API Admin và bàn giao BE](../docs/frontend/admin-api-contract.md)
- [Trạng thái A01–A13, kiểm thử và Taste Skills thực sự dùng](../docs/frontend/admin-implementation-status.md)
