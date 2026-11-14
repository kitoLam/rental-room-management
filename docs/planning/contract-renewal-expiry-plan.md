# Kế hoạch: Gỡ "Tạo hợp đồng", hiển thị slot đã đặt, cảnh báo "Sắp hết hạn", gia hạn hợp đồng, thông báo tenant

> Phase 1 — read-only. Chưa có code/DB/test nào bị thay đổi bởi tài liệu này.
> **Cập nhật 2026-11-12**: đọc lại code sau khi repo merge kiến trúc "one contract per slot" (`3493641`, `71f78f5`, `19785e3`, `9a20a91`). Kế hoạch đã sửa các chỗ lỗi thời.
> Dừng sau tài liệu này và chờ duyệt trước Phase 2.

## 0. Đọc trước & skill đã chọn

**File hướng dẫn thực tế tồn tại trong repo** (đã kiểm tra bằng Glob):
- `docs/coding_rules.md` — quy ước coding backend (MapStruct, DTO layer, Service interface, modular monolith, no hardcoded secrets). **Đã đọc.** Không có `Gemini.md` hay `agent.md` trong repo (Glob `**/{Gemini,gemini,AGENT,agent,AGENTS,agents}.md` → không có file nào). Không có thư mục `skills/` ở cấp dự án. Các skill áp dụng được là skill toàn cục của Claude Code (liệt kê bên dưới), không phải file trong repo.
- `docs/planning/booking-refactor-plan.md`, `docs/planning/booking-roomslot-refactor.md` — tiền lệ về format plan.
- `docs/business_rules/room-viewing-business-rules-1-40.md` — quy tắc lịch xem, không đụng tới trong task này.

**Skill chọn và lý do:**

| Skill | Có dùng? | Lý do |
|---|---|---|
| `planning-and-task-breakdown` | Có (Phase 1) | Chia 5 nhóm A–E thành các bước kiểm chứng được, có approval gate. |
| `api-and-interface-design` | Có (D) | Endpoint gia hạn là API nội bộ mới, cần chốt contract request/response, phân quyền, idempotency. |
| `source-driven-development` | Có (toàn bộ) | Mọi kết luận dưới đây đều dựa trên file đã đọc — ghi rõ đường dẫn + dòng. |
| `incremental-implementation` | Có (Phase 2) | Thứ tự A→B→C→D→E, mỗi nhóm build riêng. |
| `test-driven-development` | **Không** — prompt cấm viết testcase mới; chỉ chạy test hiện có. |
| `frontend-ui-engineering` | Có (B, C, D UI, E UI) | Badge nháy + tôn trọng `prefers-reduced-motion`, dialog gia hạn theo Component hiện có. |
| `security-and-hardening` | Có (giới hạn) | Phân quyền endpoint gia hạn, không tin dữ liệu client. |

**Không tự tạo skill mới.**

## 1. Hiện trạng xác minh được (bằng chứng code)

### Booking flow thực tế (ĐÃ THAY ĐỔI — kiến trúc mới "one contract per slot")
> ⚠️ Cập nhật 2026-11-12: repo đã merge các commit `3493641 [feature] one shared payment per booking, one contract per slot`, `71f78f5 per-slot contracts`, `19785e3 move tenant payments/contracts into account menu`, `9a20a91 Merge PR #10`. **Một booking giờ tạo NHIỀU hợp đồng — mỗi slot một hợp đồng.** Kế hoạch cũ (1 booking = 1 contract) đã lỗi thời ở phần dưới; đã sửa.

- `Booking` document (`modules/booking/document/Booking.java`) giờ có **`contractIds` (List<String>)** bên cạnh `contractId` (first). Ghi chú trong code: *"One contract per booked slot, created once the deposit is paid. contractId = the first one."*
- E-contract tạm KHÔNG còn tạo 1 contract: `BookingServiceImpl.createSlotContracts(Booking)` (private, `BookingServiceImpl.java:762-816`) lặp qua từng slot tạo 1 `Contract` DRAFT/slot, gán `booking.setContractIds(ids)` + `setContractId(ids.getFirst())`. Idempotent theo `findAllByBookingIdAndIsDeletedFalse`.
- Giá thuê/cọc tính theo **share mỗi slot**: `modules/room/support/SlotPricing.rent(room)/deposit(room)` — chia `listedRentPrice`/`listedDepositAmount` cho `room.maxOccupants`.
- `contractUrl` set từ config trong `createSlotContracts` (`BookingServiceImpl.java:795` — `contract.setContractUrl(contractUrl)`).
- Manager của chi nhánh resolve qua **`modules/branch/support/BranchManagerResolver.managerAccountId(branchId)`** (`BookingServiceImpl.java:773`) — pattern mới: support class cross-module thay vì Service interface (liên quan U11).
- Endpoint tạo hợp đồng thủ công vẫn **còn tồn tại** (chưa ai xóa): `POST /api/v1/contracts/from-booking/{bookingId}` → `ContractController.java:53-60` → `ContractServiceImpl.createDraftFromBooking` (`ContractServiceImpl.java:102-185`, đã đổi dòng). Endpoint này **vẫn tạo 1 contract cho 1 slot** (`contract.getRoomSlotId()`), khác với auto-flow tạo nhiều contract.
- Nút thực sự trong UI (vẫn còn, cần gỡ theo A):
  1. `fe/src/features/manager/manager-contracts-page.tsx:14-17` — nút **`Tạo hợp đồng từ booking đã xác nhận`** (link tới `/manager/bookings`).
  2. `fe/src/features/manager/manager-booking-detail-page.tsx:99` — nút **`Tạo hợp đồng từ giữ phòng`** kèm modal `decision === 'convert'` + confirm `pendingContractDraft` (dòng 137-193, 265-291). Gọi `action: 'convert'` → `manager.ts:970` → `contractService.createDraftFromBooking`.
