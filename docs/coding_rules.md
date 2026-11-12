# CODING RULES – PROJECT SBA301

> Quy chuẩn kiến trúc và coding conventions cho dự án SBA301. Các thành viên và công cụ hỗ trợ lập trình cần áp dụng nhất quán khi tạo mới, chỉnh sửa hoặc review Backend code.

## I. Architecture của dự án

- **Modular Monolith**

## II. Project Structure

```text
sba-project/
├── .env
├── .gitignore
├── docs
├── be-sba-project/
│   └── src/main/java/com/sba/project/
│       ├── SbaProjectApplication.java
│       ├── common/
│       │   ├── config/
│       │   ├── base/
│       │   │   ├── BaseEntity
│       │   │   ├── PagedResponse
│       │   │   └── ApiResponse
│       │   ├── exceptions/
│       │   │   └── GlobalExceptionHandler
│       │   ├── utils/
│       │   ├── security/
│       │   └── ...             # Chỉ thêm package khi có code dùng chung thực tế
│       └── modules/
│           ├── identity/
│           ├── property/
│           ├── leasing/
│           ├── utilities/
│           ├── billing/
│           │   ├── entity/
│           │   ├── enums/
│           │   ├── mapper/
│           │   ├── dto/
│           │   │   ├── request/
│           │   │   └── response/
│           │   ├── controller/
│           │   ├── repository/
│           │   ├── specifications/
│           │   └── service/
│           │       └── impl/
│           ├── payment/
│           ├── maintenance/
│           ├── notification/
│           ├── reporting/
│           └── community/      # Khi triển khai Phase 3
└── fe-sba-project/
    ├── public/
    ├── src/
    └── ...
```

*Minh họa package structure theo quy ước trong file gốc; các package thuộc `com.sba.project` tương ứng với thư mục Java source thực tế.*

## III. Backend Coding Rules

### Nguyên tắc chung

- Code Reusability: Không viết lặp logic có thể tái sử dụng.
- Single Responsibility: Mỗi thành phần nên có trách nhiệm rõ ràng.
- Business-Oriented Design: Thiết kế Service theo nghiệp vụ, không theo số lượng Entity.
- Keep Service Clean: Ưu tiên tách mapping sang MapStruct và đặt các quy tắc nghiệp vụ tại vị trí phù hợp.
- Avoid Overengineering: Không tạo thêm class, Service hoặc abstraction khi chưa có nhu cầu thực tế.

---

### RULE 01: Reusable DTO Mapping with MapStruct

#### 1. Quy tắc

- Ưu tiên sử dụng MapStruct để chuyển đổi dữ liệu giữa Entity, DTO và các đối tượng tương ứng.
- Không lặp lại các đoạn builder(), constructor hoặc setter dài để mapping cùng một cấu trúc DTO ở nhiều Service hoặc method.
- Đặt các mapping method có khả năng tái sử dụng trong package mapper.
- Service chỉ nên gọi Mapper, thay vì tự thực hiện từng phép gán field.
- Không đưa Business Logic (tính tiền, kiểm tra điều kiện nghiệp vụ, gọi Repository...) vào Mapper.
- Không cấm sử dụng Builder. Builder vẫn phù hợp khi tạo đối tượng có nhiều field hoặc dữ liệu cần xây dựng thủ công. Mục tiêu là tránh lặp lại mapping code, không phải loại bỏ Builder hoàn toàn.

#### 2. Tại sao cần áp dụng?

- Clean Code: Giúp Service ngắn gọn, dễ đọc và tập trung vào Business Logic.
- Reusability: Một Mapper có thể được tái sử dụng ở nhiều Service hoặc method.
- Maintainability: Khi thay đổi cấu trúc mapping, chỉ cần chỉnh sửa tại một nơi.
- Reduce Boilerplate: MapStruct tự động sinh implementation trong quá trình compile, giảm code chuyển đổi thủ công.
- Type Safety: Nhiều lỗi mapping có thể được phát hiện ngay khi compile.

