# Kế hoạch Phase 1: bỏ RoomMode và tái cấu trúc đặt phòng

## Phạm vi khảo sát và giới hạn

- Khảo sát read-only: source backend `be/src/main/java`, cấu hình/tài liệu backend, source frontend `fe/src`, và `.codegraph/codegraph.db` qua CodeGraph. Frontend không nằm trong index CodeGraph; các kết luận frontend dựa trên source và tìm kiếm toàn repo.
- CodeGraph báo 423 file được index (420 Java, 1 YAML, 1 XML và 1 properties). Các symbol Room, Booking, Contract, Payment và Tenant tìm thấy trong source tương ứng. Không thấy `Gemini.md`, `agent.md`, `AGENTS.md` hoặc thư mục `skills/` ở repo; `fe/node_modules/**/skills` là dependency, không phải skill của dự án. Không có skill dự án nào để đọc.
- Skill phù hợp từ catalog Codex: `planning-and-task-breakdown` — chia thay đổi nhiều module thành lát cắt có acceptance criteria; `api-and-interface-design` — request/response và endpoint thay đổi; `incremental-implementation` — Phase 2 cần commit nhỏ từng bước. `frontend-ui-engineering` — áp dụng khi sửa màn chọn nhiều slot/dịch vụ và trang hợp đồng. Không chọn skill PDF/docs, CI/CD, spreadsheet, hay code review vì Phase 1 không tạo PDF, không đổi pipeline/tài liệu sản phẩm, và chưa có code để review.
- Nhánh đề xuất cho Phase 2: `codex/remove-roommode-booking-contract-flow`. Nhánh hiện tại là `feature/reconstruct-room-booking-flow`; workspace có các file chưa theo dõi `be/.cursor/` và `docs/planning/` trước công việc này. Giữ nguyên chúng; chỉ tạo tài liệu kế hoạch này trong Phase 1.
- Chưa chạy build/test, không sửa code/test, không truy cập hoặc ghi DB. Không đọc `.env`.

## 1. Tất cả vị trí dùng RoomMode / roomMode và hướng xử lý

Kết quả tìm kiếm toàn repo (bỏ `node_modules`, `dist`, `target`, `.git`, file ảnh) không cho thấy seed data nào chứa `RoomMode`/`roomMode`. Backend Seeder có `CalculationType.PER_SLOT`, đây là kiểu tính phí dịch vụ, không phải `RoomMode` và cần giữ. Có một tham chiếu trong tài liệu kế hoạch cũ; không sửa tài liệu cũ trong Phase 1.