- **Frontend services**: `fe/src/services/manager.ts:970` (`action === 'convert'`), `guest-user.ts` (`createDraftFromBooking`), `real-api.ts` (whitelist `from-booking`).

### Trạng thái hợp đồng
- `ContractStatus` = `{DRAFT, ACTIVE, EXPIRED, TERMINATED}` — `modules/contract/enums/ContractStatus.java`.
- **Vẫn KHÔNG có job tự chuyển `ACTIVE → EXPIRED`** (grep `setStatus(ContractStatus.EXPIRED)` trong `be/src/main` → 0 dòng). Hợp đồng ACTIVE quá `endDate` vẫn giữ `ACTIVE`. Người dùng yêu cầu U10: **hợp đồng quá hạn phải chắc chắn chuyển EXPIRED** → cần thêm job expire (xem §D/U10 mới).
- `convertBookingWhenAllActive(Booking, ...)` (`ContractServiceImpl.java:366-375`): booking chỉ chuyển `CONVERTED` khi **tất cả** contract (trừ TERMINATED) đều ACTIVE. Ảnh hưởng D: gia hạn 1 contract trong booking nhiều slot không làm booking sai trạng thái.
- `reviewEvidence`/`completeCheckIn` giờ chỉ đụng **occupancy của slot thuộc contract đó** (`ContractServiceImpl.java:341-354` — `.filter(contract.getRoomSlotIds().contains(item.getRoomSlotId()))`). Rất quan trọng cho D: gia hạn 1 contract chỉ kéo dài occupancy slot của nó.

### Cơ chế nhả slot trước khi hết hạn (quan trọng cho D)
- `RoomSlotAvailabilityRoller.RELEASE_LEAD_DAYS = **14**` — `modules/roomslot/service/support/RoomSlotAvailabilityRoller.java:16-17`. **Không phải 21 như prompt mô tả.**
- Cách hoạt động: `releaseDate(endDate) = endDate.minusDays(14)` (`RoomSlotAvailabilityRoller.java:31-33`), `releasesBefore(endDate, requestedStart)` (`:35-39`). Được dùng ở:
  - `BookingServiceImpl.java:215` — checkAvailability (batch) bỏ chặn occupancy nếu đặt mới rơi sau mốc nhả.
  - `BookingServiceImpl.java:672,676` — ensureNoOccupancyOverlap.
  - `PublicRoomService.java:293` — slot đang có người nhưng còn ≤ 14 ngày thì vẫn tính là trống cho khách mới.
- **Đây chính là "mở lại khả năng đặt cọc giữ slot trước hạn hợp đồng"**. Khóa khi gia hạn (D) phải tác động vào cơ chế này.

### Notification module (có sẵn)
- Document `Notification` (`modules/notification/document/Notification.java`) với `eventId, recipientAccountId, requesterAccountId, appointmentId, branchId, kind, title, message, detailPath, readAt`.
- `NotificationService.publish(NotificationPublishRequest)` — `NotificationService.java:11`; impl `NotificationServiceImpl.java:31-42`. **Chống trùng ở tầng DB** bằng `_id = SHA-256(appointmentId + "\0" + eventId + "\0" + recipientAccountId)` — `:34`. Vì vậy `eventId` phải **ổn định theo từng mốc** để idempotent.
- Scope đọc thông báo: `_id recipientAccountId == scope.accountId()` AND (`requesterAccountId == accountId` OR `branchId IN manageableBranchIds`) — `NotificationServiceImpl.java:71-75`.
- HTTP surface hiện tại: `GET /api/v1/appointments/notifications`, `POST /{id}/read`, `POST /read-all` — `AppointmentController.java:41-57`, map tới `AppointmentService.notifications` với scope = `actor.accountId()` (`AppointmentServiceImpl.java:723,737-740`).
- Mẫu publish chuẩn: `ServiceRequestNotificationSupport.java` — tên `publishAfterCommit`, chống trùng bằng `eventId = "SERVICE_REQUEST:" + id + ":" + kind`, `publishQuietly` bắt RuntimeException chỉ log warn (`:92-112`).

### Vấn đề mapping tenant → tài khoản nhận thông báo (chặn E)
- `Tenant` document (`modules/tenant/document/Tenant.java`) **không có `accountId`**. Chỉ có `email` (`@Indexed`) và id document của chính nó.
- `scope.accountId()` là id **tài khoản xác thực** (User), không phải Tenant id. Bằng chứng: `BookingServiceImpl.java:949` trả `user.getId()` làm `requesterAccountId` khi tìm được User theo email tenant; `Appointment.requesterAccountId` là account id.
- **Hệ quả:** để gửi thông báo tới đúng tenant, job E phải resolve `tenantId → Tenant.email → User.accountId` rồi mới `publish`. Đây là thông tin bắt buộc để E hoạt động, và là lý do E có phương án thiết kế ở §6.

### Frontend
- Trang danh sách/chi tiết hợp đồng phía manager: `fe/src/features/manager/manager-contracts-page.tsx`, `manager-contract-detail-page.tsx`. **Admin KHÔNG có trang hợp đồng riêng** — `/admin/*` không có route `contracts` (router grep). Admin dùng chung UI manager qua `ManagerLayout` (`manager-layout.tsx:150` có link về `/admin/dashboard` khi user có role ADMIN) và có thể vào `/manager/contracts` nếu có phân công chi nhánh. Xem UNCLEAR U2.
- `ManagerStatus` (`fe/src/features/manager/components.tsx:91-131`) map status → `StatusBadge` (`fe/src/components/common/status-badge.tsx`). Badge "Sắp hết hạn" nên đặt ngay dưới `ManagerStatus`.
- Trang xem phòng công khai: `fe/src/features/rooms/room-detail-page.tsx` — khối `Chọn các slot muốn thuê` dòng 280-313; mỗi slot hiển thị ở dòng 301-307:
  - `!s.available && s.availableFrom` → "Đang thuê · nhận phòng từ {date}". **Đây chính là chỗ cần đổi thành "Đã được đặt" khi slot đã được đặt (B).**
  - `!s.available && !s.availableFrom` → "Đã kín". `s.available && s.availableFrom` → "Từ {date}". Đây là chỗ giữ nguyên.
  - Nguồn dữ liệu `s` từ `bookingService.availabilityForRoom()`, map ở `fe/src/services/guest-user.ts:542-556` (`id, label, available, availableFrom`).
