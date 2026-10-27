# Rental Room Management – Backend

Backend quản lý phòng trọ: Spring Boot 4 + MongoDB Atlas, tổ chức theo kiến trúc **module** (giống NestJS): mỗi collection là một module độc lập có đủ document → repository → service → controller.

## 1. Chạy dự án

**Đăng ký/đăng nhập JWT và xác thực email:** xem [hướng dẫn đầy đủ](docs/AUTH.md), [code từng file](docs/AUTH_SOURCE.md) và [cấu hình mẫu](.env.example). Backend hiện yêu cầu thêm JWT_SECRET, FRONTEND_URL và SMTP. Các API quản lý `/api/v1/**` yêu cầu role MANAGER hoặc ADMIN; public signup chỉ cấp TENANT.

### Yêu cầu
- JDK 21 trở lên (đang dùng JDK 24)
- Không cần cài Maven, dùng `mvnw` có sẵn (Maven 3.9.11)

### Cấu hình biến môi trường
Toàn bộ backend nằm trong thư mục `be/`. Mọi lệnh bên dưới chạy **trong `be/`**.

Secret **không** commit lên git. Copy file mẫu và điền thông tin Mongo (hỏi leader để lấy URI):

```bash
cd be
cp .env.example .env
```

```properties
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net
MONGODB_DATABASE=rental_room_management
```

`application.yml` tự đọc file `.env` ở thư mục gốc. Biến môi trường thật của hệ thống sẽ được ưu tiên hơn `.env`.

### Chạy
```bash
./mvnw spring-boot:run
```

- API: `http://localhost:8080/api/v1/...`
- Swagger UI: `http://localhost:8080/swagger-ui.html` khi `PUBLIC_API_DOCS=true`; dùng nút Authorize để nhập access token.

### IntelliJ
- Mở thư mục `be/` (khuyến nghị). Nếu mở thư mục gốc repo: chuột phải `be/pom.xml` → **Add as Maven Project**.
- Nếu code báo đỏ hàng loạt: tab **Maven → Reload All Maven Projects**; vẫn đỏ thì **File → Invalidate Caches → Restart**.
- Cài plugin **Lombok** và bật *Settings → Build → Compiler → Annotation Processors → Enable annotation processing*.

## 2. Cấu trúc thư mục

```
src/main/java/com/kitolam/rentalroommanagement
├── RentalRoomManagementApplication.java
├── common/                         # Dùng chung cho mọi module, KHÔNG chứa nghiệp vụ
│   ├── base/
│   │   ├── BaseDocument.java       # id, createdAt, updatedAt, deletedAt, isDeleted
│   │   ├── BaseRepository.java     # findByIdAndIsDeletedFalse, existsByIdAndIsDeletedFalse, findWithPagination
│   │   ├── BaseRepositoryImpl.java # Cài đặt findWithPagination (đăng ký ở MongoConfig)
│   │   ├── StandardResponse.java   # Format response chung { success, message, data, timestamp }
│   │   └── PagedResponse.java      # Format phân trang chung
│   ├── config/                     # OpenAPI, CORS, Mongo (auditing, transaction)
│   ├── exception/
│   │   ├── GlobalExceptionHandler.java
│   │   └── exceptions/             # AppException + BadRequest/NotFound/Conflict/Forbidden/...
│   ├── util/
│   │   └── MongoQueryHelper.java   # Build query động, phân trang, check trùng (bỏ qua bản ghi đã xoá)
│   └── validation/
│       └── ValidObjectId.java      # @ValidObjectId cho các field id tham chiếu
└── modules/                        # Mỗi collection = 1 module
    ├── room/
    │   ├── controller/             # RoomController         → /api/v1/rooms
    │   ├── service/                # RoomService (interface)
    │   │   └── impl/               # RoomServiceImpl        → viết logic ở đây
    │   ├── repository/             # RoomRepository extends BaseRepository<Room>
    │   ├── document/               # Room extends BaseDocument (+ class embedded nếu có)
    │   ├── enums/                  # RoomStatus, ...
    │   └── dto/
    │       ├── request/            # RoomCreateRequest, RoomUpdateRequest, RoomFilterRequest
    │       └── response/           # RoomResponse
    ├── branch/  roomtype/  manager/  roomslot/  furniture/  shift/
    ├── serviceitem/  roomservice/  slotservice/
    ├── tenant/  booking/  contract/  contracttenant/  roomslotoccupancy/
    ├── roomservicecharge/  slotservicecharge/  invoice/  payment/
    ├── appointment/
    └── reportrequest/  reportrequestservice/  reportrequestfurniture/  reportrecord/
```