| Vị trí hiện tại | Dùng hiện tại | Kế hoạch sau khi duyệt |
|---|---|---|
| `be/src/main/java/com/kitolam/rentalroommanagement/modules/room/enums/RoomMode.java` | Enum `WHOLE_ROOM`/`PER_SLOT` | Xóa enum sau khi sửa toàn bộ consumer; thao tác này cần xác nhận riêng theo ràng buộc. |
| `.../room/document/Room.java` (`roomMode`, import/Javadoc, `maxOccupants`) | Field của Mongo document `rooms`; `maxOccupants` từng được dùng làm capacity hoặc tổng slot | Bỏ `roomMode` và `maxOccupants` khỏi code/DTO; inventory `RoomSlot` là nguồn số slot. Người dùng tự drop `roomMode` trong Compass; không yêu cầu drop field khác trong DB. |
| `.../room/dto/request/RoomCreateRequest.java`, `RoomUpdateRequest.java`, `RoomFilterRequest.java`; `.../room/dto/response/RoomResponse.java` | Nhận/lọc/trả enum | Gỡ field/import/validation tương ứng; giữ `listedDepositAmount`. |
| `.../room/mapper/RoomMapper.java`, `.../room/controller/RoomController.java`, `.../room/service/RoomService.java`, `.../room/service/impl/RoomServiceImpl.java` | Map DTO và CRUD Room qua create/update/filter/response có `roomMode`; Mongo filter theo field | Xóa field qua DTO/mapper/service filter; giữ CRUD còn lại. |
| `.../room/controller/PublicRoomController.java`, `.../room/service/PublicRoomService.java` | Query `roomMode`, parse enum, lọc document theo `roomMode`; `maxCapacity/minCapacity` dùng `Room.maxOccupants`; response lấy total slot count từ `maxOccupants` | Bỏ filter loại thuê; dùng inventory `RoomSlot` cho số slot/capacity; bỏ minCapacity filter nếu không thể tính từ inventory hiện có trong query. |
| `.../booking/service/impl/BookingServiceImpl.java` | `refreshRoomStatus` phân nhánh trạng thái phòng theo `RoomMode` và occupancy | Tính `OCCUPIED` từ toàn bộ slot đều có occupancy `ACTIVE` (mô hình per-slot duy nhất); xác nhận quy tắc trạng thái phòng trước khi đổi. |
| `.../contract/service/impl/ContractServiceImpl.java` | Max người, lưu mode vào contract, phân nhánh xử lý theo mode và map response | Bỏ nhánh mode; thay bằng nhiều `roomSlotIds` trong hợp đồng/booking và occupancy. Thay thế logic max người theo quyết định mở. |
| `.../contract/document/Contract.java`, `.../contract/dto/response/ContractResponse.java` | Persist/trả string `roomMode` | Bỏ field/response; các document contract cũ có thể vẫn chứa field, nhưng không migration/xóa dữ liệu. |
| `be/README.md:116` | Mô tả `GET /api/v1/public/services?roomMode=ROOM|SLOT` | Cập nhật tên query param sau khi thống nhất `serviceScope`/`scope`. |
| `.../serviceitem/controller/PublicServiceItemController.java` | Tham số Java tên `roomMode`, nhưng kiểu và ngữ nghĩa là `ServiceScope` (`ROOM`/`SLOT`), không phải enum `RoomMode` | Đổi tên biến và query parameter FE/doc sang `serviceScope` (hoặc `scope`) để đáp ứng yêu cầu grep sạch; đây là API query contract cần kiểm tra consumer/compatibility. |
| `fe/src/interfaces/tenant.ts` | Contract response schema có `roomMode` | Bỏ property sau khi backend response đổi. |
| `fe/src/services/manager.ts` | Parse `roomMode`, map thành `rentalMode` | Bỏ adapter map hoặc thay bằng dữ liệu slot/room; chỉnh schema contract cùng response. |
| `fe/src/features/manager/manager-room-editor-page.tsx`, `fe/src/interfaces/manager.ts`, `fe/src/interfaces/domain.ts`, `fe/src/lib/validation.ts`, `fe/src/services/manager.ts` | Dùng abstraction phía FE `rentalMode: ROOM/SLOT`, request/response room create/update | Bỏ lựa chọn loại thuê ở form/editor; đồng bộ FE contract với API Room chỉ vận hành slot. Xác minh adapter FE/API Room hiện gửi/nhận đúng field trước khi sửa. |
| `fe/src/services/guest-user.ts:192-193` | Bộ lọc phòng gửi `roomMode=WHOLE_ROOM/PER_SLOT` | Bỏ bộ lọc thuê nguyên phòng/slot hoặc dùng filter khác có căn cứ inventory; không gửi query đã bỏ. |
| `fe/src/services/guest-user.ts:250` | Lấy danh mục dịch vụ bằng query `roomMode: room.rentalMode` | Đổi sang tên query `serviceScope`/`scope` đồng bộ backend. |
| `fe/src/services/guest-user.ts:367` | Schema response hợp đồng có `roomMode` | Gỡ schema field, cập nhật adapter. |
| `fe/src/features/tenant/contract-detail-page.tsx:70-72` | Hiển thị loại thuê dựa trên mode trong contract | Hiển thị theo danh sách slot hoặc bỏ dòng loại thuê. |
| `fe/src/mocks/handlers.ts:292`, `fe/src/mocks/database.test.ts:179` | Mock parse query cũ; một test assertion về lọc `WHOLE_ROOM` | Gỡ/đổi mock và assertion khi cập nhật mock contract. Không tạo test mới; nếu thay enum làm test hiện tại không compile, dừng hỏi theo constraint. |
| `docs/planning/booking-roomslot-refactor.md:149` | Tài liệu cũ còn nêu `WHOLE_ROOM`/`PER_SLOT` | Chỉ sửa sau khi bạn duyệt danh sách dọn tài liệu/code cũ; file hiện đang untracked, cần giữ nguyên ngoài kế hoạch. |

Tài liệu `docs/diagrams/SBA301 DIagram.drawio` có sơ đồ booking cũ với manager review/deadline do manager chọn, nhưng tìm kiếm không thấy literal `RoomMode`/`roomMode`. Cập nhật sơ đồ nghiệp vụ có thể cân nhắc sau khi bạn duyệt dọn luồng cũ.

## 2. Luồng đặt phòng hiện tại

### Backend và trạng thái