#### 3. Ví dụ

- Không nên: Viết mapping trực tiếp trong Service.

```java
@Override
public OrderResponse getOrder(Long id) {
    Order order = orderRepository.findById(id)
            .orElseThrow();

    return OrderResponse.builder()
            .id(order.getId())
            .orderCode(order.getOrderCode())
            .totalAmount(order.getTotalAmount())
            .status(order.getStatus())
            .build();
}
```

- Nên: Tạo OrderMapper bằng MapStruct.

```java
@Mapper(componentModel = "spring")
public interface OrderMapper {
    OrderResponse toResponse(Order order);
}
```

- Sử dụng Mapper trong OrderServiceImpl (inject thông qua constructor):

```java
@Override
public OrderResponse getOrder(Long id) {
    Order order = orderRepository.findById(id)
            .orElseThrow();

    return orderMapper.toResponse(order);
}
```

- Lưu ý: MapStruct có thể tự map các field cùng tên và kiểu tương thích. Nếu tên khác nhau hoặc mapping cần nhiều nguồn dữ liệu, sử dụng @Mapping để cấu hình rõ ràng.

---

### RULE 02: Business-Oriented Service & Aggregate Root

#### 1. Quy tắc

- Khi một Entity chứa nhiều đối tượng chi tiết có dữ liệu hoặc vòng đời cần quản lý riêng, nên mô hình hóa các đối tượng đó bằng Entity hoặc Value Object phù hợp.
- Ví dụ: Một Order có nhiều OrderItem để lưu thông tin chi tiết từng sản phẩm trong đơn hàng.
- Không bắt buộc mỗi Entity phải có một Service tương ứng.
- Thiết kế Service dựa trên Business Logic và Use Case, không chỉ dựa trên số lượng Entity.
- Nếu OrderItem thuộc Aggregate của Order, các thao tác làm thay đổi OrderItem nên được kiểm soát thông qua Order và nghiệp vụ trong OrderService.
- Chỉ tách OrderItemService khi có nghiệp vụ đủ độc lập hoặc phức tạp để cần Service riêng.
- Có thể sử dụng OrderItemRepository để truy vấn dữ liệu mà không cần tạo OrderItemService.

#### 2. Tại sao cần áp dụng?

- Separation of Concerns: Phân chia trách nhiệm theo nghiệp vụ thực tế.
- Maintainability: Tránh tạo quá nhiều Service không cần thiết.
- Data Consistency: Giúp kiểm soát tính nhất quán giữa Order và các OrderItem.
- Business Encapsulation: Các quy tắc về trạng thái đơn hàng, sản phẩm và tổng tiền được quản lý tập trung.
- Scalability: Dễ mở rộng nghiệp vụ mà không làm phân tán logic sang quá nhiều Service.

#### 3. Ví dụ

- Entity Relationship:

```text
Order (Aggregate Root)
  |
  |--- OrderItem 1
  |--- OrderItem 2
  |--- OrderItem 3
```

- Order: Lưu thông tin chung (ID, mã đơn, khách hàng, tổng tiền, trạng thái).
- OrderItem: Lưu chi tiết sản phẩm (ID, Order ID, Product ID, số lượng, đơn giá).
- Không nên: Tạo Service riêng cho từng Entity một cách máy móc.

```text
service/
  OrderService.java
  OrderItemService.java
```

- Nên: Nếu OrderItem không có nghiệp vụ độc lập, chỉ sử dụng:

```text
entity/
  Order.java
  OrderItem.java
repository/
  OrderRepository.java
  OrderItemRepository.java  (nếu cần)
service/
  OrderService.java
service/impl/
  OrderServiceImpl.java
```

- Ví dụ OrderService:

```java
public interface OrderService {
    OrderResponse createOrder(CreateOrderRequest request);
    OrderResponse getOrder(Long orderId);
    OrderResponse updateItemQuantity(
            Long orderId,
            Long itemId,
            int quantity
    );
    void cancelOrder(Long orderId);
}
```

