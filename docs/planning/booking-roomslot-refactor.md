# Kế hoạch: chuyển booking sang RoomSlotId và occupancy làm nguồn availability

## Phạm vi và nguồn xác minh

- Backend được tra qua `be/.codegraph` (372 file được index, 5.191 nodes, 10.255 edges) và các đoạn source trả về bởi codegraph.
- Frontend được rà bằng tìm kiếm source có mục tiêu vì không có frontend `.codegraph`.
- Không tìm thấy `Gemini.md` trong repo.
- Có khác biệt giữa mô tả stack trong yêu cầu và repo đã kiểm tra: codegraph cho thấy Java Spring Boot với Spring Data MongoDB documents (`@Document`), còn yêu cầu mô tả PostgreSQL/RabbitMQ/Eureka. Root repo có `be/` và `fe/`; không thấy service `ticket`, `product`, `showtime`, `identity` trong codegraph backend này. **[UNCLEAR — cần xác nhận đây là repo/stack đúng cho Phase 2]**
- Không sửa source, test, cấu hình hay database trong Phase 1. Tài liệu này là artifact duy nhất được tạo.

## 1. Bản đồ hiện trạng

### Backend

| Thành phần | Đường dẫn | Hiện trạng theo codegraph |
|---|---|---|
| `Booking` | `be/src/main/java/com/kitolam/rentalroommanagement/modules/booking/document/Booking.java` | MongoDB `bookings`; có `roomId`, ngày thuê, tiền cọc, `paymentDeadline`, `holdExpiresAt`, `depositStatus`, `status`, timeline. Chưa thấy `bookingType` hoặc `roomSlotId`. |
| `BookingRepository` | `be/src/main/java/com/kitolam/rentalroommanagement/modules/booking/repository/BookingRepository.java` | Overlap query dùng `roomId` + trạng thái + ngày; có query hết hạn theo `holdExpiresAt`/`paymentDeadline`; chưa thấy query overlap theo slot hoặc occupancy. |
| `BookingService` / `BookingServiceImpl` | `be/src/main/java/com/kitolam/rentalroommanagement/modules/booking/service/BookingService.java`; `.../service/impl/BookingServiceImpl.java` | `create` resolve `Room` bằng `request.roomId()`, check overlap qua `BookingRepository`, sau đó lưu `REQUESTED`/`UNPAID`. Có các method availability, review, terms, cancel, payment, expiry và refund. `create` đang dùng `roomId` làm resource chính. |
| `BookingController` | `be/src/main/java/com/kitolam/rentalroommanagement/modules/booking/controller/BookingController.java` | `GET /api/v1/bookings/availability` nhận `roomId`, `startDate`, `endDate`; `POST /api/v1/bookings` nhận `BookingCreateRequest`. Các endpoint payment/review/cancel cùng nằm ở controller này. |
| Booking DTO | `be/src/main/java/com/kitolam/rentalroommanagement/modules/booking/dto/request/BookingCreateRequest.java`; `.../BookingReviewRequest.java`; `.../BookingFilterRequest.java`; `be/src/main/java/com/kitolam/rentalroommanagement/modules/booking/dto/response/BookingResponse.java`; `.../RoomAvailabilityResponse.java` | `BookingCreateRequest` được codegraph mô tả là nhận `roomId`; availability nhận `roomId`; cần cập nhật request/response/filter theo contract đích. |
| Booking/deposit status | `be/src/main/java/com/kitolam/rentalroommanagement/modules/booking/enums/BookingStatus.java`; `.../DepositStatus.java` | `BookingStatus` có `REQUESTED`, `AWAITING_PAYMENT`, `CONFIRMED`, `CONVERTED`, `EXPIRED`, `CANCELLED`, `REJECTED`, `PENDING`, `APPROVED`. `DepositStatus` có `UNPAID`, `PROCESSING`, `PAID`, `REFUNDED`, `FORFEITED`. |
| `RoomSlot` | `be/src/main/java/com/kitolam/rentalroommanagement/modules/roomslot/document/RoomSlot.java` | MongoDB `room_slots`; có `roomId`, `slotCode`, `slotNumber`, `RoomSlotStatus` (mặc định `AVAILABLE`). |
| `RoomSlotRepository` / service | `be/src/main/java/com/kitolam/rentalroommanagement/modules/roomslot/repository/RoomSlotRepository.java`; `.../service/RoomSlotService.java`; `.../service/impl/RoomSlotServiceImpl.java` | Repository hiện chỉ kế thừa `BaseRepository`; `RoomSlotServiceImpl` CRUD đang TODO và ném `UnsupportedOperationException`. |
| `RoomSlotOccupancy` và `OccupancyStatus` | `be/src/main/java/com/kitolam/rentalroommanagement/modules/roomslotoccupancy/document/RoomSlotOccupancy.java`; `.../enums/OccupancyStatus.java` | Tên class thật là `RoomSlotOccupancy`, collection `room_slot_occupancies`; có `roomSlotId`, `contractTenantId`, `startDate`, `endDate`, status `ACTIVE`/`ENDED`. Chưa thấy `bookingId`, thời hạn giữ chỗ hoặc trạng thái hold. |
| Occupancy repository/service/controller | `be/src/main/java/com/kitolam/rentalroommanagement/modules/roomslotoccupancy/repository/RoomSlotOccupancyRepository.java`; `.../service/RoomSlotOccupancyService.java`; `.../service/impl/RoomSlotOccupancyServiceImpl.java`; `.../controller/RoomSlotOccupancyController.java` | `RoomSlotOccupancyRepository` chưa có query interval trong codegraph. Các method CRUD trong `RoomSlotOccupancyServiceImpl` đang TODO. Controller hiện có CRUD occupancy. |
| Payment | `be/src/main/java/com/kitolam/rentalroommanagement/modules/payment/document/Payment.java`; `.../repository/PaymentRepository.java` | `Payment` đã có `bookingId`, `amount`, `method`, `transactionCode`, `status`, `paidAt`; không cần thêm liên kết booking–payment cho chuyển sang slot. |
| Event | `be/src/main/java/com/kitolam/rentalroommanagement/modules/booking/event/BookingStatusChangedEvent.java`; `.../service/impl/BookingServiceImpl.java` | Có event class và `ApplicationEventPublisher` import/field. Codegraph không tìm thấy caller của event class hoặc `RabbitTemplate`/`RabbitListener`/`Amqp` trong booking. Vì vậy chưa xác nhận event được publish/consume hay có luồng RabbitMQ. |