| Thành phần | Hiện trạng đọc được từ source |
|---|---|
| `Room` / `rooms` | `Room.listedDepositAmount` là `BigDecimal` trong `modules/room/document/Room.java`; không thấy field tương tự trong `RoomSlot`. Theo xác nhận của bạn, tiền cọc lấy từ phòng cha và cộng một lần cho mỗi slot được chọn. |
| `Booking` / `bookings` | `modules/booking/document/Booking.java` hiện chỉ có một `roomSlotId`, một `contractId`, ngày thuê, `holdingDepositAmount`, `paymentDeadline`, `holdExpiresAt`, `checkInDeadline`, điều khoản, `depositStatus`, `termsAcceptedAt`, timeline. |
| Giữ chỗ | `BookingServiceImpl.create` (`POST /api/v1/bookings`, TENANT) kiểm tra trùng, tạo `REQUESTED`, `UNPAID`, rồi lưu occupancy `RESERVED` cho một slot. `claimSlot` dùng optimistic locking; các hàm được gắn `@Transactional`. |
| Duyệt và điều khoản | `POST /api/v1/bookings/{id}/review` (OWNER/MANAGER/ADMIN) từ chối hoặc chuyển `REQUESTED → AWAITING_PAYMENT`; manager tự nhập cọc, payment deadline, hold expiry, check-in deadline và cancellation policy. `POST /api/v1/bookings/{id}/terms` để tenant chấp nhận/từ chối điều khoản trước khi trả. |
| Thanh toán | `POST /api/v1/bookings/{id}/payments` tạo VNPay hoặc bank transfer; booking chỉ cho trả khi đang `AWAITING_PAYMENT` và tenant đã chấp nhận terms. Bank transfer chờ manager reconcile ở `POST /{id}/payments/{paymentId}/reconcile`. `VnPayServiceImpl` gọi `processPaymentResult`. |
| Hết hạn/race hiện tại | `BookingServiceImpl.expireBookingsOnSchedule` chạy mỗi 30 giây; `expireOverdueBookings` hủy booking `AWAITING_PAYMENT` quá `paymentDeadline` hoặc `holdExpiresAt` và kết thúc reservation. Các request quan trọng cũng gọi kiểm tra hết hạn đồng bộ. `processPaymentResult` kiểm tra thời điểm hiện tại, nhưng xử lý trả tiền đến muộn có nhánh có thể xác nhận lại nếu slot còn trống; khác quyết định mới là luôn auto-cancel sau hạn. Bạn xác nhận MongoDB Atlas chạy Replica Set 3 node; cần dùng transaction đa document và state transition có điều kiện để xử lý race. |
| Booking status | `BookingStatus`: `REQUESTED`, `AWAITING_PAYMENT`, `CONFIRMED`, `CONVERTED`, `EXPIRED`, `CANCELLED`, `REJECTED`, `PENDING`, `APPROVED`. Payment status là enum riêng. |
| Contract | Sau khi đã `CONFIRMED` và `PAID`, manager gọi `POST /api/v1/contracts/from-booking/{bookingId}` với thông tin draft; status mặc định `ContractStatus.DRAFT`. Manager/admin còn có `POST /api/v1/contracts`, `PATCH /{id}`, `POST /{id}/check-in`; check-in lưu `signedFileUrl`, tạo `ContractTenant` và đổi occupancy từ `RESERVED` sang `ACTIVE`. Không thấy download URL placeholder hoặc luồng tenant nộp link bằng chứng/manager duyệt bằng chứng. |
| Dịch vụ | Trang chi tiết phòng đã hiển thị picker dịch vụ và estimate (`room-detail-page.tsx`, `room-service-picker`), nhưng booking hiện không gửi selection vào `BookingCreateRequest`. Contract có `services` snapshots và endpoint `PATCH /api/v1/contracts/{id}/services`, song hiện là tenant chọn dịch vụ tùy chọn sau khi manager tạo draft. |
| Lịch giữ slot | `BookingServiceImpl.currentRoomHold` cung cấp trạng thái hold cho lịch xem; booking/occupancy đang vận hành theo một slot mỗi booking. |

### API hiện có

- Booking: `GET /api/v1/bookings/availability` và `/availability/batch` nhận `roomSlotId(s)`, `startDate`, `endDate`; `POST /api/v1/bookings`; `GET /api/v1/bookings[/{id}]`; `POST /{id}/review`, `/{id}/terms`, `/{id}/cancel`, `/{id}/payments`, `/{id}/payments/{paymentId}/reconcile`, `/{id}/refund/approve`.
- Contract: `POST /api/v1/contracts`, `POST /from-booking/{bookingId}`, `PATCH /{id}/services`, `POST /{id}/check-in`, `GET /{id}`, `GET /`, `PATCH /{id}`.
- Room slots / occupancy có CRUD controllers riêng; booking service tự tạo và kết thúc reservation.

### Frontend