### Bảng module ↔ collection

| Module | Document | Collection | Endpoint |
|---|---|---|---|
| branch | Branch | branches | /api/v1/branches |
| roomtype | RoomType | room_types | /api/v1/room-types |
| manager | Manager | managers | /api/v1/managers |
| room | Room | rooms | /api/v1/rooms |
| roomslot | RoomSlot | room_slots | /api/v1/room-slots |
| furniture | Furniture | furnitures | /api/v1/furnitures |
| shift | Shift | shifts | /api/v1/shifts |
| serviceitem | ServiceItem | services | /api/v1/services |
| roomservice | RoomService | room_services | /api/v1/room-services |
| slotservice | SlotService | slot_services | /api/v1/slot-services |
| tenant | Tenant | tenants | /api/v1/tenants |
| booking | Booking | bookings | /api/v1/bookings |
| contract | Contract | contracts | /api/v1/contracts |
| contracttenant | ContractTenant | contract_tenants | /api/v1/contract-tenants |
| roomslotoccupancy | RoomSlotOccupancy | room_slot_occupancies | /api/v1/room-slot-occupancies |
| roomservicecharge | RoomServiceCharge (+ ChargeSegment, SegmentAllocation) | room_service_charges | /api/v1/room-service-charges |
| slotservicecharge | SlotServiceCharge (+ SlotChargeAllocation) | slot_service_charges | /api/v1/slot-service-charges |
| invoice | Invoice (+ InvoiceItem) | invoices | /api/v1/invoices |
| payment | Payment | payments | /api/v1/payments |
| appointment | Appointment | appointments | /api/v1/appointments |
| reportrequest | ReportRequest | report_requests | /api/v1/report-requests |
| reportrequestservice | ReportRequestServiceItem | report_request_services | /api/v1/report-request-services |
| reportrequestfurniture | ReportRequestFurniture | report_request_furnitures | /api/v1/report-request-furnitures |
| reportrecord | ReportRecord | report_records | /api/v1/report-records |

> `SERVICES` đặt tên class là `ServiceItem` để không trùng annotation `@Service` của Spring.

## 3. Quy ước code

### Phân tầng
`Controller → Service (interface) → ServiceImpl → Repository`

- **Controller** chỉ nhận request, gọi service, bọc kết quả bằng `StandardResponse`. Không viết logic ở đây.
- **Service** là interface; logic viết trong `service/impl`. Module khác cần dữ liệu thì **inject Service của module đó**, không inject thẳng Repository của module khác.
- **Repository** chỉ dùng trong module của nó. Query động (lọc nhiều điều kiện) dùng `MongoTemplate` + `MongoQueryHelper`.
- **Document không bao giờ trả thẳng ra API**, luôn map sang `XxxResponse`.

### Document (MongoDB)
- Mọi document `extends BaseDocument`.
- Field tham chiếu (`roomId`, `tenantId`, …) trong Java là `String` nhưng lưu dưới DB là **ObjectId**:
  ```java
  @Indexed
  @Field(targetType = FieldType.OBJECT_ID)
  private String roomId;
  ```
  Khi query theo field này phải đổi sang ObjectId: `MongoQueryHelper.toObjectId(id)` hoặc `addObjectIdEquals(...)`.
- Tiền tệ dùng `BigDecimal` + `@Field(targetType = FieldType.DECIMAL128)`, **không dùng double**.
- Ngày nghiệp vụ dùng `LocalDate`, mốc thời gian dùng `Instant`.
- Object con (embedded) như `InvoiceItem` nằm trong `document/` của module cha, không có collection riêng.