- Trong OrderServiceImpl, việc cập nhật OrderItem vẫn thuộc nghiệp vụ Order:

```java
@Override
@Transactional
public OrderResponse updateItemQuantity(
        Long orderId,
        Long itemId,
        int quantity
) {
    Order order = orderRepository.findById(orderId)
            .orElseThrow();

    // Domain method kiểm tra trạng thái,
    // cập nhật item và tính lại tổng tiền.
    order.changeItemQuantity(itemId, quantity);

    return orderMapper.toResponse(order);
}
```

- Lưu ý: Aggregate Root là một lựa chọn thiết kế theo DDD, không bắt buộc cho mọi quan hệ One-to-Many. Cần đánh giá tính độc lập, vòng đời và quy tắc nghiệp vụ trước khi quyết định tách Service.

---

### RULE 03: DTO-Based Layer Communication

#### 1. Quy tắc

- Controller sử dụng Request DTO để nhận dữ liệu và Response DTO để trả kết quả.
- Các public method phục vụ nghiệp vụ trong Service Interface và ServiceImpl nên sử dụng DTO thay vì trực tiếp nhận hoặc trả về Entity.
- Không trả JPA Entity trực tiếp cho Frontend.
- Entity chỉ nên được sử dụng nội bộ tại các tầng phù hợp, chẳng hạn Repository, ServiceImpl và Mapper.
- Cho phép truyền ID, enum hoặc các kiểu dữ liệu đơn giản khi phù hợp, không bắt buộc mọi method đều phải nhận DTO.

---

### RULE 04: Controller Depends on Service Interface

#### 1. Quy tắc

- Controller chỉ gọi các nghiệp vụ thông qua Service Interface.
- Không inject hoặc gọi trực tiếp Repository hay ServiceImpl từ Controller.
- ServiceImpl chịu trách nhiệm triển khai nghiệp vụ và tương tác với Repository.
- Ưu tiên Constructor Injection thông qua @RequiredArgsConstructor.

---

### RULE 05: Reusable Base Components

#### 1. Quy tắc

- Tái sử dụng các class dùng chung trong package base, bao gồm:
  - `BaseEntity`: Chứa các thuộc tính chung cho Entity (ví dụ: ID, createdAt, updatedAt nếu được thiết kế dùng chung).
  - `ApiResponse<T>`: Chuẩn hóa cấu trúc phản hồi API.
  - `PagedResponse<T>`: Chuẩn hóa dữ liệu trả về khi phân trang.
- Không tạo các class trùng chức năng với những Base Components đã có.
- Các Entity nên kế thừa BaseEntity khi phù hợp với cấu trúc dữ liệu và cơ chế định danh.
- Với schema `rental` hiện hành: BaseEntity chỉ chứa `Instant createdAt/updatedAt`, không có `isDeleted` hoặc ID chung. Chỉ entity có đủ hai cột trong DDL mới kế thừa; các entity khác ánh xạ trực tiếp cột thực tế. Quyết định này được xác nhận khi dựng foundation.
- Các API thông thường sử dụng `ApiResponse<T>`, kết hợp `PagedResponse<T>` khi trả về danh sách có phân trang.

#### 2. Tại sao cần áp dụng?

- Đảm bảo tính thống nhất giữa các module.
- Giảm code trùng lặp.
- Frontend dễ xử lý response theo một cấu trúc thống nhất.
- Dễ bảo trì và mở rộng.

---

### RULE 06: Dynamic Search with JPA Specification

#### 1. Quy tắc

- Đối với các chức năng Search/Filter có điều kiện linh hoạt, ưu tiên sử dụng Spring Data JPA Specification.
- Đặt các Specification class trong package specifications.
- Không viết lại logic filter giống nhau ở nhiều Service hoặc Repository.
- Kết hợp Specification với Pageable khi cần tìm kiếm có phân trang.
- Không bắt buộc sử dụng Specification cho các truy vấn đơn giản như findById() hoặc existsById().

#### 2. Tại sao cần áp dụng?