- `fe/src/features/rooms/room-detail-page.tsx` có picker nhưng chỉ một `slot`, có date range và service selection chỉ phục vụ ước tính. Link giữ chỗ sang `/rooms/{roomId}/bookings/new`.
- `fe/src/features/leasing/create-shared.tsx` chọn một slot và ngày bắt đầu/kết thúc; sau đó hiển thị lời nhắn “Owner/Manager sẽ duyệt...” và tạo booking.
- `fe/src/features/leasing/booking-detail-page.tsx`, `manager-booking-detail-page.tsx` hiện có form manager review/điều khoản rồi tenant xác nhận terms. `payment-page.tsx` xử lý tiền và deadline.
- `fe/src/features/tenant/contracts-page.tsx` và `contract-detail-page.tsx` hiển thị contract; hiện chỉ có link file đã ký sau manager check-in, chưa có thao tác tải bản tạm hoặc nộp bằng chứng.
- `fe/src/features/tenant/my-room-page.tsx` hiển thị một `Tenancy`/slot và dịch vụ đang hoạt động. `fe/src/services/tenant.ts` gọi `/api/tenant/tenancies` (fallback sang mock) trong khi backend được khảo sát có `/api/v1/contracts` và `/api/v1/contract-tenants`; chưa thấy endpoint backend tương ứng `/api/tenant/tenancies`.

### Thông tin dịch vụ và quantity hiện có (đã rà theo yêu cầu)

- `BookingCreateRequest` hiện chỉ có `roomSlotId`, `expectedMoveInDate`, `expectedMoveOutDate`; `Booking` không có `guestCount`/số người.
- `ContractDraftRequest.maxOccupants` và `Contract.maxOccupants` có tồn tại cho hợp đồng; không tái sử dụng làm guest count. Theo quyết định mới, bỏ field nếu không còn consumer; nếu phải giữ vì consumer hiện hữu thì chỉ gán bằng số slot của contract, không nhận từ user.
- Trang chi tiết có `ServiceSelection` map `serviceId → quantity` để ước tính; `RoomServicePicker` cho chỉnh quantity của service không bắt buộc, không phải guest count chung. `ContractServiceSnapshot` lưu serviceId, name, unit, unitPrice, calculationType, mandatory, selected nhưng hiện không lưu quantity.
- `ServiceItem`/response có `unit`, `unitPrice`, `calculationType`, `scope`, `mandatory`; `mandatory` là boolean và `METERED` được backend cưỡng chế thành bắt buộc. Seeder demo khai báo:

| Service seed | Unit | CalculationType | Mandatory |
|---|---|---|---|
| Điện | `kWh` | `METERED` | Có |
| Nước | `m³` | `METERED` | Có |
| Vệ sinh / rác | `phòng/tháng` | `FIXED` | Có |
| Thang máy | `người/tháng` | `PER_PERSON` | Có |
| Wi-Fi | `phòng/tháng` | `FIXED` | Không |
| Gửi xe máy | `xe/tháng` | `FIXED` | Không |
| Giặt sấy | `người/tháng` | `PER_PERSON` | Không |
| Dọn phòng định kỳ | `lần` | `FIXED` | Không |
| Tủ đồ cá nhân | `chỗ/tháng` | `PER_SLOT` | Không |

Các giá trị là catalog seed trong source; catalog thật có thể do admin chỉnh sửa trong DB. Quyết định mới: không có guest count; `THANG_MAY` đổi thành `slot/tháng`/`CalculationType.PER_SLOT`; `GIAT_SAY` đổi unit thành `slot/tháng` và dùng `USER_INPUT`. Quy tắc quantity mới được ghi ở phần thiết kế dưới đây.

Catalog change đã chốt: `THANG_MAY` đổi thành unit `slot/tháng`, `CalculationType.PER_SLOT`, `quantityRule=PER_SLOT`, vẫn mandatory. `GIAT_SAY` đổi unit thành `slot/tháng`, `CalculationType.FIXED`, `quantityRule=USER_INPUT` với max = số slot (optional); quantity là số slot người thuê chọn dùng dịch vụ, không phải số người. Gửi xe và tủ đồ cũng dùng `CalculationType.FIXED` + `quantityRule=USER_INPUT`. `ServiceScope` giữ nguyên vì đây là scope gán subscription.

## 3. Thiết kế luồng mới (đề xuất, chờ duyệt)

### Dữ liệu và state transitions

