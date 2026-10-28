# Đăng ký, đăng nhập JWT và xác thực email

Triển khai trực tiếp trên backend hiện có: **Java 21, Spring Boot 4.1.2, Spring Security, MongoDB**. Sáu API sử dụng prefix `/api/v1/auth` đồng bộ với các module `/api/v1/**` khác.

## 1. Cây thư mục

Các đường dẫn Java dưới đây tương đối với `src/main/java/com/kitolam/rentalroommanagement/`.

```text
be/
├── pom.xml
├── .env.example
├── compose.auth.yml
├── scripts/
│   ├── auth-indexes.js
│   ├── auth-smoke.ps1
│   └── export-auth-source.ps1
├── docs/
│   ├── AUTH.md
│   └── AUTH_SOURCE.md
├── src/main/resources/application.yml
├── src/main/java/com/kitolam/rentalroommanagement/
│   ├── common/exception/
│   │   ├── ApiError.java
│   │   └── GlobalExceptionHandler.java
│   ├── security/
│   │   ├── SecurityConfig.java
│   │   ├── SecurityProperties.java
│   │   ├── PasswordConfig.java
│   │   ├── CorsConfig.java
│   │   ├── JwtProvider.java
│   │   ├── JwtAuthenticationFilter.java
│   │   ├── OpaqueTokenProvider.java
│   │   ├── AuthPrincipal.java
│   │   ├── AuthUserDetailsService.java
│   │   ├── SecurityErrorHandler.java
│   │   ├── SecurityExceptionHandler.java
│   │   ├── OpenApiSecurityConfig.java
│   │   └── validation/
│   │       ├── StrongPassword.java
│   │       └── StrongPasswordValidator.java
│   └── modules/auth/
│       ├── config/
│       │   ├── AuthConfig.java
│       │   └── AuthProperties.java
│       ├── controller/AuthController.java
│       ├── document/
│       │   ├── User.java
│       │   ├── Role.java
│       │   ├── VerificationToken.java
│       │   └── RefreshToken.java
│       ├── repository/
│       │   ├── UserRepository.java
│       │   ├── VerificationTokenRepository.java
│       │   ├── RefreshTokenRepository.java
│       │   └── AuthTokenStore.java
│       ├── dto/
│       │   ├── request/
│       │   │   ├── SignupRequest.java
│       │   │   ├── LoginRequest.java
│       │   │   ├── ResendVerificationRequest.java
│       │   │   └── RefreshTokenRequest.java
│       │   └── response/
│       │       ├── MessageResponse.java
│       │       └── TokenResponse.java
│       └── service/
│           ├── AuthService.java
│           ├── VerificationMailEvent.java
│           ├── VerificationMailService.java
│           └── impl/AuthServiceImpl.java
└── src/test/java/com/kitolam/rentalroommanagement/
    ├── auth/AuthIntegrationTest.java
    └── security/SecurityUnitTests.java
```

`common/config/CorsConfig.java` cũ đã được chuyển vào `security`. Cấu hình transaction và auditing MongoDB dùng lại từ `common/config/MongoConfig.java`.

## 2. Entity và cấu trúc dữ liệu

MongoDB sử dụng collection, không dùng DDL SQL. Entity đầy đủ nằm trong `modules/auth/document`; script tạo collection/index nằm ở [auth-indexes.js](../scripts/auth-indexes.js).

| Entity | Collection / kiểu lưu | Các trường chính |
|---|---|---|
| User | `users` | fullName, email, phone, passwordHash, role, enabled, emailVerified, termsAcceptedAt, lastVerificationSentAt |
| Role | Java enum lưu trong `users.role` | TENANT, MANAGER, ADMIN |
| VerificationToken | `verification_tokens` | tokenHash, userId, expiresAt, usedAt, purgeAt |
| RefreshToken | `refresh_tokens` | tokenHash, userId, expiresAt, revokedAt, purgeAt |

Các document kế thừa `BaseDocument`: id, createdAt, updatedAt, deletedAt, isDeleted. `userId` lưu BSON ObjectId. Role là tập giá trị cố định nên không cần collection riêng; public signup luôn gán `TENANT`.

Email được trim và lowercase; số di động `+84` được chuẩn hóa thành `0`. Validation chấp nhận 10 chữ số bắt đầu bằng 03/05/07/08/09, kiểm tra cấu trúc số di động, không xác minh số đã được nhà mạng cấp. Hai unique index email/phone chặn trùng cả khi request đồng thời. Trong module auth, email/phone của tài khoản đã xóa mềm vẫn được giữ, tránh tái sử dụng định danh ngoài ý muốn.