**Ranh giới service/giao tiếp:** các thành phần booking, room slot, occupancy và payment nằm trong package/module của cùng backend Spring Boot đã index. `BookingController` gọi `BookingService`; booking service dùng repositories trực tiếp; controller còn gọi `VnPayService` cho payment URL. Không thấy bằng chứng Feign/REST liên service hoặc RabbitMQ trong codegraph booking. Không đủ căn cứ gọi đây là các microservice độc lập.

### Frontend

| File | Cách dùng hiện tại / điểm cần đổi |
|---|---|
| `fe/src/services/guest-user.ts` | `backendBookingSchema` yêu cầu `roomId`; `adaptBooking` hiện đặt `roomSlotId: null`, `rentalMode: 'ROOM'`. `bookingService.create` gửi `roomId`, ngày bắt đầu/kết thúc; availability gọi API bằng `roomId`. |
| `fe/src/features/leasing/create-shared.tsx` | `BookingForm` kiểm tra availability bằng `room.id`, gửi `{ roomId, startDate, endDate }`; chưa gửi slot được chọn. |
| `fe/src/features/leasing/create-booking-page.tsx` | Load room theo route `roomId` và truyền vào form. Route có thể tiếp tục dùng room làm navigation context; form cần có slot selection/consume slot id theo contract. |
| `fe/src/features/rooms/room-detail-page.tsx` | Đã có UI chọn slot và query parameter `slot`; cần đồng bộ lựa chọn đó với form đặt booking và API availability thật. |
| `fe/src/lib/validation.ts` | Schema request thực đang yêu cầu `roomId`; schema mock `bookingInputSchema` đã có `roomSlotId` cho `SLOT`. Cần thống nhất schema thực với contract backend. |
| `fe/src/interfaces/domain.ts` | `Booking` đã có `roomId`, nullable `roomSlotId`, `rentalMode`; availability response đã có `slots[]`. Có thể giữ `roomId` cho hiển thị/điều hướng nếu response backend vẫn trả trường suy ra từ slot. |
| `fe/src/mocks/database.ts` | Mock availability/booking đã kiểm tra slot overlap; không chứng minh backend thật dùng `RoomSlotOccupancy`. Không cần đổi mock trừ khi contract type buộc phải cập nhật. |
| `fe/src/features/leasing/booking-detail-page.tsx`; `fe/src/features/leasing/payment-page.tsx` | Booking detail dùng `roomId` để quay lại trang phòng; payment page hiển thị slot label nếu có, nhưng adapter thật hiện trả `null`. |