- Booking gom một yêu cầu của một tenant: danh sách `roomSlotIds`, embedded snapshot `selectedServices` (`serviceId`, `name`, `unit`, `unitPrice`, `quantity`), tiền cọc tính tại server, và một mốc `createdAt + 24h` dùng cho payment deadline. Không thêm `guestCount`, không tạo collection dịch vụ mới. Reservation `RESERVED` cho tất cả slot được claim trong transaction; nếu slot bất kỳ không claim được thì không giữ slot nào. Không đưa ngày thuê vào booking request/confirm.
- Tiền cọc = tổng `Room.listedDepositAmount` của phòng cha cho từng slot được chọn. Đã xác nhận phép tính: nhiều slot cùng phòng nhân khoản cọc theo số slot. Backend tính tiền, FE chỉ hiển thị kết quả server.
- Ngày thuê được ghi ở hợp đồng khi tenant gửi evidence: chọn kỳ hạn 3/6/8/12 tháng; ngày ký lấy theo ngày server nhận evidence; hiệu lực 00:00 ngày tiếp theo theo múi giờ `Asia/Ho_Chi_Minh`; ngày kết thúc bằng ngày hiệu lực cộng số tháng đã chọn. Copy ngày vào occupancy/tenancy khi manager/admin duyệt. Không cho backdate theo mặc định; nếu cần nhập ngày ký thực tế, phải chốt cửa sổ N ngày và quyền manager chỉnh khi duyệt.
- Slot inventory quyết định số chỗ sẵn có; `Room.maxOccupants` không còn làm capacity. Bỏ `Contract.maxOccupants` nếu không còn consumer; nếu giữ tương thích thì giá trị suy ra = số slot của contract và không nhận từ user.
- Booking states đề xuất: `AWAITING_PAYMENT` ngay sau tạo → `CONFIRMED` + `PAID` nếu thanh toán được xác nhận trước hạn; → `EXPIRED` + `UNPAID` nếu quá hạn, kết thúc mọi reservation. Khi contract được manager/admin duyệt, dùng `CONVERTED` như code hiện tại. Giữ `CANCELLED` cho tenant hủy nếu còn nghiệp vụ. Bỏ vai trò `REQUESTED`/review/terms trong flow mới; các giá trị lịch sử không migrate trong Phase 1.
- Contract sau trả cọc: tạo tự động, có `contractNumber`, nhiều slot, snapshot selectedServices và download URL đọc từ config (placeholder `https://www.youtube.com/`). Tái sử dụng `ContractStatus.DRAFT` làm trạng thái tạm/chờ evidence; không thêm status mới. Lưu evidence link, thời điểm nộp, deadline và ghi chú yêu cầu gửi lại. Manager/admin yêu cầu gửi lại thì clear evidence hiện tại và giữ `DRAFT`; khi duyệt chuyển `DRAFT → ACTIVE`. `ACTIVE/EXPIRED/TERMINATED` giữ logic hiện tại nếu còn dùng.
- Khi duyệt bằng chứng: tạo dữ liệu sẵn sàng cho API “Chỗ ở của tôi” tương lai cho đúng tenant, với một Contract/ContractTenant liên kết nhiều slot và selectedServices snapshot. Dịch vụ tính một lần/booking, không nhân theo số slot. Backend tenancy endpoint hiện chưa có trong repo này; Phase này chuẩn bị document/response/backend data theo model hiện tại, không tự dựng tenant API tổng quát mới.
- Catalog thêm `quantityRule`: `FIXED_ONE | PER_SLOT | USER_INPUT | METERED`. Quy tắc: `slot/tháng` = số slot thuê; `phòng/tháng` = 1; `xe/tháng` = người đại diện nhập từ 0 đến số slot; `chỗ/tháng` và `GIAT_SAY` dùng USER_INPUT từ 0 đến số slot; các service USER_INPUT tính đơn giá cố định nhân quantity; `lần` không vào estimate lúc đặt và chỉ tính qua service request; `kWh`/`m³` không có quantity lúc đặt, tính theo chỉ số kỳ hóa đơn. Estimate phải hiển thị “tính theo chỉ số thực tế” cho METERED. Quantity 0 không đưa optional service vào snapshot.
- `PER_SLOT` billing dùng số slot `ACTIVE` khi lập hóa đơn, với giả định các slot trong contract chỉ trả cùng lúc. Nếu cho trả slot lẻ giữa kỳ, phải tính theo số ngày. Để chống tính trùng, yêu cầu unique key `(contractId, serviceId, period)` và idempotent create. Source hiện lưu `InvoiceItem` embedded, chưa có `serviceId`, và charge indexes hiện là theo subscription id + period; đề xuất dùng `RoomServiceCharge` cho một charge contract-service-period và thêm trực tiếp `contractId`, `serviceId` để áp compound unique index, vẫn link qua `InvoiceItem.roomServiceChargeId`. Việc tạo index thật trên Atlas cần được duyệt riêng.
- Evidence deadline chốt 72 giờ sau cọc. Đồng hồ dừng khi tenant nộp; manager yêu cầu gửi lại thì mỗi lần có 24 giờ, tối đa 2 lần gửi lại. Quá hạn hoặc hết số lần thì release slots; manager duyệt chậm thì nhắc/escalate, không tự hủy. Cọc refund qua manager queue; phí cổng thanh toán có thể không hoàn nên số refund ròng có thể thấp hơn số thu. Forfeit chỉ là khả năng tương lai nếu có điều khoản hiển thị và tenant đồng ý tại lúc đặt; chưa thêm cờ cấu hình trong scope hiện tại.
- Ngày ký mặc định là ngày server nhận evidence theo `Asia/Ho_Chi_Minh`. Nếu tenant khai ngày ký thực tế: ngày không được trước ngày tạo booking, không được tương lai và tối đa lùi 7 ngày; manager có thể chỉnh khi duyệt. Contract effective date vẫn là 00:00 hôm sau ngày ký. Manager xác nhận kỳ tính tiền đầu tiên khi duyệt để không thu tiền cho ngày chưa ở.