- Thông báo real-mode: `/notifications` render `ViewingNotificationsPage` (`notifications-page.tsx:14-16`) — trang này hiện chỉ có UI "Mở lịch xem" và gọi `/api/v1/appointments/notifications`. Xem UNCLEAR U5.

## 2. Kế hoạch theo nhóm

### A. Gỡ nút "Tạo hợp đồng" từ booking

**Quyết định phạm vi dựa trên caller (đã kiểm tra codegraph + grep, cập nhật 2026-11-12):**
- `ContractService.createDraftFromBooking` **chỉ** được gọi bởi `ContractController.java:53-60`. Không có caller nội bộ nào.
- Kiến trúc mới: auto-flow dùng `createSlotContracts` (`BookingServiceImpl.java:762-816`, private, gọi từ luồng thanh toán cọc), **tách biệt hoàn toàn** với `createDraftFromBooking`. Xóa endpoint không đụng auto-flow.
- Người dùng chốt U1: **xóa toàn bộ chức năng `createDraftFromBooking`** (manager + owner + admin).

**Thay đổi đề xuất (Phase 2):**

| # | File | Dòng | Thay đổi | Rủi ro |
|---|---|---|---|---|
| A1 | `fe/src/features/manager/manager-contracts-page.tsx` | 14-18 | Xóa `actions={<ManagerLink ...>Tạo hợp đồng từ booking đã xác nhận</ManagerLink>}` | Thấp |
| A2 | `fe/src/features/manager/manager-booking-detail-page.tsx` | 47, 99, 137-193, 265-291 | Xóa nút "Tạo hợp đồng từ giữ phòng", modal `convert`, `pendingContractDraft` + confirm | Thấp (U1 đã chốt xóa) |
| A3 | `fe/src/services/manager.ts` | 970 | Xóa branch `if (action === 'convert') return contractService.createDraftFromBooking(...)` | Thấp |
| A4 | `fe/src/services/guest-user.ts` | `createDraftFromBooking` | Xóa method + schema liên quan | Thấp |
| A5 | `fe/src/services/real-api.ts` | whitelist `from-booking` | Xóa whitelist | Thấp |
| A6 | `be/.../contract/controller/ContractController.java` | 8, 53-60 | Xóa import + method `createDraftFromBooking` | Thấp — không caller khác |
| A7 | `be/.../contract/service/ContractService.java` | 11, 32 | Xóa import + khai báo | Thấp |
| A8 | `be/.../contract/service/impl/ContractServiceImpl.java` | 22, 102-185, `serviceSnapshots` | Xóa method + import. **Kiểm tra `serviceSnapshots` còn caller khác không** | **Cao nếu `serviceSnapshots` dùng chung** — verify caller trước; `createSlotContracts` dùng inline nên không cần helper này |
| A9 | `be/.../contract/dto/request/ContractDraftRequest.java` | toàn file | Xóa file nếu không còn ai import | Cần duyệt xóa file |
| A10 | `fe/src/mocks/manager-leasing.ts` | ~convert mock | Mock contract convert: xóa theo | Thấp |

**Phần logic tạo contract D có thể tái sử dụng:**
- `createSlotContracts` (`BookingServiceImpl.java:762-816`) — private, tạo contract/slot: contractNumber, SlotPricing.rent/deposit, services (chỉ contract đầu), `contractUrl`, hạn evidence 72h. **Giữ nguyên, không đụng.**
- `SlotPricing` (`modules/room/support/SlotPricing.java`) — chia giá phòng theo slot. D dùng khi cần (hoặc kế thừa rentPrice từ contract cũ).
- Dựng contract gia hạn: **copy field từ contract cũ** (đã có sẵn rentPrice/deposit/services) — không cần gọi lại `createSlotContracts` (vì contract cũ đã có đủ snapshot).

### B. Màn xem phòng: slot đã đặt → "Đã được đặt"

- File duy nhất cần sửa: `fe/src/features/rooms/room-detail-page.tsx`, khối "Chọn các slot muốn thuê / xem phòng" (~dòng 317-360).
- Hiện tại (đã kiểm tra lại, có thêm điều kiện chọn slot cho viewing):
  - `!s.available && s.availableFrom` → `<span class="text-warning">Đang thuê · nhận phòng từ {date}</span>` (~dòng 345-347).
  - `!s.available && !s.availableFrom` → `<span>Đã kín</span>` (~dòng 349).
  - `s.available && s.availableFrom` → `<span>Từ {date}</span>` (~dòng 352-354) — slot trống, **giữ nguyên**.
- Đề xuất: đổi nhánh `!s.available` (cả có `availableFrom` lẫn không) thành **`Đã được đặt`**. Giữ nguyên nhánh `s.available && s.availableFrom`.
- **Không đổi** logic `bookable`, `selectedSlots`, `viewing.data.slots.selectable`, availability service, hay luồng đặt cọc.
- U3 (đã trả lời): đúng — các slot `unavailable` chính là "đã được đặt"; không thêm status mới. Một nhánh `!s.available` là đủ.

### C. Cảnh báo "Sắp hết hạn" (expiringSoon)

**So sánh hai phương án:**