- Dễ mở rộng điều kiện tìm kiếm.
- Tái sử dụng các điều kiện lọc.
- Tránh viết quá nhiều Repository method hoặc JPQL query gần giống nhau.
- Dễ kết hợp Search, Filter, Sort và Pagination.

#### 3. Ví dụ đơn giản

- Thay vì tạo nhiều method:

```java
findByName(...)
findByCategory(...)
findByNameAndCategory(...)
findByNameAndCategoryAndPrice(...)
```

- Sử dụng Specification để kết hợp linh hoạt các điều kiện lọc:

```java
Specification<Product> spec = Specification
        .where(ProductSpecifications.hasName(name))
        .and(ProductSpecifications.hasCategory(categoryId));
Page<Product> products =
        productRepository.findAll(spec, pageable);
```

---

### RULE 07: Global Exception Handling

#### 1. Quy tắc

- Sử dụng `@RestControllerAdvice` với `GlobalExceptionHandler` trong `common.exceptions` để xử lý lỗi tập trung.
- Các lỗi nghiệp vụ cần dùng custom exception và mã lỗi (error code) thống nhất, thay vì ném `RuntimeException` chung chung hoặc tự tạo nội dung lỗi tùy ý.
- Chuẩn hóa error response bằng `ApiResponse<T>` trong package `common.base` (theo cấu trúc đã thống nhất của dự án).
- Contract hiện hành: `status` là HTTP status; `code=0` khi thành công, mã lỗi ứng dụng từ `1000`, không trùng nhau; `message` là thông báo công khai; `data` chứa payload. Xem [quy ước response và mã lỗi](backend/ERROR_RESPONSES.md).
- Không đặt nhiều khối `try-catch` trùng lặp trong Controller chỉ để chuyển lỗi thành HTTP response; chỉ bắt exception cục bộ khi thực sự cần khôi phục hoặc xử lý khác biệt.
- Không trả stack trace, SQL statement hoặc thông tin nội bộ nhạy cảm cho client. Lỗi hệ thống cần được ghi log phù hợp để hỗ trợ debug.

#### 2. Tại sao cần áp dụng?

- **Consistency:** Frontend nhận response lỗi theo một định dạng thống nhất.
- **Separation of Concerns:** Service tập trung vào nghiệp vụ, GlobalExceptionHandler phụ trách chuyển exception thành HTTP response.
- **Maintainability:** Có thể thay đổi cấu trúc lỗi, HTTP status và thông điệp tại một nơi.
- **Security:** Giảm nguy cơ lộ chi tiết kỹ thuật nội bộ thông qua response.

#### 3. Ví dụ đơn giản

```text
Client -> OrderController -> OrderService
                                |
                                +-- Không tìm thấy đơn hàng
                                        |
                                        v
                                  OrderNotFoundException
                                        |
                                        v
                              GlobalExceptionHandler
                                        |
                                        v
                       HTTP 404 + ApiResponse (error code/message)
```

**Lưu ý:** Tên `OrderNotFoundException` chỉ minh họa; có thể dùng hệ thống custom exception và error code chung theo thiết kế thực tế của dự án.

---

### RULE 10: Modular Monolith Boundaries

#### 1. Quy tắc

- Tổ chức Backend theo các module nghiệp vụ nằm trong `modules` như `identity`, `property`, `leasing`, `billing`, `payment`, ...; mỗi module quản lý trách nhiệm thuộc phạm vi của mình.
- Không truy cập trực tiếp Repository hoặc thay đổi Entity nội bộ của module khác từ Service của module hiện tại. Ưu tiên sử dụng public Service Interface hoặc API nội bộ được module sở hữu công khai.
- Các thành phần dùng chung thực sự được đặt tại `common`; không di chuyển business logic riêng của một module vào `common` chỉ để nhiều module gọi được.
- Hạn chế phụ thuộc vòng giữa các module. Nếu hai module gọi lẫn nhau, xem xét điều chỉnh ranh giới nghiệp vụ hoặc thiết kế cơ chế phối hợp phù hợp.
- Chỉ tách module hoặc abstraction mới khi có ranh giới và nhu cầu nghiệp vụ rõ ràng; không biến Modular Monolith thành các module phụ thuộc chặt chẽ vào nhau.