Refresh token và token email là 32 byte ngẫu nhiên từ `SecureRandom`, mã hóa Base64URL thành 43 ký tự. DB chỉ lưu SHA-256; khi kiểm tra dùng `MessageDigest.isEqual`. Với token ngẫu nhiên 256 bit, SHA-256 phù hợp; mật khẩu vẫn dùng BCrypt, mặc định cost 12. Giới hạn 72 byte UTF-8 tránh việc BCrypt xử lý quá giới hạn đầu vào.

TTL index đặt trên `purgeAt = expiresAt + 7 ngày`, giữ token hết hạn/đã dùng một thời gian để trả lỗi rõ ràng. Điều kiện hết hạn luôn được kiểm tra trong code, không phụ thuộc lịch chạy TTL của MongoDB. Sau khi bản ghi bị dọn, API trả token không hợp lệ.

MongoDB phải là **replica set** (Atlas cũng hỗ trợ) vì xác thực email, resend và refresh rotation dùng transaction nhiều document. Conditional update trong `AuthTokenStore` bảo vệ việc dùng token một lần và thời gian chờ resend. Khi hai request xung đột, request thua trả 401/400 hoặc 409 tùy thời điểm. Cơ chế transaction dựa trên [tài liệu Spring Data MongoDB](https://docs.spring.io/spring-data/mongodb/reference/mongodb/client-session-transactions.html).

## 3. Code đầy đủ từng file

[AUTH_SOURCE.md](AUTH_SOURCE.md) chứa toàn bộ code liên quan, gồm cả dependency, cấu hình, entity, repository, DTO, service, security, exception handler, test và script; đường dẫn file được ghi trước từng khối code.

Source thật trong `src/` là nơi chỉnh sửa. Sau khi sửa, xuất lại bản tổng hợp bằng:

```powershell
.\scripts\export-auth-source.ps1
```

## 4. Cấu hình

Mẫu đầy đủ: [.env.example](../.env.example), [application.yml](../src/main/resources/application.yml).

| Biến | Mặc định / ý nghĩa |
|---|---|
| MONGODB_URI / MONGODB_DATABASE | Replica set và tên DB |
| JWT_SECRET | Bắt buộc, Base64 của ít nhất 32 byte ngẫu nhiên |
| JWT_ACCESS_TTL | 15m |
| JWT_REFRESH_TTL | 7d |
| JWT_ISSUER / JWT_AUDIENCE | rental-room-management / rental-room-api |
| BCRYPT_STRENGTH | 12 |
| FRONTEND_URL | URL gốc frontend, dùng để tạo link email |
| CORS_ALLOWED_ORIGINS | Danh sách origin cách nhau bằng dấu phẩy, không dùng wildcard |
| EMAIL_VERIFICATION_TTL | 24h |
| EMAIL_RESEND_COOLDOWN | 60s |
| SMTP_HOST / SMTP_PORT | SMTP server / 587 |
| SMTP_USERNAME / SMTP_PASSWORD | Thông tin SMTP |
| SMTP_FROM | Email người gửi |
| SMTP_AUTH / SMTP_STARTTLS | true trên production; false cho Mailpit local |
| REQUIRE_HTTPS | true; file mẫu local đặt false |
| FORWARD_HEADERS_STRATEGY | none; chỉ dùng framework sau proxy đáng tin cậy |
| PUBLIC_API_DOCS | false; file mẫu local đặt true |

Không có secret mặc định. Ứng dụng từ chối khởi động nếu khóa JWT thiếu/sai Base64/quá ngắn. Thay khóa sẽ vô hiệu hóa access token cũ; refresh token vẫn chịu kiểm soát trong DB.

Production phục vụ API và frontend qua HTTPS. Nếu TLS kết thúc ở reverse proxy, bật `FORWARD_HEADERS_STRATEGY=framework` **sau khi** proxy đã loại bỏ/ghi đè header Forwarded/X-Forwarded-* từ client và chặn truy cập trực tiếp backend. Không bật access log chứa query string của `/auth/verify-email`, Authorization, mật khẩu hoặc body token ở proxy/APM.

## 5. Ví dụ request/response cho từng API

Các ví dụ dùng `Content-Type: application/json`. Giá trị `<...>` là placeholder; token thực tế phải lấy từ response hoặc email, không dùng nguyên placeholder để gọi API.

**POST /api/v1/auth/signup**

```json
{
  "fullName": "Nguyễn Văn An",
  "email": "an@example.com",
  "phone": "0912345678",
  "password": "Example@123",
  "confirmPassword": "Example@123",
  "termsAccepted": true
}
```

HTTP 201:

```json
{
  "message": "Đăng ký thành công. Vui lòng kiểm tra email để kích hoạt tài khoản"
}
```

Không có access token ở bước này. Request không khai báo role; nếu gửi thêm `role`, `enabled`, `emailVerified` hoặc trường ngoài DTO, server bỏ qua hoàn toàn. Trùng email/phone trả 409, validation sai trả 400.

**GET /api/v1/auth/verify-email?token=<token-trong-email>**

Không có JSON request body. Link gửi tới frontend có dạng `{FRONTEND_URL}/verify-email?token=...`; trang frontend cần đọc token và gọi GET API này. Trang frontend chưa nằm trong phạm vi thay đổi backend.

HTTP 200:

```json
{
  "message": "Xác thực email thành công. Bạn có thể đăng nhập"
}
```

Token sai/hết hạn/đã dùng trả 400, ví dụ:

```json
{
  "status": 400,
  "message": "Token xác thực đã hết hạn",
  "timestamp": "2026-10-27T13:00:00Z"
}
```

**POST /api/v1/auth/resend-verification**

```json
{
  "email": "an@example.com"
}
```

HTTP 200:

```json
{
  "message": "Nếu email có tài khoản chưa xác thực, liên kết xác thực sẽ được gửi. Vui lòng kiểm tra email"
}
```

Response giống nhau cho email không tồn tại hoặc đã xác thực. Với tài khoản đang chờ, giới hạn gửi lại tính cả email vừa gửi lúc signup; chưa đủ 60 giây trả 429. Gửi lại thành công vô hiệu hóa các link cũ.

```json
{
  "status": 429,
  "message": "Vui lòng chờ 60 giây giữa hai lần gửi email xác thực",
  "timestamp": "2026-10-27T13:00:00Z"
}
```

**POST /api/v1/auth/login**

```json
{
  "email": "an@example.com",
  "password": "Example@123"
}
```

HTTP 200:

```json
{
  "accessToken": "<JWT>",
  "refreshToken": "<43-ky-tu-Base64URL>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "refreshExpiresIn": 604800
}
```

`expiresIn` và `refreshExpiresIn` tính bằng giây. Access token HS256 có `sub`, `userId`, `email`, `role`, `iss`, `aud`, `iat`, `exp`, `jti`; bộ xác minh chỉ chấp nhận HS256, issuer/audience đúng và token chưa hết hạn. JWT dùng Nimbus qua [Spring Security JOSE](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html).

Sai email hoặc mật khẩu trả HTTP 401 với cùng thông báo:

```json
{
  "status": 401,
  "message": "Email hoặc mật khẩu không đúng",
  "timestamp": "2026-10-27T13:00:00Z"
}
```

Chỉ khi mật khẩu đúng mới trả lỗi chưa xác thực HTTP 403:

```json
{
  "status": 403,
  "message": "Email chưa được xác thực. Hãy kiểm tra email hoặc gửi lại qua /auth/resend-verification",
  "timestamp": "2026-10-27T13:00:00Z"
}
```

**POST /api/v1/auth/refresh**

```json
{
  "refreshToken": "<refresh-token-hien-tai>"
}
```

HTTP 200:

```json
{
  "accessToken": "<JWT-moi>",
  "refreshToken": "<refresh-token-moi>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "refreshExpiresIn": 604800
}
```

Client thay cả hai token sau mỗi lần refresh, chỉ cho một request refresh chạy tại một thời điểm. Token cũ bị thu hồi và không dùng lại được. Mỗi token mới có hạn 7 ngày kể từ lúc cấp; đây là thời hạn trượt, chưa có giới hạn tuyệt đối của cả phiên đăng nhập. Token hợp lệ về cấu trúc nhưng hết hạn/bị thu hồi/không tồn tại trả 401; sai cấu trúc DTO trả 400.

**POST /api/v1/auth/logout**

```json
{
  "refreshToken": "<refresh-token-hien-tai>"
}
```

HTTP 200:

```json
{
  "message": "Đăng xuất thành công"
}
```

Logout idempotent, thu hồi refresh token được gửi lên. Không yêu cầu access token còn hạn; client chỉ cần chứng minh quyền sở hữu refresh token. Đây không phải logout toàn bộ thiết bị. Access token đã cấp vẫn có thể dùng đến khi hết hạn (tối đa 15 phút); client cần xóa token khỏi trạng thái của mình.

API được bảo vệ nhận header:

```http
Authorization: Bearer <access-token>
```

Filter tải trạng thái user hiện tại để từ chối tài khoản vô hiệu hóa/xóa mềm hoặc role/email đã thay đổi. Các API CRUD cũ `/api/v1/**` yêu cầu `MANAGER` hoặc `ADMIN`; TENANT không được truy cập toàn bộ dữ liệu quản lý. Chưa có API riêng lọc dữ liệu theo quyền sở hữu của tenant. Không có endpoint public cấp quyền quản lý; tài khoản quản lý cần được cấp bằng quy trình quản trị tin cậy.

Toàn bộ lỗi controller và security dùng `{status,message,timestamp}`. Response thành công của module nghiệp vụ cũ vẫn giữ `StandardResponse`; client cũ cần cập nhật bộ đọc lỗi theo format mới. JSON hỏng không trả lại nội dung request/parser exception.

Email được gửi đồng bộ **sau commit DB**. Nếu SMTP lỗi, trả 503; tài khoản/token đã được lưu và người dùng có thể gọi resend sau thời gian chờ. Nếu process dừng ngay sau commit trước khi gửi, cũng khôi phục qua resend; chưa có hàng đợi/outbox tự thử gửi lại.

## 6. Chạy và test nhanh

Cần JDK 21+, Docker Desktop đang chạy. Maven Wrapper có sẵn. Các lệnh dưới đây chạy trong thư mục `be`.

```powershell
cd be
docker compose -f compose.auth.yml up -d --wait

# Giữ nguyên .env nếu đã tồn tại.
if (-not (Test-Path .env)) { Copy-Item .env.example .env }

# Các biến của process ưu tiên hơn .env, dùng DB local riêng để thử.
$env:MONGODB_URI = 'mongodb://localhost:27018/?replicaSet=rs0&directConnection=true'
$env:MONGODB_DATABASE = 'rental_auth_local'
$jwtBytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($jwtBytes)
$rng.Dispose()
$env:JWT_SECRET = [Convert]::ToBase64String($jwtBytes)
$env:SMTP_HOST = 'localhost'
$env:SMTP_PORT = '1025'
$env:SMTP_USERNAME = ''
$env:SMTP_PASSWORD = ''
$env:SMTP_AUTH = 'false'
$env:SMTP_STARTTLS = 'false'
$env:SMTP_FROM = 'no-reply@example.com'
$env:FRONTEND_URL = 'http://localhost:3000'
$env:CORS_ALLOWED_ORIGINS = 'http://localhost:3000'
$env:REQUIRE_HTTPS = 'false'
$env:PUBLIC_API_DOCS = 'true'

.\mvnw.cmd clean spring-boot:run
```

Mở Mailpit tại `http://localhost:8025` để xem email; Swagger tại `http://localhost:8080/swagger-ui.html`. Mailpit chỉ dành cho local, email không ra hộp thư thật.

Ở terminal khác, trong `be`:

```powershell
# Chạy xuyên suốt HTTP + SMTP thật tới Mailpit, không in token/mật khẩu.
.\scripts\auth-smoke.ps1

# Unit test không cần Docker.
.\mvnw.cmd "-Dtest=SecurityUnitTests" test

# Toàn bộ test: MongoDB replica set tạm bằng Testcontainers, SMTP mock.
.\mvnw.cmd clean test
```

Testcontainers tạo DB riêng, không đụng tới Atlas/.env của dự án và tự dọn container. Nếu Docker không sẵn sàng, integration test được báo **skipped**; kiểm tra số test skipped trước khi coi pipeline đạt. Chạy CI với Docker để kiểm chứng transaction/rotation. Smoke script tạo một tài khoản test mới trên môi trường local đang chạy.

Kiểm thử bao gồm validation, role injection, chuẩn hóa email/phone, hash mật khẩu/token, JWT sai chữ ký/hết hạn, tài khoản chưa xác thực, lỗi đăng nhập chung, resend, email hết hạn/đã dùng, SMTP lỗi, CORS, 401/403 và refresh đồng thời.

Để dừng dịch vụ local mà vẫn giữ dữ liệu:

```powershell
docker compose -f compose.auth.yml down
```

Trước khi đưa ra Internet, cấu hình rate limit cho login/signup theo IP tại gateway để hạn chế brute force/spam. Giới hạn resend theo tài khoản đã được thực thi trong DB; không thay thế rate limit lưu lượng toàn hệ thống.

## 7. Kết quả kiểm chứng

Đã chạy `./mvnw.cmd -q verify`: **18 test đạt, 0 lỗi, 0 skipped**, gồm 7 unit test và 11 integration test với MongoDB replica set thật bằng Testcontainers. Bản JAR đã được đóng gói thành công.

Đã chạy `scripts/auth-smoke.ps1` trên JAR, MongoDB local và SMTP Mailpit thật: signup → email → verify → login → rotate → logout → từ chối refresh token đã thu hồi. SMTP trong bộ integration test được mock để kiểm tra thêm lỗi gửi mail; smoke test xác nhận đường gửi SMTP thực tế.