| Phương án | Ưu | Nhược | Đề xuất |
|---|---|---|---|
| **(1) Computed lúc trả response** — thêm `boolean expiringSoon` vào `ContractResponse`, tính trong `ContractServiceImpl.response()`: `status == ACTIVE && endDate != null && !endDate.isBefore(todayVietnam) && !endDate.isAfter(todayVietnam.plusDays(EXPIRING_SOON_DAYS))` | Không có migration, không lệch dữ liệu, luôn đúng theo ngày chạy | Tính lại mỗi request (rẻ), response thêm 1 field | **Chọn** — đúng mặc định ưu tiên computed của prompt |
| (2) Lưu DB / thêm enum | Truy vấn trực tiếp `expiringSoon=true` được | Cần job cập nhật hằng ngày + script Compass + dữ liệu có thể lệch nếu job lỗi; enum status mới làm phá logic `status == ACTIVE` hiện có ở `completeCheckIn`, `reviewEvidence`, `search` | **Không chọn** |

**Hằng số 60:** đặt `ExpiringSoonCalculator` hoặc `ContractExpiryConstants` trong `modules/contract/service/support/`. Đề xuất dùng constant `EXPIRING_SOON_DAYS = 60` và method `isExpiringSoon(Contract, LocalDate today)` — 1 chỗ duy nhất. `todayVietnam` tái dùng `RoomSlotAvailabilityRoller.todayVietnam(clock)` (`VIETNAM_ZONE`), không tạo mới.

**Frontend:** thêm badge dưới `ManagerStatus` ở `manager-contracts-page.tsx` (cột trạng thái) và `manager-contract-detail-page.tsx` (Panel thông tin). Component `ExpiringSoonBadge` mới trong `fe/src/features/manager/components.tsx` (hoặc file riêng cùng thư mục) — dùng `StatusBadge` tone `warning` + class `animate-pulse` với `motion-reduce:animate-none` (Tailwind đã có `prefers-reduced-motion` qua variant `motion-safe`/`motion-reduce`). CSS animation phải tôn trọng `prefers-reduced-motion`.

**DB change:** không. Không cần script Compass cho C (vì chọn computed). Nếu vì lý do nào đó chọn phương án 2, sẽ kèm script ở `docs/planning/` — nhưng chưa đề xuất.

### D. Gia hạn hợp đồng

> ⚠️ Kiến trúc mới: 1 booking → nhiều contract (1/slot). Gia hạn thao tác trên **1 contract cụ thể = 1 slot**, không đụng contract khác của cùng booking.

**Quyết định theo câu trả lời người dùng:** U6 → **cho gia hạn bất kỳ lúc nào** (không chỉ expiringSoon); U7 → **tạo ContractTenant mới**; U10 → **hợp đồng quá hạn phải chuyển EXPIRED** (thêm job).

**Backend:**
- Thêm field vào `Contract`: `renewedFromContractId` (String, `@Indexed`) và `renewedToContractId` (String) — U4: **giữ cả 2** (một để truy vấn hiển thị, một để atomic claim chống race).
- Thêm endpoint `POST /api/v1/contracts/{id}/renew` — `@PreAuthorize("hasAnyRole('OWNER','MANAGER')")` (**không** cho ADMIN theo U2 — admin bị cô lập). Request `ContractRenewRequest(Integer termMonths)` — validate `List.of(3,6,8,12).contains(termMonths)` như `submitEvidence` (`ContractServiceImpl.java:269-270`).
- Logic `renew`:
  1. `find(id)`; `requireManager(room(contract.getRoomId()), principal)`.
  2. U6: cho phép khi `status == ACTIVE` bất kể còn bao nhiêu ngày (kể cả chưa tới cửa sổ) — nhưng **không cho** khi `status != ACTIVE` (DRAFT/EXPIRED/TERMINATED). Nếu hợp đồng đã quá `endDate` mà chưa chuyển EXPIRED (do job chưa chạy), vẫn cho gia hạn nếu `status == ACTIVE` (xem U10 — job sẽ chuyển EXPIRED, khi đó không gia hạn được nữa; thứ tự job vs renew là điểm cần chốt).
  3. Validate **chưa được gia hạn**.
  4. `endDate != null` bắt buộc.
  5. Tạo contract mới cho **cùng slot đó**: copy `tenantId/roomId/roomSlotId/roomSlotIds/landlord fields/rentPrice/contractDepositAmount/paymentDueDay/terms/electricityInitialReading/electricityRate/waterRate/parkingRate/contractUrl/services/maxOccupants/activeSlotServices` (kế thừa). `startDate = contract.getEndDate().plusDays(1)`, `endDate = startDate.plusMonths(termMonths)`, `status = ACTIVE`, `contractNumber = nextContractNumber()`, `managerId = principal.userId()`, `bookingId = contract.getBookingId()` (giữ liên kết booking), `renewedFromContractId = contract.getId()`.
  6. **Không mở lại đặt cọc**: occupancy ACTIVE của contract cũ gắn slot này có `endDate = contract.getEndDate()`. Kéo dài: `RoomSlotOccupancy.setEndDate(newContract.getEndDate())`, giữ `startDate`. **Không tạo occupancy mới** (sẽ trùng). Việc này làm `RoomSlotAvailabilityRoller.releasesBefore` không còn nhả slot này (endDate đã lùi xa).
  7. U7: **tạo mới `ContractTenant`** gắn `newContract.getId()`, copy từ ContractTenant cũ (`joinedAt = newContract.getStartDate()`), status ACTIVE.
  8. U10: **job expire** (mới, xem dưới) chuyển contract `ACTIVE` → `EXPIRED` khi `endDate < today`. Khi đó nút "Gia hạn" (chỉ hiện với ACTIVE) sẽ biến mất. Thứ tự: nếu muốn cho phép gia hạn cả contract vừa quá hạn trong ngày, job phải chạy sau nửa đêm và cần xem xét — **chốt: job chạy đầu ngày, hợp đồng quá endDate bị EXPIRED → không gia hạn được**; manager phải gia hạn trước endDate.
  9. Publish notification `CONTRACT_RENEWED` (tùy chọn — không bắt buộc theo yêu cầu; bỏ nếu muốn tối giản).