### Endpoint/UI đề xuất

| Tác vụ | Đề xuất |
|---|---|
| Khởi tạo yêu cầu | `POST /api/v1/bookings` nhận `roomSlotIds[]` và service selections/quantity theo `quantityRule`; không có guest count. Bỏ việc manager duyệt. UI chi tiết phòng cho chọn nhiều slot và dịch vụ; người đại diện nhập số xe/tủ theo rule. |
| Khả năng sẵn có | Giữ batch availability theo slot; hold booking chiếm các slot độc lập với ngày thuê cho tới khi hết hạn unpaid hoặc chấm dứt theo trạng thái booking/contract. Khi có ngày hiệu lực, gắn ngày thuê cho occupancy. |
| Thanh toán | Tạo payment ngay khi booking tạo thành công; deadline cố định 24h; bảng xác nhận không hiển thị ngày bắt đầu/kết thúc. Booking detail/payment page cho thấy tổng cọc và thời hạn. |
| Hết hạn | Giữ scheduled job hiện tại, chạy nhiều lần an toàn; kiểm tra deadline khi nhận callback/khởi tạo payment; state transition chỉ thành công nếu booking vẫn `AWAITING_PAYMENT`. Dùng Atlas Replica Set transaction/atomic conditional writes cho booking, payment và reservations. Quá hạn thì booking luôn `EXPIRED`, giải phóng slot và không hồi sinh. Payment thực nhận muộn chuyển `PaymentStatus.LATE_PAID`, vào hàng chờ manager refund; cập nhật refund queue hiện có để nhận giao dịch này. VNPay callback phải verify signature, idempotent theo transaction code và trả success response để gateway ngừng retry. |
| Contract tạm | Idempotently tạo sau khi payment thành công; download URL đọc từ application config, không rải URL trong code. Có thể reuse `GET /api/v1/contracts`/`GET /{id}` cho mục hợp đồng tenant nếu filter role đã cho phép. |
| Nộp và review bằng chứng | Thêm field evidence link, thời điểm gửi và ghi chú yêu cầu gửi lại trên Contract; endpoint tenant gửi link/yêu cầu ký; manager/admin duyệt hoặc yêu cầu gửi lại. `DRAFT` giữ nguyên khi gửi lại evidence; duyệt chuyển `ACTIVE`. Kiểm tra quyền tenant sở hữu contract và quyền manager theo branch. |
| “Chỗ ở của tôi” | Khi approve, lưu ContractTenant một lần và occupancies cho nhiều slot cùng contract, kèm service snapshot một lần. Chuẩn bị response/document để API tenancy tương lai sử dụng; không thêm endpoint `/api/tenant/tenancies` vì chưa có backend tenancy tương ứng trong repo. Evidence deadline đề xuất 72 giờ; quá hạn release slot, manager trễ chỉ nhắc/escalate. |

## 4. Luồng cũ ứng viên dọn sau khi duyệt danh sách

Chỉ liệt kê ứng viên; không xóa trong Phase 1. Mọi xóa code đều cần duyệt riêng. Chứng cứ dưới đây cho thấy vai trò trong flow mới bị loại hoặc đã có đường mới dự kiến; không kết luận file/class nào hoàn toàn không được dùng ở nghiệp vụ khác.