Các nguồn FE trên được tìm theo code có mục tiêu; không có frontend codegraph. Nhiều `roomId` khác trong FE thuộc lịch xem, manager room pages và tiện ích phòng; chưa có căn cứ đưa chúng vào phạm vi.

## 2. Mô hình dữ liệu và availability hiện tại

| Document/collection | Trường liên quan | Ý nghĩa thấy được |
|---|---|---|
| `Booking` / `bookings` | `roomId`, `expectedMoveInDate`, `expectedMoveOutDate`, `status`, `depositStatus`, `paymentDeadline`, `holdExpiresAt` | Booking hiện được kiểm tra trùng theo phòng và khoảng ngày. |
| `RoomSlot` / `room_slots` | `roomId`, `slotCode`, `slotNumber`, `status` | Slot thuộc một phòng; có trạng thái slot riêng. |
| `RoomSlotOccupancy` / `room_slot_occupancies` | `roomSlotId`, `contractTenantId`, `startDate`, `endDate`, `status` | Lượt ở theo slot; status hiện chỉ `ACTIVE`/`ENDED`. |

Rule availability hiện hữu trong `BookingServiceImpl.checkAvailability/create` là kiểm tra trạng thái hoạt động của `Room` và overlap booking theo `roomId`; không thấy truy vấn `RoomSlotOccupancy`. `RoomSlotOccupancyServiceImpl` chưa triển khai CRUD và repository chưa có query interval trong codegraph. Do đó target “occupancy là nguồn duy nhất” chưa được đáp ứng.

## 3. Thiết kế đích

### Schema/document đề xuất

| Collection | Thay đổi dự kiến | Tương thích dữ liệu cũ |
|---|---|---|
| `bookings` | Booking chỉ lưu `roomSlotId` làm resource key; bỏ `roomId` khỏi document, request và filter. Response có thể trả `roomId` suy ra từ `RoomSlot` chỉ để FE điều hướng/hiển thị, không dùng làm khóa nghiệp vụ. | Booking cũ chỉ có `roomId`; chưa có mapping an toàn sang slot nên không tự gán slot. |
| `room_slot_occupancies` | Thêm `bookingId`; thêm `RESERVED` để giữ slot từ lúc tạo `REQUESTED`; sau cancel/reject/expire, reservation chuyển `ENDED`. `ACTIVE` tiếp tục đại diện occupancy theo hợp đồng. | Occupancy cũ `ACTIVE`/`ENDED` tiếp tục chặn/không chặn theo khoảng ngày; không có booking id ngược. |
| `payments` | Không đổi: `Payment.bookingId` đã có. | Giữ nguyên. |

Reservation mới để `contractTenantId` trống cho tới khi có hợp đồng; `bookingId` xác định booking sở hữu reservation. Mỗi booking mới giữ đúng một `RoomSlotId`; nghiệp vụ thuê nguyên phòng được biểu diễn bằng slot tương ứng nếu inventory có cấu hình slot đó. **[UNCLEAR — cần xác nhận nếu còn yêu cầu booking một phòng qua nhiều slot]**