- **Idempotent (atomic)**: `mongoTemplate.findAndModify(Query(where _id = id AND renewedToContractId = null), Update.set renewedToContractId = newId)` trả `null` nếu đã gia hạn → `ConflictException`. Set trước khi save contract mới; nếu save lỗi thì rollback transaction.
- **U8 — số ngày nhả per-room**: người dùng yêu cầu **giữ 14 mặc định nhưng thêm chức năng cho Manager/Owner chỉnh số ngày nhả riêng từng phòng**. Đề xuất:
  - Thêm field `releaseLeadDays` (Integer, mặc định null) vào `Room` document (`modules/room/document/Room.java`).
  - `RoomSlotAvailabilityRoller.releaseDate/releasesBefore` cần nhận thêm tham số `releaseLeadDays` (truyền từ room). Hiện 3 chỗ gọi (`BookingServiceImpl.java:215,681,685` và `PublicRoomService.java:273`) — mỗi chỗ phải resolve room → lấy `releaseLeadDays` (fallback 14). Đây là thay đổi **xuyên suốt** nhiều module → cần duyệt kỹ.
  - UI cấu hình: màn phòng của manager (`manager-room-editor-page.tsx` hoặc detail) thêm field "Số ngày nhả trước hết hạn". Endpoint cập nhật room hiện có (`PATCH /api/v1/rooms/{id}`) — cần kiểm tra request DTO có nhận field mới không.
  - **Đây là mở rộng scope rõ rệt** (đụng room module + booking + public search). Xem lại ở §6 U8-new.

**Frontend D:**
- `manager-contract-detail-page.tsx`: thêm `Button "Gia hạn"` trong khối `status === 'ACTIVE'` (~dòng 109-113), mở `Modal` + `ManagerForm` field `termMonths` select `{3,6,8,12}`. Submit → `mutation.mutate({ resource: 'contracts', id: contractId, action: 'renew', value: { termMonths } })`.
- `fe/src/services/manager.ts`: thêm `action === 'renew'` → `contractService.renewContract(id, value)`.
- `fe/src/services/guest-user.ts`: thêm `renewContract` → `POST /api/v1/contracts/{id}/renew`.
- `fe/src/interfaces/manager.ts` + `tenant.ts` + `services/guest-user.ts` + `services/tenant-profile.ts` (`myContractSchema`): thêm `renewedFromContractId`, `renewedToContractId`, `expiringSoon`.

**Job expire (U10 mới — bắt buộc khi hợp đồng quá hạn phải EXPIRED):**
- Class `ContractExpiryJob` (`modules/contract/service/impl/` hoặc `service/support/`), `@Scheduled(cron = "${contract.expiry.cron:0 5 0 * * *}", zone = "Asia/Ho_Chi_Minh")` (chạy 00:05 mỗi ngày).
- Logic: `Contract` có `status = ACTIVE` và `endDate < todayVietnam` → `setStatus(EXPIRED)`. **Lưu ý**: phải xử lý occupancy/ContractTenant tương ứng — khi contract EXPIRED, occupancy có nên chuyển ENDED? Người dùng nói "hợp đồng quá hạn mất hiệu lực". Đề xuất: set occupancy cùng slot `status = ENDED` (để slot thành trống thật), ContractTenant `status = LEFT`. **Cần duyệt** vì đụng occupancy/contractTenant (§6 U10-new).

**DB change:** `renewedFromContractId`, `renewedToContractId` (String, null); `Room.releaseLeadDays` (Integer, null = dùng 14). Không cần enum mới. Không cần backfill.

### E. Thông báo hợp đồng sắp hết hạn cho tenant

> Kiến trúc per-slot: mỗi slot contract có `endDate` riêng → job gửi thông báo **theo từng contract = từng slot**, không gộp.

**Mốc:** 45, 30, 21, 14 ngày trước `endDate` (chốt theo prompt Phase 1: 4 mốc). File `docs/New Text Document.txt` ghi thêm 7 — không dùng.

**Job:** `@Scheduled(cron = "${contract.expiry-notify.cron:0 0 8 * * *}", zone = "Asia/Ho_Chi_Minh")` — 08:00 mỗi ngày giờ VN. Class `ContractExpiryNotificationJob` (`modules/contract/service/impl/` hoặc `service/support/`). Không tạo module mới.

**Logic:**
1. Lấy `Contract` có `status = ACTIVE`, `endDate != null`, `endDate >= today`, `endDate <= today + 45`.
2. Bỏ qua contract đã có `renewedToContractId != null` (đã gia hạn) hoặc `renewedFromContractId` khác null (là contract nối tiếp — không phải hợp đồng gốc sắp hết hạn, tránh thông báo trùng cho chuỗi gia hạn).
3. Bỏ qua TERMINATED/EXPIRED (đã lọc bởi `status = ACTIVE`).
4. `daysLeft = ChronoUnit.DAYS.between(today, endDate)`. Trong 4 mốc `[45,30,21,14]`: chọn mốc **chưa gửi gần nhất** (mốc lớn nhất mà `daysLeft <= milestone`); nếu bỏ lỡ nhiều ngày, chỉ gửi 1 thông báo mốc mới nhất chưa gửi — không gửi dồn.
5. `NotificationService.publish`:
   - `eventId = "CONTRACT_EXPIRY:" + contractId + ":" + milestoneDays` (ổn định → idempotent `_id` sha256).
   - `kind = "TENANT_CONTRACT_EXPIRING"` — nhưng lưu ý UI `notifications-page.tsx` chỉ lọc theo category có trong danh sách (`TENANT_CONTRACT`); `TENANT_CONTRACT_EXPIRING` chưa có trong dropdown → cần đổi `kind = "TENANT_CONTRACT"` để hiện đúng category "Hợp đồng" (đề xuất).
   - `detailPath = "/user/contracts/{id}"` — route tenant contracts mới là `/user/contracts` (`router.tsx:734`, `my-contracts-page.tsx`). Kiểm tra lại: có cả `/tenant/contracts` (`router.tsx:601`). **Chốt `detailPath = "/user/contracts"`** vì account menu hiện dẫn tới đó (commit `19785e3 move tenant payments/contracts into account menu`).
   - `recipientAccountId` = account id resolve `tenantId → Tenant.email → User.id` (`BranchManagerResolver` cùng pattern; hoặc `userRepository.findByEmailAndIsDeletedFalse`). **Không** dùng tenantId.
   - U9: **chỉ gửi tenant**. Không set branchId (tránh manager thấy — dù yêu cầu chỉ tenant).