| Ứng viên | Bằng chứng và giới hạn |
|---|---|
| `BookingService.review`, `acceptTerms`, `BookingReviewRequest`, `BookingTermsRequest`, và các route `POST /{id}/review`, `POST /{id}/terms` | FE hiện gọi qua `bookingService.review/acceptTerms`; flow mới bỏ manager approval và tenant acceptance-before-payment. Kiểm tra `BookingServiceImpl` còn các caller cho tác vụ ngoài tạo booking trước khi xóa. |
| Manager UI booking review và form điều khoản (`manager-booking-detail-page.tsx`; một số action/section ở `booking-detail-page.tsx`) | UI đang trực tiếp triển khai bước duyệt, nhập deposit, deadline/check-in/cancellation terms. Chỉ xóa phần đó sau khi thay UI payment flow. |
| `BookingReviewRequest`, `BookingTermsRequest`, deadline/policy fields không còn cần thiết trong Booking | Dùng bởi flow review hiện tại; giữ nếu cancellation/check-in policy mới còn cần. Cần duyệt từng field trước khi xóa do booking lịch sử/API response. |
| `ContractServiceImpl.createDraftFromBooking`, `ContractDraftRequest`, route `POST /api/v1/contracts/from-booking/{bookingId}`, manager booking detail modal | Chứng cứ: tạo draft hiện do manager gọi thủ công sau booking đã `CONFIRMED`/`PAID`; flow mới tạo contract tạm tự động sau payment. Contract CRUD, select services/check-in không tự động đưa vào danh sách xóa; cần xác nhận consumer/manager operational use. |
| Contract selection services `PATCH /{id}/services` và `ContractServiceSelectionRequest` | Trong UI hiện services được chọn sau khi tạo draft; flow mới cần giữ selection từ booking. Chỉ bỏ nếu code search sau migration chứng minh không còn consumer. |
| FE adapters/mocks/documentation chứa response/endpoint cũ | Cần cập nhật đồng thời với API mới; `fe/src/mocks/database.test.ts` có assertion dùng `WHOLE_ROOM`, không tạo/sửa test theo yêu cầu. Nếu enum removal làm compile test lỗi, dừng hỏi trước. |

Không đề xuất xóa reconcile/refund endpoints trong danh sách mặc định: bank transfer có thể vẫn cần xác minh khoản tiền nhận và refund vẫn cần khi thanh toán đến muộn. Chốt policy trước khi quyết định giữ/bỏ.

## 5. Rủi ro, câu hỏi mở và điểm cần xác nhận

Các điểm đã được bạn chốt:

- Booking không chọn ngày thuê; trong lúc gửi bằng chứng hợp đồng chọn 3/6/8/12 tháng. Ngày hiệu lực là 00:00 ngày sau ngày ký, ngày kết thúc cộng số tháng.
- Deposit cộng `Room.listedDepositAmount` theo từng slot; inventory slot quyết định số chỗ.
- Booking snapshot `selectedServices` embedded, copy sang contract tạm khi trả cọc và sang dữ liệu tenancy khi manager duyệt; một Contract/ContractTenant chứa nhiều slot, dịch vụ không nhân theo slot.
- MongoDB Atlas Replica Set 3 node hỗ trợ transaction đa document.
- Quá 24 giờ thì booking auto-cancel; dùng `DRAFT` cho contract tạm và giữ các status contract hiện có, không thêm status mới nếu chưa bắt buộc.
- Không có guest count; bỏ `Room.maxOccupants` (inventory slot là nguồn số chỗ) và bỏ `Contract.maxOccupants`, trừ khi code consumer vẫn cần field contract — khi đó chỉ gán số slot, không nhận từ user. Evidence mặc định dùng ngày server nhận theo `Asia/Ho_Chi_Minh`, 3/6/8/12 tháng; ngày ký thực tế không trước ngày tạo booking, không tương lai, tối đa lùi 7 ngày; manager có thể chỉnh khi duyệt. Manager xác nhận kỳ tính tiền đầu tiên.
- Quantity rules: `THANG_MAY` PER_SLOT; `GIAT_SAY` USER_INPUT, số slot người thuê chọn; fixed room/month = 1; xe/tủ nhập số lượng tối đa số slot; cleaning qua service request; metered hiện theo chỉ số hóa đơn. Evidence deadline 72h, timer dừng khi nộp; yêu cầu gửi lại 24h, tối đa 2 lần; manager review không tự hết hạn.
- Cọc khi quá hạn evidence được hoàn qua manager refund queue; số hoàn có thể trừ phí giao dịch. Forfeit chỉ là khả năng tương lai khi điều khoản được hiển thị và tenant đã đồng ý lúc đặt.
- `PER_SLOT` quantity lấy theo số slot ACTIVE lúc lập invoice, giả định slots trả cùng lúc; nếu cho trả lẻ thì tính theo ngày. Chống trùng bằng unique `(contractId, serviceId, period)` và idempotent create.
- Chưa có backend phù hợp cho “Chỗ ở của tôi”; chuẩn bị dữ liệu cho backend tương lai.
- Đổi dứt khoát `roomMode` query của service catalog sang `serviceScope`, cập nhật frontend cùng lúc; không giữ alias cũ.

Các quyết định nghiệp vụ đã được bạn xác nhận và đưa vào kế hoạch, gồm trần xe, cách tính `THANG_MAY`/`GIAT_SAY`, refund sau quá hạn evidence, giả định slot trả cùng lúc, deadline và số lần gửi lại evidence, ngày ký thực tế cùng kỳ tính tiền đầu tiên.