### Xoá mềm (soft delete)
- Không xoá cứng. Gọi `document.markDeleted()` rồi `save` (set `isDeleted = true`, `deletedAt = now`).
- **Mọi query đọc phải lọc `isDeleted = false`**: dùng `findByIdAndIsDeletedFalse` hoặc `MongoQueryHelper.baseCriteria()`.
- Các module nghiệp vụ cũ kiểm tra trùng bằng `MongoQueryHelper.existsOther(...)`. Riêng **auth dùng unique index email/phone** để chống request đồng thời; định danh của user đã xóa mềm vẫn được giữ.

### DTO
- Dùng `record` + Bean Validation (`@NotBlank`, `@NotNull`, `@ValidObjectId`, …).
- `CreateRequest`: field bắt buộc khi tạo. Các field trạng thái (`status`) **không** có ở đây, server tự gán mặc định.
- `UpdateRequest`: dùng cho `PATCH`, field nào `null` thì **giữ nguyên** giá trị cũ.
- `FilterRequest`: tham số query cho API tìm kiếm (`?status=ACTIVE&keyword=abc`).
- `Response`: không bao giờ chứa field nhạy cảm (`passwordHash`).

### Response & lỗi
Response thành công của các module nghiệp vụ cũ dùng format:
```json
{ "success": true, "message": "Thành công", "data": { ... }, "timestamp": "..." }
```

Module auth dùng DTO response mô tả trong [AUTH.md](docs/AUTH.md). Toàn bộ response lỗi hiện thống nhất `{ "status": 400, "message": "...", "timestamp": "..." }`; client cũ cần cập nhật cách đọc lỗi.
- Lỗi nghiệp vụ: ném exception trong `common/exception/exceptions`, **không** tự build `ResponseEntity` lỗi:

  | Exception | HTTP |
  |---|---|
  | `BadRequestException` | 400 |
  | `UnauthorizedException` | 401 |
  | `ForbiddenException` | 403 |
  | `NotFoundException` | 404 |
  | `ConflictException` | 409 |
  | `TooManyRequestsException` | 429 |
  | `InternalServerErrorException` | 500 |

- Method service chưa làm đang `throw new UnsupportedOperationException` → API trả **501**. Làm xong thì xoá dòng đó.

### Phân trang
`GET /api/v1/rooms?page=1&size=20&sort=createdAt,desc`, trang bắt đầu từ **1**, tối đa 100 bản ghi/trang.

Mọi repository có sẵn `findWithPagination` (tự lọc `isDeleted = false`):

```java
// Lấy tất cả
Page<Room> page = roomRepository.findWithPagination(pageable);

// Kèm điều kiện. Field tham chiếu phải so sánh bằng ObjectId
Criteria criteria = Criteria.where("branchId").is(MongoQueryHelper.toObjectId(filter.branchId()))
        .and("status").is(RoomStatus.AVAILABLE.name());
Page<Room> page = roomRepository.findWithPagination(criteria, pageable);

return PagedResponse.from(page, this::toResponse);
```

### Đặt tên
| Thành phần | Quy tắc | Ví dụ |
|---|---|---|
| Package module | chữ thường, liền | `roomservicecharge` |
| Collection | snake_case số nhiều | `room_service_charges` |
| Endpoint | kebab-case số nhiều | `/api/v1/room-service-charges` |
| Field / JSON | camelCase | `contractTenantId` |
| Enum value | UPPER_SNAKE | `PARTIALLY_PAID` |

## 4. Thêm module mới

1. Tạo `modules/<tên>/` với đủ các thư mục như trên.
2. `document/Xxx.java`: `@Document(collection = "...")`, `extends BaseDocument`.
3. `repository/XxxRepository.java`: `extends BaseRepository<Xxx>`.
4. DTO request/response trong `dto/`.
5. `service/XxxService.java` (interface) + `service/impl/XxxServiceImpl.java` (`@Service`).
6. `controller/XxxController.java`: `@RequestMapping("/api/v1/<tên-kebab>")`, `@Tag(name = "...")` để hiện trên Swagger.
7. Cập nhật bảng module ở mục 2 của README này.

## 5. Git
- **Không commit `.env`** (đã có trong `.gitignore`). Thêm biến mới thì cập nhật `.env.example`.
- Không commit `target/`, `.idea/`.
- `.gitignore` chính nằm ở thư mục gốc repo (dùng chung cho `be/` và `fe/`); `be/.gitignore` vẫn giữ cho riêng backend.