6. **Lưu "đã gửi" mốc:** thêm `List<Integer> expiryNotifiedMilestones` vào `Contract` (DB field), atomic update sau khi publish. Không cần bảng riêng (NotificationService đã chống trùng `_id`, nhưng field này để "chỉ gửi mốc mới nhất chưa gửi"). **DB schema change — dừng hỏi ở Phase 2.**
7. Tenant không có User account (email chưa đăng ký) → log warn, bỏ qua.

**UI:** U5 (đã trả lời): **mở rộng `ViewingNotificationsPage`, không tạo route mới.** `/notifications` real-mode render nó (`notifications-page.tsx:15`). Sửa: tiêu đề trang đổi thành "Thông báo" chung; mỗi item hiển thị `title/message/createdAt` như hiện tại; nút hành động theo `detailPath`: nếu bắt đầu `/user/contracts` hoặc `/tenant/` → "Mở hợp đồng", nếu `/manager/appointments` → "Mở lịch xem" (giữ cũ). Đây là **sửa file `viewing-notifications-page.tsx`**.

## 3. Thứ tự thực hiện đề xuất

1. **A** (gỡ nút + backend) — ít rủi ro nhất, độc lập, verify build.
2. **B** (đổi label slot) — 1 file, độc lập, verify build.
3. **C** (expiringSoon computed) — thêm field response + constant + badge, không đụng DB, verify build.
4. **D** (gia hạn + job expire) — phức tạp nhất, cần DB field mới `renewedFromContractId`/`renewedToContractId`; job expire đụng occupancy/ContractTenant. Cần duyệt schema. U8 per-room release là nhánh con của D, cần duyệt riêng.
5. **E** (thông báo tenant) — phụ thuộc D (bỏ qua contract đã renewed) và cần DB field `expiryNotifiedMilestones`; cần duyệt schema + mapping account id.

Sau mỗi nhóm: chạy `./mvnw -q compile` (be) + `npm run typecheck` (fe), output "✅ [nhóm] — danh sách file đã đổi, kết quả build".

## 4. DB / schema / enum change

| Thay đổi | Cần? | Script Compass cần? |
|---|---|---|
| `Contract.expiringSoon` | Không — computed | Không |
| `Contract.renewedFromContractId` (String, null) | **Có** (nhóm D) | Không cần backfill (null = chưa gia hạn). |
| `Contract.renewedToContractId` (String, null) — atomic idempotency | **Có** (nhóm D) | Không cần backfill |
| `Contract.expiryNotifiedMilestones` (List<Integer>, mặc định `[]`) | **Có** (nhóm E) | Không cần backfill |
| `Room.releaseLeadDays` (Integer, null = 14) | **Có** (nhóm D / U8) | Không cần backfill (null → dùng default 14) |
| Enum `ContractStatus` mới | **Không** — computed không cần enum |

Không chạy, không kết nối DB nào từ phía tôi.

## 5. Khoảng trống kỹ thuật phát hiện được (sau khi đọc lại code 2026-11-12)

1. **Không có job ACTIVE → EXPIRED** (vẫn đúng sau khi đọc lại): người dùng yêu cầu U10 → **phải thêm job** `ContractExpiryJob`. Khi contract EXPIRED, cần chốt xử lý occupancy/ContractTenant (§6 U10-new).
2. **Tenant không có accountId** (vẫn đúng): `Tenant` có `email`, `branchIds`, `isInactiveInBranch()` — **không có `accountId`**. Job E phải resolve `tenantId → Tenant.email → User.id`. Mẫu: `BranchManagerResolver.managerAccountId`.
3. **Notification real-mode UI** (`/notifications` → `ViewingNotificationsPage`): U5 yêu cầu mở rộng, không tạo route.
4. **Admin bị cô lập** (U2 trả lời): endpoint renew + badge **chỉ cho Manager/Owner**, không phân quyền ADMIN. Admin không thấy.
5. **Release window 14 ngày, per-room** (U8 trả lời): giữ 14 default, **thêm field `Room.releaseLeadDays` + UI chỉnh riêng từng phòng**. Đây là thay đổi xuyên suốt 3 chỗ gọi `releasesBefore/releaseDate` + PublicRoomService + Room module + Room request DTO. Cần duyệt kỹ (§6 U8-new).
6. **Cross-module pattern mới** (U11 trả lời "tham khảo kiến trúc mới"): repo đã có `modules/*/support/*` (VD `BranchManagerResolver`) — support class `@Component` được inject trực tiếp qua constructor, **không phải** Service interface. `ContractServiceImpl` vẫn inject `occupancyRepository` trực tiếp (đã kiểm tra — vẫn vậy). **Đề xuất cho D**: theo kiến trúc mới, nếu cần logic occupancy phức tạp, tạo `modules/roomslotoccupancy/support/...` hoặc dùng repository trực tiếp như tiền lệ hiện có; **không** tạo Service interface mới. Xem U11-new (cần xác nhận).
7. **Booking CONVERTED logic** (`convertBookingWhenAllActive`): booking nhiều slot chỉ CONVERTED khi tất cả contract ACTIVE. Gia hạn 1 contract không phá logic này (vẫn ACTIVE). Ổn.
8. **`myContractSchema`** (`services/tenant-profile.ts:22-35`) khá hẹp, thiếu `roomId`, `roomSlotId`, `contractUrl`, `termMonths`, `firstBillingStartDate`… Nếu C cần `expiringSoon` hiển thị ở màn tenant contracts, phải thêm field vào schema này. Không bắt buộc nếu C chỉ hiển thị manager/owner.