### API contract dự kiến

| API | Hiện tại | Đích đề xuất |
|---|---|---|
| `GET /api/v1/bookings/availability` | Query `roomId`, `startDate`, `endDate` | Query `roomSlotId`; trả availability theo `RoomSlotOccupancy`. Batch endpoint nhận nhiều `roomSlotIds` để FE nạp trạng thái slot trong một request. |
| `POST /api/v1/bookings` | `BookingCreateRequest` gửi `roomId` + ngày | Gửi `roomSlotId` + ngày; backend resolve slot. Không gửi `roomId`. |
| Booking response/filter | Có trường room hiện tại | Filter/resource key là `roomSlotId`; `roomId` trong response chỉ được suy ra từ `RoomSlot` phục vụ navigation cũ. |

Contract request cũ chỉ có `roomId` không thể tự ánh xạ an toàn sang một `roomSlotId`; API create và availability đổi sang `roomSlotId`. Consumer ngoài FE chưa được xác minh. **[UNCLEAR — cần rà consumer trước khi triển khai lên môi trường dùng chung]**

### Availability và trạng thái occupancy đề xuất

`RoomSlotOccupancy` trở thành nguồn duy nhất khi quyết định slot có xung đột hay không: repository query theo `roomSlotId`, khoảng ngày và nhóm status đang chặn slot. Tạo booking sẽ atomically tạo occupancy `RESERVED` liên kết `bookingId`; thanh toán/duyệt thành công chuyển booking và occupancy theo lifecycle; reject/cancel/expire giải phóng reservation; chuyển sang hợp đồng sẽ biến occupancy thành `ACTIVE` gắn `contractTenantId`. Các chuyển trạng thái này phải cùng transaction/đơn vị ghi nhất quán.

`ACTIVE` và `ENDED` hiện là enum duy nhất. `RESERVED` là trạng thái mới đề xuất; phân biệt `CANCELLED`/`EXPIRED` có thể để ở Booking và lưu occupancy là `ENDED` với lý do kết thúc, hoặc thêm enum values. Chọn phương án sau khi xác nhận yêu cầu audit/lịch sử. **[UNCLEAR — cần xác nhận cách lưu lý do kết thúc occupancy]**

### Concurrency

- Với MongoDB trong codegraph: dùng `MongoTransactionManager` đã có, claim document `RoomSlot` bằng optimistic `@Version`, rồi query overlap `RoomSlotOccupancy` và ghi booking/reservation trong cùng transaction. Request tranh chấp trả conflict.
- Nếu stack thực tế là PostgreSQL như mô tả: dùng row lock trên bản ghi `RoomSlot` trong transaction trước khi query/insert occupancy; mọi luồng ghi reservation phải dùng cùng lock. Constraint unique thông thường không chặn được overlap khoảng ngày tùy ý; exclusion constraint chỉ xem xét sau khi xác nhận database/version/extension và được duyệt.
- Nếu repo thực tế là backend PostgreSQL khác, không dùng thiết kế Mongo ở trên; **[UNCLEAR — cần xác nhận repo/stack chính thức]**.

## 4. Thay đổi dự kiến theo file và thứ tự

### Backend