#### 2. Tại sao cần áp dụng?

- **Low Coupling:** Giảm phụ thuộc giữa các module.
- **Maintainability:** Dễ sửa đổi và kiểm thử một module mà không ảnh hưởng diện rộng.
- **Data Ownership:** Quy tắc nghiệp vụ và quyền thay đổi dữ liệu được kiểm soát tại module sở hữu.
- **Scalability:** Dễ mở rộng chức năng mà vẫn giữ cấu trúc rõ ràng.

#### 3. Ví dụ đơn giản

**Không nên:** `BillingServiceImpl` truy cập trực tiếp `PropertyRepository` của module `property` để thay đổi dữ liệu thuộc quyền quản lý của module đó.

**Nên:** `BillingServiceImpl` gọi `PropertyService` (interface/API nội bộ do module `property` cung cấp) nếu cần một nghiệp vụ hoặc thông tin liên quan đến property.

```text
modules/
├── property/
│   ├── service/PropertyService.java     # Hợp đồng được module công khai
│   └── repository/PropertyRepository.java  # Nội bộ module property
└── billing/
    └── service/impl/BillingServiceImpl.java
             |
             +----> PropertyService (interface)
```

**Lưu ý:** Quan hệ giữa các module cần được xác định từ use case thực tế; không bắt buộc tạo Service riêng chỉ để truy xuất một field nếu đã có abstraction phù hợp.

---

### RULE 12: No Hardcoded Configuration & Secrets

#### 1. Quy tắc

- Không hardcode hoặc commit mật khẩu, API key, JWT secret, database credentials, access token hoặc các thông tin nhạy cảm khác vào source code, `application.properties`, `application.yml` hay tài liệu công khai.
- Đọc cấu hình bí mật qua environment variables hoặc công cụ quản lý secrets phù hợp từng môi trường.
- Đặt file `.env` chứa giá trị thực trong `.gitignore`; chỉ commit file `.env.example` với các key và giá trị mẫu không nhạy cảm nếu cần chia sẻ cấu hình cho nhóm.
- Với các cấu hình thông thường không nhạy cảm, có thể giữ giá trị mặc định rõ ràng trong file cấu hình khi phù hợp.
- Không ghi thông tin bí mật vào log, error response hoặc thông báo debug. Nếu vô tình làm lộ secret, phải thu hồi/thay đổi secret đó thay vì chỉ xóa khỏi commit mới nhất.

#### 2. Tại sao cần áp dụng?

- **Security:** Giảm nguy cơ rò rỉ tài khoản, dữ liệu và quyền truy cập hệ thống.
- **Environment Separation:** Dễ dùng cấu hình khác nhau cho Development, Testing và Production.
- **Collaboration:** Thành viên mới có thể thiết lập môi trường theo `.env.example` mà không phải chia sẻ secret qua Git.
- **Maintainability:** Không cần sửa source code khi thay đổi credentials hoặc cấu hình triển khai.

#### 3. Ví dụ đơn giản

**Không nên:**

```properties
spring.datasource.password=actual_password
jwt.secret=actual_secret
```

**Nên:** Tham chiếu biến môi trường từ cấu hình Spring Boot.

```properties
spring.datasource.password=${DB_PASSWORD}
jwt.secret=${JWT_SECRET}
```

File `.env.example` (chỉ là mẫu, không chứa giá trị thật):

```dotenv
DB_PASSWORD=replace_with_local_password
JWT_SECRET=replace_with_local_secret
```

**Lưu ý:** Spring Boot không tự động nạp mọi file `.env` theo cách Docker Compose hoặc thư viện dotenv thực hiện. Cần cấu hình cơ chế nạp biến môi trường thực tế cho môi trường chạy ứng dụng.