## 6. Danh sách `[UNCLEAR — cần xác nhận]` + đề xuất mặc định

Người dùng đã trả lời U1–U10. Còn các mục mở do kiến trúc mới:

| # | Câu hỏi | Đề xuất mặc định |
|---|---|---|
| **U11-new** | D cập nhật RoomSlotOccupancy/ContractTenant từ contract module: kiến trúc mới dùng `modules/*/support/*` (như `BranchManagerResolver`). Có nên tạo support class cho occupancy thay vì inject repository trực tiếp? | Theo kiến trúc mới: tạo logic trong `ContractServiceImpl` dùng `occupancyRepository` trực tiếp (như `reviewEvidence` hiện tại `:342-354`) — **không tạo support mới**. Nếu muốn đúng pattern mới, tách `RoomSlotOccupancySupport` ở module roomslotoccupancy. **Cần anh chốt.** |
Answer: Cách B: gom vào một support class
| **U10-new** | Khi `ContractExpiryJob` chuyển contract quá hạn `ACTIVE → EXPIRED`, occupancy/ContractTenant cùng slot xử lý thế nào? Nếu không đổi, slot vẫn bị occupancy ACTIVE chặn (dù releasesBefore đã nhả sau 14 ngày). | Đề xuất: occupancy cùng slot `status = ENDED`, ContractTenant `status = LEFT`. Cần duyệt vì đụng 2 module. |
Answer: Tham khảo cách giải quyết này và hoản chỉnh hơn phù hợp với hệ thống 
Đây là luồng đầy đủ dựa trên code trong plan. Ví dụ: hợp đồng cũ có endDate = 31/12, không gia hạn.

Luồng theo thời gian
Mốc	Hệ thống làm gì
Trước 17/12 (endDate − 14)	Occupancy của người cũ còn ACTIVE. Khách mới không đặt được slot.
Từ 17/12	releasesBefore trả về true, slot hiện là trống với availableFrom = 1/1. Khách mới đặt cọc được. Manager vẫn gia hạn được nếu chưa ai đặt.
Khách mới đặt cọc xong	createSlotContracts tạo contract DRAFT cho slot với startDate = 1/1. Sau khi duyệt evidence thì contract thành ACTIVE. Lúc này cùng một slot có 2 contract nhưng khoảng thời gian không chồng nhau.
1/1 lúc 00:05	Job expire: contract cũ ACTIVE → EXPIRED, occupancy cũ → ENDED, ContractTenant cũ → LEFT.
Từ 1/1	Người mới nhận phòng, slot thuộc về họ.
3 điểm phải xử lý trong code

1. renew phải chặn khi slot đã có người đặt sau.
Plan U6 cho gia hạn bất kỳ lúc nào khi ACTIVE, nhưng chưa tính trường hợp slot đã được nhả và có người đặt. Nếu không chặn thì 2 người cùng có contract cho slot đó từ 1/1. Trước khi tạo contract mới, kiểm tra:

java
// có booking đang giữ/đã cọc, hoặc contract DRAFT/ACTIVE khác cùng slot, bắt đầu sau endDate cũ?
if (existsOtherClaim(contract.getRoomSlotId(), contract.getEndDate())) {
    throw new ConflictException("Slot đã có người đặt sau hợp đồng này, không thể gia hạn");
}

Chiều ngược lại tự an toàn: renew đã kéo dài endDate của occupancy, nên khách đặt sau đó bị ensureNoOccupancyOverlap chặn.

Còn race giữa renew và đặt cọc đồng thời: sau khi claim renewedToContractId thì kiểm tra lại một lần. Nếu phát hiện có claim khác thì trả renewedToContractId về null và báo lỗi.

2. Job expire chỉ end đúng occupancy của người cũ.
Đây là lỗi trong ví dụ activeFor tôi đưa lúc nãy. Hàm đó chỉ lọc theo slot và ACTIVE. Nếu người mới đã có occupancy ACTIVE (bắt đầu 1/1) thì nó cũng bị end() nhầm. Cần lọc thêm theo contract:

nếu RoomSlotOccupancy có contractId: lọc contractId == contract.getId();
nếu không: lọc occupancy.getEndDate().equals(contract.getEndDate()).

3. Contract đã gia hạn thì job chỉ đổi status.
Contract cũ có renewedToContractId != null sẽ qua endDate cũ, nhưng occupancy đã được kéo dài cho contract mới. Quy tắc cho job:

java
contract.setStatus(EXPIRED);
if (contract.getRenewedToContractId() == null) {
    occupancySupport.end(contract);   // chỉ end khi không có contract nối tiếp
    contractTenantSupport.markLeft(contract);
}

Cách này cũng giải quyết luôn phần “chốt cách tránh nhả nhầm” tôi nêu ở U10.

Cần kiểm tra trong code trước khi làm
RoomSlotOccupancy có field contractId không.
Occupancy của người mới được tạo lúc nào (khi contract ACTIVE hay lúc completeCheckIn). Nếu tạo khi completeCheckIn sau 1/1 thì điểm 2 ít rủi ro hơn, nhưng vẫn nên lọc theo contract.
availableFrom của slot đang nhả đúng bằng endDate + 1 (trong PublicRoomService.java:293).
Trường hợp phụ