1. `be/src/main/java/com/kitolam/rentalroommanagement/modules/roomslotoccupancy/document/RoomSlotOccupancy.java` — thêm `bookingId` và status `RESERVED`.
2. `be/src/main/java/com/kitolam/rentalroommanagement/modules/roomslotoccupancy/enums/OccupancyStatus.java` — thêm status `RESERVED`.
3. `be/src/main/java/com/kitolam/rentalroommanagement/modules/roomslotoccupancy/repository/RoomSlotOccupancyRepository.java` — thêm query overlap theo slot, range, status, và tìm reservation theo booking.
4. `be/src/main/java/com/kitolam/rentalroommanagement/modules/booking/document/Booking.java` — thay `roomId` bằng `roomSlotId`.
5. `be/src/main/java/com/kitolam/rentalroommanagement/modules/booking/repository/BookingRepository.java` — duplicate/query theo `roomSlotId`; không còn overlap theo `roomId`.
6. `be/src/main/java/com/kitolam/rentalroommanagement/modules/roomslot/document/RoomSlot.java`; `.../repository/RoomSlotRepository.java` — thêm optimistic version và truy vấn slot theo phòng/id để claim/resolve.
7. `be/src/main/java/com/kitolam/rentalroommanagement/modules/booking/dto/request/BookingCreateRequest.java`, `BookingFilterRequest.java`, `be/src/main/java/com/kitolam/rentalroommanagement/modules/booking/dto/response/BookingResponse.java`, `RoomAvailabilityResponse.java` — thêm trường slot và giữ các field cũ theo compatibility đã duyệt.
8. `be/src/main/java/com/kitolam/rentalroommanagement/modules/booking/service/BookingService.java`, `.../service/impl/BookingServiceImpl.java`, `.../controller/BookingController.java` — đổi resource key nghiệp vụ sang slot; mọi availability đi qua occupancy; create/cancel/expire đồng bộ booking+occupancy; bảo toàn role checks hiện có.
9. `be/src/main/java/com/kitolam/rentalroommanagement/modules/booking/event/BookingStatusChangedEvent.java` — chỉ cập nhật nếu payload event hiện dùng booking room key và codegraph/source xác nhận có consumer. Hiện chưa thấy subscriber hoặc RabbitMQ path, nên chưa đưa thay đổi event vào mặc định.

`Payment.java`/`PaymentRepository.java` không sửa vì `Payment.bookingId` đã tồn tại. `RoomSlotServiceImpl.search` được triển khai để FE lấy slot list; CRUD còn lại không đổi. Không đổi auth hoặc `cinema-common`.

### Frontend

1. `fe/src/services/guest-user.ts` — cập nhật real booking request/response adapter; gửi `roomSlotId`; list slot và gọi batch availability theo `roomSlotIds`.
2. `fe/src/features/leasing/create-shared.tsx` — sử dụng slot đã chọn/slot selection, gửi slot id và hiển thị availability từ API thật.
3. `fe/src/features/leasing/create-booking-page.tsx` — giữ `roomId` trong route để load trang phòng; form chỉ gửi `roomSlotId` tới API booking.
4. `fe/src/lib/validation.ts` — đồng bộ request schema real API với `roomSlotId`.
5. `fe/src/interfaces/domain.ts` — chuẩn hóa type/response nếu backend response thay đổi; giữ `roomId` presentation field trong transition.
6. `fe/src/features/rooms/room-detail-page.tsx` — chỉ sửa nếu cần đồng bộ response availability thật và query `slot`; UI slot selection hiện đã có.
7. `fe/src/features/leasing/booking-detail-page.tsx`, `payment-page.tsx` — chỉ sửa nếu response adapter mới không giữ đủ field hiển thị/navigation.

`fe/src/mocks/database.ts` không dự kiến sửa: mock đã có logic slot-level, còn acceptance chủ yếu cần real API. Không thêm/sửa/xóa file test.

## 5. Dữ liệu cũ, migration, rủi ro và kiểm chứng

### Migration dữ liệu

- Không tìm thấy Flyway/Liquibase hoặc file SQL/migration trong `.codegraph`; `be` có `pom.xml` và code document MongoDB. **[UNCLEAR — cần xác nhận có migration tool ngoài phần được index hay không]**
- Nếu dữ liệu là MongoDB: cần migration/backfill idempotent cho `bookings` cũ. Nhưng `roomId` hiện không nói booking cũ chiếm một slot hay toàn phòng; tự chọn slot sẽ làm sai dữ liệu. Chỉ thực hiện sau khi quyết định mapping cho lịch sử, policy booking nguyên phòng, và xác nhận backup/approval. Không chạy migration trong Phase 1.
- Nếu production thực là PostgreSQL: cần migration schema/data theo tool hiện có, nhưng tool/schema không có trong codegraph được kiểm tra. Không thể viết migration an toàn khi chưa xác định repo/service/database đúng.