Điểm kỹ thuật cho implementation: `InvoiceItem` đang embedded và chưa có `serviceId`; unique charge indexes hiện dùng subscription id + period. Kế hoạch ghi yêu cầu unique `(contractId, serviceId, period)` và dự kiến đặt keys trực tiếp lên charge record hiện có. Việc tạo index thật trên Atlas cần được duyệt riêng; Phase 1 chưa tạo index hay ghi DB.

Config URL placeholder có thể dùng application property; không cần quyết định tên mới trước khi code, sẽ theo convention hiện tại.

Rủi ro bổ sung: thay endpoint request làm breaking API client; booking/contract lịch sử không được migration nên cần serialization tương thích hoặc chỉ áp dụng logic mới cho records mới; timezone/deadline chính xác 24 giờ; duplicate callbacks/job retry có thể tạo contract hoặc reservation trùng; manager approval evidence cần kiểm tra quyền manager theo phòng/branch; auto-approve không được kích hoạt tenancy trước khi duyệt bằng chứng.

## 6. Thứ tự triển khai đề xuất (sau khi duyệt kế hoạch)

Mỗi bước là commit nhỏ, không push; sau mỗi bước báo `✅ / 📁 / ⚠️`. Không tạo test case và không sửa test hiện có trừ compile blocker RoomMode; nếu gặp blocker đó sẽ hỏi trước. Chạy build/verification targeted theo yêu cầu sau từng thay đổi, không đụng DB thật. Approval của kế hoạch không thay thế xác nhận riêng cho các hạng mục user đã yêu cầu dừng hỏi.

1. **Chốt API contract và branch** — semantics nghiệp vụ đã chốt; ghi `selectedServices`, quantityRules, request/response, charge index target, state diagram; tạo/đổi branch theo tên đã duyệt. Verify: contract được ghi rõ; chưa đổi code.
2. **Bỏ RoomMode — cần xác nhận riêng trước khi sửa/xóa enum/field** — gỡ enum, field/API/DTO/filter/contract mapping và frontend dependencies; thay calculation room status; cập nhật docs/query ServiceScope sau khi duyệt compatibility. Verify: targeted search sạch; build backend/frontend. Không drop `rooms.roomMode` bằng code/tool; người dùng tự xóa trong Compass.
3. **Booking multi-slot + dịch vụ + deposit — cần xác nhận riêng trước thay đổi schema/status/tính cọc** — chốt model `selectedServices`, `quantityRule`, server calculation, atomic reservation toàn bộ slots, request/response, UI room detail/confirm. Verify build và kiểm tra flow không dùng test case mới.
4. **Thanh toán thẳng + deadline 24h — cần xác nhận riêng trước đổi logic/payment/expiry** — bỏ manager review/terms gate, tạo deadline từ lúc xác nhận giữ chỗ, scheduled expiry và callback idempotent/strict deadline; callback muộn ghi `LATE_PAID`, đưa vào manager refund queue, ack VNPay sau verify signature; không xác nhận lại booking đã hết hạn. Verify bằng build và kiểm tra luồng cổng thanh toán ở môi trường được chỉ định, không dùng DB thật nếu chưa duyệt.
5. **Contract tạm sau trả cọc — cần xác nhận riêng trước thêm field evidence/duration/deadline** — idempotently tạo `DRAFT` contract, contract number, download URL config; deadline evidence riêng; lúc nộp evidence nhận duration `3/6/8/12` tháng và tính ngày hiệu lực; gửi lại bằng cách clear evidence và giữ `DRAFT`, approve chuyển `ACTIVE`. Verify role/ownership checks và build.
6. **Approve tạo “Chỗ ở của tôi”** — ghi tenancy/occupancies/selected services cho đúng tenant; chuẩn bị data cho API sau này và tính mỗi service một lần theo quantity snapshot. Verify build và kiểm tra thủ công bằng dữ liệu dev đã được cho phép.
7. **Danh sách xóa code luồng cũ — dừng xin duyệt riêng trước khi xóa** — đối chiếu caller/reference sau luồng mới; gửi danh sách xóa cụ thể cho bạn duyệt; chỉ sau duyệt mới xóa và cập nhật docs/mock. Verify search dependency sạch và build.
8. **Báo cáo cuối** — file/endpoint/status đổi, `[UNCLEAR]` còn lại, build kết quả, nhắc thao tác Compass drop `rooms.roomMode` do bạn tự thực hiện và thay config URL YouTube bằng Cloudinary khi có URL thật.

## Tiêu chí dừng Phase 1

Tài liệu này là artifact duy nhất của Phase 1. Chưa có code, test, database, schema, branch hay commit nào được thay đổi. Dừng tại đây và chờ bạn duyệt kế hoạch trước Phase 2. Các yêu cầu về unique index Atlas, schema/status/payment/expiry/contract đều vẫn cần xác nhận ở bước riêng trước khi triển khai như constraints ban đầu.