Khách mới hết hạn giữ 24h hoặc hủy trước 1/1 thì không còn claim nào trên slot. Slot vẫn trong cửa sổ nhả để người khác đặt, và manager vẫn gia hạn được nếu contract cũ còn ACTIVE.
| **U8-new** | Field `Room.releaseLeadDays` + UI chỉnh per-room: xác nhận mở rộng scope sang module room + booking + public search? Có giới hạn giá trị (0–60)? | Đề xuất: Integer nullable, validate 0–60, default null = 14. Fallback ở mọi chỗ gọi. Đây là **thay đổi lớn nhất** của kế hoạch — nếu muốn tách thành task riêng, D chỉ dùng constant 14 toàn cục. UI: thêm field ở `manager-room-editor-page.tsx` (form sửa phòng) + request DTO `RoomUpdateRequest` (cần kiểm tra hiện có nhận field này không). |
Answer: Hiện tại giữ 14 ngày chức năng cho chỉnh sẽ làm sau 
| **U13-new** | Job expire của D và job thông báo E chạy cùng ngày; nếu expire chạy trước thì contract quá hạn bị EXPIRED nên E không gửi mốc (vì lọc `status=ACTIVE`). Điều này đúng ý (mốc 14/21/30/45 đều trước endDate nên không bị ảnh hưởng). Xác nhận giờ chạy: expire 00:05, notify 08:00. | Giữ expire 00:05, notify 08:00. |
Answer: Hai job không xung đột, vì các mốc thông báo (45/30/21/14 ngày) đều nằm trước endDate, còn expire chỉ xử lý contract đã quá endDate.

| **U14-new** | `detailPath` thông báo tenant trỏ `/user/contracts` hay `/tenant/contracts`? Cả 2 route tồn tại. | Đề xuất `/user/contracts` (theo account menu mới). Cần xác nhận. |
Answer sử dụng user
| **U15-new** | `kind` của thông báo: `TENANT_CONTRACT_EXPIRING` (mới) hay dùng `TENANT_CONTRACT` (có sẵn trong filter UI)? | Đề xuất `TENANT_CONTRACT` để hiện trong category "Hợp đồng" hiện có; tiêu đề ghi rõ "sắp hết hạn". |
Answer: TENANT_CONTRACT (có sẵn): đã nằm trong bộ lọc category “Hợp đồng” của UI, nên không cần sửa dropdown. Tiêu đề ghi rõ “sắp hết hạn” để phân biệt.
**Đã chốt từ câu trả lời trước:** U1 xóa toàn bộ createDraftFromBooking (manager+owner+admin); U2 chỉ manager/owner, bỏ admin; U3 các slot unavailable = đã đặt; U4 giữ 2 field renewed; U5 mở rộng ViewingNotificationsPage; U6 gia hạn bất kỳ lúc nào (khi ACTIVE); U7 tạo ContractTenant mới; U8 giữ 14 + thêm per-room config; U9 chỉ tenant; U10 quá hạn → EXPIRED (thêm job).

## 7. Rủi ro tổng thể

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Xóa `createDraftFromBooking` làm hỏng luồng tạo hợp đồng tự động | Thấp | Luồng tự động dùng `createSlotContracts` (private) tách biệt. **Lưu ý mới**: `createSlotContracts` gọi `contractService.nextContractNumber()` và `branchManagers` — không liên quan `createDraftFromBooking`. Build phát hiện import sót. |
| Xóa `serviceSnapshots` khi còn dùng | Trung bình | Grep `serviceSnapshots(` toàn repo trước khi xóa. Hiện `createDraftFromBooking` (`:167`) còn gọi; `createSlotContracts` dùng inline. Chỉ xóa nếu 0 caller khác. |
| Gia hạn tạo 2 hợp đồng (race) | Trung bình | Atomic `findAndModify` set `renewedToContractId`. |
| Job expire EXPIRED sai occupancy | Trung bình | Chốt U10-new trước; chỉ đụng occupancy của đúng slot contract. |
| Per-room releaseLeadDays vỡ availability | **Cao** | Thay đổi 3 chỗ gọi + public search; phải test kỹ; hoặc tách task riêng (U8-new). |
| Thông báo trùng | Thấp | `_id` sha256 + `expiryNotifiedMilestones` atomic. |
| Admin lộ chức năng renew | Thấp | `@PreAuthorize` chỉ OWNER/MANAGER. |
| Migration bị bỏ qua | Thấp | Không backfill; default null/[]/14 đúng nghĩa. |

## 8. Acceptance Criteria mapping

| AC | Nhóm | Ghi chú |
|---|---|---|
| Nút "Tạo hợp đồng" biến mất; endpoint/service/DTO xóa; `createSlotContracts` vẫn chạy | A | U1: xóa toàn bộ. |
| Slot đã đặt hiện "Đã được đặt", không hiện ngày available | B | 1 file. |
| ≤60 ngày badge nháy ở UI Manager/Owner; 61 ngày/đã hết hạn không hiện | C | Admin bị cô lập (U2). |
| Gia hạn tạo đúng 1 hợp đồng nối tiếp/slot + slot không bị mở lại đặt cọc | D | Kéo dài occupancy slot đó; job expire (U10). |
| Tenant nhận đúng 4 thông báo 45/30/21/14, không trùng | E | Resolve accountId từ email. |
| Build backend + frontend pass | Cả 5 | Sẽ chạy sau mỗi nhóm. |

---

**Dừng. Chờ duyệt Phase 1 (bản cập nhật 2026-11-12) và trả lời 5 mục mới U11-new, U10-new, U8-new, U14-new, U15-new trước khi sang Phase 2.** Không có file code/DB/test nào bị thay đổi bởi tài liệu này.