### Rủi ro và phụ thuộc

| Rủi ro | Ảnh hưởng | Giảm thiểu/điểm cần chốt |
|---|---|---|
| MongoDB trong source nhưng PostgreSQL trong mô tả | Migration và locking design sai stack | Xác nhận service/repo/database chính thức trước Phase 2. |
| Booking lịch sử chỉ có `roomId` | Không thể xác định slot cho booking nhiều chỗ/thuê nguyên phòng | Chốt mapping, giữ legacy read-only hay chuyển thành occupancy theo từng slot. |
| Occupancy hiện chỉ `ACTIVE/ENDED`, `contractTenantId` | Chưa biểu diễn reservation chưa có hợp đồng/tenant contract id | Chốt status và nullability/linkage trước khi schema update. |
| `REQUESTED` giữ slot nhưng chưa có deadline | Request không được duyệt có thể chiếm slot không thời hạn | Chốt deadline xử lý yêu cầu hoặc cách owner giải phóng reservation. |
| API `roomId` hiện có consumer chưa liệt kê đầy đủ | Client cũ có thể không gửi slot | Rà consumer, giữ compatibility hoặc lên lịch breaking change có versioning/approval. |
| Event class không có consumer rõ ràng | Có thể vô tình đổi event contract hoặc kỳ vọng thông báo | Không dựa vào RabbitMQ/event cho tính đúng đắn; xác minh listener trước khi sửa event. |
| Concurrent create | Double booking nếu chỉ query rồi insert | Dùng slot-level atomic guard/transaction phù hợp stack; verify bằng cạnh tranh requests, không thêm test case theo constraint. |

### Kiểm chứng trong Phase 2

- Kiểm tra targeted search cho booking: không còn `roomId` là khóa availability/overlap; `roomId` còn lại chỉ presentation/parent-room lookup nếu cần.
- Kiểm tra mọi đường create/availability qua query `RoomSlotOccupancy` theo `roomSlotId` và interval.
- Build/compile backend và frontend; kiểm tra API flow thủ công/qua Swagger, không tạo hay sửa test case.
- Kiểm tra hai request cùng slot cạnh tranh bằng môi trường dev và xác nhận chỉ một request tạo reservation thành công; không chạy migration lên DB thật nếu chưa được duyệt.

## 6. `[UNCLEAR — cần xác nhận]`

1. **Repo/stack:** xác nhận repo `rental-room-management` này mới là nguồn cần triển khai chứ không phải backend PostgreSQL/RabbitMQ/Eureka khác. Codegraph/source hiện tại là backend Spring Data MongoDB.
2. **Quy tắc loại thuê:** yêu cầu hiện mô tả booking theo `RoomSlotId`, nhưng chưa nói `WHOLE_ROOM` có còn tồn tại hay một booking nguyên phòng sẽ tạo reservation cho tất cả slot. Điều này quyết định migration booking cũ và contract FE/API.
3. **Occupancy reservation:** xác nhận booking `REQUESTED` có giữ slot ngay hay chỉ sau Owner duyệt; nếu giữ ngay, request chờ duyệt cần deadline/giải phóng như thế nào. Cần quyết định `contractTenantId` null cho reservation và trạng thái occupancy terminal có cần phân biệt cancel/expire không.
4. **Compatibility/migration:** ngoài FE đã tìm thấy, còn service/client nào gọi `/api/v1/bookings` hoặc dùng `roomId` trong booking không? Cho phép thêm `roomSlotId` bắt buộc sau khi cập nhật FE, hay cần một giai đoạn tương thích cho request cũ?
5. **Migration tool/deployment:** xác nhận tool migration, môi trường DB và topology/transaction support thực tế. Codegraph không cho thấy migration tool; không chạy migration DB trong Phase 1.
