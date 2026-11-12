# Nghiệp vụ đã chốt 1–40 — Core Flow Đặt lịch xem phòng

Dự án: SBA301 — Rental Room Management  
Repository: https://github.com/kitoLam/rental-room-management  
Ngày tổng hợp: 27/10/2026

Đây là bản quyết định nghiệp vụ cuối cùng để Codex triển khai flow Đặt lịch xem phòng. Khi khác với sơ đồ, mock hoặc code cũ, áp dụng bản này. Không tự bổ sung chức năng ngoài phạm vi.

## 1. Nguồn nghiệp vụ được ưu tiên khi có mâu thuẫn

- Quyết định nghiệp vụ trong bản này là nguồn chuẩn.
- BE kiểm tra và thực thi nghiệp vụ, phân quyền, khả dụng, giữ ca và chuyển trạng thái.
- FE tuân theo hợp đồng API và kết quả BE. Nếu BE hoặc FE chưa đúng nghiệp vụ đã chốt thì sửa phần tương ứng.
- Tenant chọn một trong ba ca; không nhập khung giờ tự do.

## 2. Phạm vi triển khai đợt đầu

- Triển khai flow hoàn chỉnh: tạo yêu cầu → chờ duyệt → duyệt hoặc từ chối; các nhánh hết hạn, hủy, hoàn tất và không đến.
- Bao gồm cấu hình ca theo phòng, tra cứu, lịch sử, thông báo và nhắc tự động đã chốt.
- Chia thành các phần nhỏ; mỗi phần làm cả BE và FE, tích hợp và kiểm tra trước khi tiếp tục.
- Chỉ triển khai phần liên quan lịch xem. Không triển khai hoặc thay đổi nghiệp vụ Đặt phòng và cọc giữ chỗ.
- Dữ liệu đặt phòng chỉ được đọc/tiếp nhận qua cơ chế tích hợp thống nhất với thành viên phụ trách.

## 3. Ai được phép đặt lịch

- Tài khoản người tìm thuê USER/TENANT đang hoạt động được đặt lịch, không bắt buộc đã có hợp đồng.
- Guest được xem thông tin phòng công khai và ca khả dụng; phải đăng nhập khi gửi yêu cầu.
- Đăng nhập không tự thay đổi vai trò tài khoản.
- Chỉ đặt cho chính mình, không đặt hộ.

## 4. Phụ thuộc Security và định danh tài khoản

- Thống nhất với thành viên Security về ID tài khoản, vai trò, liên kết hồ sơ và phạm vi sở hữu/quản lý.
- Khi tích hợp thật, BE lấy người thao tác từ phiên đăng nhập; không tin ID người thao tác do FE tự truyền.
- Không mặc định USER đã có hợp đồng hoặc tự đồng nhất ID tài khoản với ID hồ sơ Tenant khi chưa có ánh xạ.
- Có thể phát triển nghiệp vụ trước bằng cơ chế giả lập tài khoản tách riêng cho môi trường phát triển. Khi Security sẵn sàng thì thay bằng tích hợp thật.
- Không đưa cơ chế giả lập thành cách phân quyền của môi trường sử dụng thật.

## 5. Phạm vi quyền Owner/Manager

- Owner xử lý các phòng thuộc phạm vi sở hữu của mình.
- Manager đang hoạt động, có quyền quản lý lịch xem, được xử lý lịch của tất cả phòng trong chi nhánh được giao.
- Không giới hạn riêng theo Room.managerId đối với quyền quản lý lịch xem của Manager đã được giao chi nhánh.
- Áp dụng cùng phạm vi cho tra cứu, cấu hình ca, duyệt, từ chối, hủy, ghi nhận/sửa kết quả và nhận thông báo.
- Quan hệ định danh và sở hữu được tích hợp theo dữ liệu chung của dự án, không suy đoán từ dữ liệu FE.

## 6. Ghi nhận người duyệt

- Owner/Manager có quyền được duyệt yêu cầu.
- Lưu tài khoản đã duyệt và thời điểm duyệt.
- Các thao tác tiếp theo không bắt buộc do cùng tài khoản đã duyệt thực hiện; căn cứ phạm vi quyền hiện tại.
- Mỗi hành động lưu riêng tài khoản và thời điểm thực hiện.

## 7. Thông tin bắt buộc của người đặt

- Chỉ đặt cho chính mình.
- Bắt buộc họ tên và số điện thoại liên hệ hợp lệ.
- Có thể điền sẵn từ tài khoản để người đặt kiểm tra/chỉnh thông tin liên hệ trước khi gửi.
- Lưu thông tin liên hệ dùng cho yêu cầu đó; thay đổi hồ sơ sau này không âm thầm ghi đè thông tin đã lưu.
- Chưa yêu cầu CCCD. Xác minh email tuân theo quy định chung của Security.

## 8. Đặt lịch cho phòng hay slot cụ thể

- Đợt đầu lịch xem gắn với phòng, không chọn giường/slot cụ thể.
- Phòng theo slot chỉ cần còn ít nhất một slot hợp lệ để nhận lịch xem.
- Việc chọn slot cụ thể là mở rộng tương lai, chưa triển khai.
- Hướng mở rộng có thể thêm roomSlotId tùy chọn trên lịch; lịch cũ không cần gán giả một slot.
- Số slot còn trống không làm tăng sức chứa ca xem.

## 9. Điều kiện phòng được nhận lịch

- Chi nhánh và phòng phải đang hoạt động; không nhận lịch cho phòng bảo trì hoặc ngừng hoạt động.
- Phòng nguyên căn phải còn hợp lệ để cho thuê.
- Phòng theo slot phải còn ít nhất một slot hợp lệ; không chỉ dựa vào trạng thái tổng của phòng.
- Xét cả quyền giữ chỗ thuê chính thức và giữ tạm theo mục 29–31.
- Kiểm tra khi tra cứu và kiểm tra lại ở BE khi tạo/duyệt yêu cầu.

## 10. Khả dụng hiện tại hay tương lai

- Đợt đầu xét khả dụng hiện tại.
- Phòng nguyên căn đang có người ở chưa được mở nhận yêu cầu, kể cả yêu cầu xem vào ngày sau ngày dự kiến trả.
- Chỉ mở sau khi đã ghi nhận trả phòng thực tế và phòng đủ điều kiện tiếp khách.
- Phòng hiện trống nhưng đã có quyền giữ chỗ thuê chính thức có hiệu lực thì không nhận lịch mới.
- Phòng theo slot xét từng slot; chỉ hết khả dụng khi không còn slot phù hợp theo mục 31.
- Không triển khai tính khả dụng theo khoảng thuê dự kiến trong flow này.

## 11. Định nghĩa ba ca

- Mỗi phòng có đúng ba loại ca: sáng 08:00–10:00, chiều 14:00–16:00, tối 18:00–20:00, theo giờ Việt Nam.
- Đây là giờ ban đầu; Owner/Manager có quyền được chỉnh giờ và bật/tắt ca theo phòng.
- Không tạo thêm loại ca thứ tư trong đợt đầu.
- Giờ bắt đầu phải nhỏ hơn giờ kết thúc; ca không xuyên ngày; các ca cùng phòng không được chồng giờ. Cho phép ca liền kề.
- Thông báo Tenant đến lúc bắt đầu ca. Nếu đến muộn nhưng vẫn trong ca thì có thể xem trong thời gian còn lại.
- Chưa áp dụng mốc trễ 15/30 phút; NO_SHOW chỉ được ghi nhận từ cuối ca theo mục 27.

## 12. Cấu hình ca

- Cấu hình riêng theo phòng; chỉ chỉnh giờ và bật/tắt từng ca.
- Không có cấu hình lịch mặc định chi nhánh, ngày nghỉ, ngày ngoại lệ hoặc chọn ngày hoạt động trong tuần.
- Ca đang bật được áp dụng hằng ngày, nếu phòng/chi nhánh và dữ liệu khả dụng đáp ứng điều kiện.
- Không có công tắc ca theo chi nhánh. Trạng thái hoạt động chung của chi nhánh vẫn là điều kiện bắt buộc.
- Chi nhánh ngừng hoạt động thì tất cả phòng thuộc chi nhánh không được nhận hoặc duyệt lịch mới.
- Xử lý lịch hiện hữu khi sửa cấu hình theo mục 17; trường hợp ngừng hoạt động thực sự khiến không thể tiếp khách theo mục 24.

## 13. Sức chứa của một ca

- Mỗi phòng/ngày/ca chỉ có tối đa một lịch còn hiệu lực: PENDING hoặc CONFIRMED.
- PENDING giữ ca ngay sau khi tạo thành công.
- Nhiều slot thuê trống không cho phép nhiều lịch xem cùng ca.
- Không giữ ca chỉ vì người dùng mở trang hoặc chọn ca trên FE.
- REJECTED, CANCELLED, EXPIRED không tiếp tục giữ ca. Khi đặt lại vẫn phải kiểm tra thời gian và các điều kiện khác.

## 14. Phạm vi chiếm ca

- Ca bị chiếm theo phòng.
- Hai phòng khác nhau được nhận lịch cùng ngày, cùng ca cho hai Tenant khác nhau.
- Vẫn kiểm tra giới hạn lịch của cùng Tenant theo mục 15.

## 15. Giới hạn lịch của một Tenant

- Cùng Tenant/phòng/ngày: nếu đã có PENDING, CONFIRMED, COMPLETED hoặc NO_SHOW thì không tạo thêm yêu cầu cùng phòng trong ngày đó.
- Nếu yêu cầu trước là REJECTED, CANCELLED hoặc EXPIRED thì được đặt lại, miễn yêu cầu mới hợp lệ.
- Giới hạn áp dụng ngay từ PENDING, không đợi duyệt.
- Với các phòng khác nhau trong cùng ngày: không cho cùng Tenant có hai lịch PENDING/CONFIRMED thuộc cùng loại ca, kể cả giờ thực tế không chồng nhau.
- Đồng thời chặn mọi lịch PENDING/CONFIRMED chồng lấn khoảng giờ thực tế, kể cả khác loại ca.
- Hai khoảng giờ tiếp giáp không tính chồng lấn; chưa áp dụng khoảng đệm di chuyển.
- Đợt đầu chưa giới hạn tổng số lịch còn hiệu lực trên toàn bộ ngày/phòng ngoài các quy tắc trên.

## 16. Giới hạn thời gian đặt lịch

- Dùng múi giờ Asia/Ho_Chi_Minh cho nghiệp vụ và hiển thị.
- Chỉ tạo yêu cầu khi giờ bắt đầu ca còn ở tương lai.
- Không nhận ca đã bắt đầu dù chưa kết thúc.
- Không giới hạn tối đa số ngày đặt trước.
- Không đặt điều kiện phải gửi trước ít nhất hai giờ. Mốc hai giờ thuộc quyền tự hủy lịch CONFIRMED ở mục 23.
- Hạn duyệt rút ngắn theo mục 22 nếu ca bắt đầu trước mốc 24 giờ.

## 17. Sửa hoặc tắt ca đã có lịch

- Lưu ngày, giờ bắt đầu/kết thúc đã hẹn trên từng lịch, không chỉ tham chiếu giờ hiện tại của Shift.
- Chỉnh giờ hoặc bật/tắt ca chỉ áp dụng cho yêu cầu mới; không âm thầm đổi/hủy lịch hiện hữu.
- Hiển thị cảnh báo và các lịch hiện hữu bị ảnh hưởng để phía quản lý biết.
- Nếu không thể phục vụ lịch đã có, thực hiện hủy có lý do theo mục 24.
- Khi tạo lịch mới, kiểm tra cả sức chứa phòng/ngày/ca và chồng giờ thực tế với lịch còn hiệu lực của phòng theo giờ đã lưu; thay cấu hình không được tạo chỗ trống giả.
- Không dùng tắt ca để tự khôi phục, thay đổi hoặc xóa lịch cũ.

## 18. Owner/Manager từ chối

- Chỉ từ chối yêu cầu PENDING còn hiệu lực; bắt buộc nhập lý do.
- Chuyển sang REJECTED, nhả ca và thông báo Tenant.
- Không đề xuất lịch thay thế trong yêu cầu.
- Hệ thống có thể hiển thị lời nhắc Tenant tự chọn ngày/ca khác còn trống.
- Tenant muốn đặt lại thì tạo yêu cầu mới, giữ lịch sử yêu cầu cũ.

## 19. Giữ ca khi đề xuất lịch khác

- Không áp dụng trong flow đã chốt.
- Mỗi yêu cầu chỉ gắn với ngày/ca đã chọn khi tạo; không có ca đề xuất hoặc bước giữ ca đề xuất.

## 20. Tenant đồng ý lịch đề xuất

- Không áp dụng trong flow đã chốt.
- Owner/Manager duyệt thì lịch chuyển ngay sang CONFIRMED, không chờ Tenant đồng ý.
- Đọc thông báo không quyết định hiệu lực lịch.

## 21. Đổi lịch

- Không hỗ trợ chỉnh trực tiếp phòng/ngày/ca của yêu cầu đã gửi hoặc quy trình đề xuất/phản hồi đổi lịch.
- Muốn đổi thì hủy theo điều kiện được phép rồi tạo yêu cầu mới.
- Không chuyển yêu cầu đã kết thúc trở lại PENDING/CONFIRMED.
- Không tự tạo hoặc ưu tiên ca thay thế.

## 22. Hạn phản hồi

- Owner/Manager có tối đa 24 giờ từ lúc tạo yêu cầu để xử lý.
- expiresAt là thời điểm sớm hơn giữa createdAt + 24 giờ và giờ bắt đầu ca đã hẹn.
- Từ thời điểm expiresAt trở đi, yêu cầu PENDING không còn được duyệt; chuyển EXPIRED, nhả ca, giải phóng giới hạn lịch và thông báo.
- Không chỉ nhả ca mà để trạng thái PENDING.
- Kiểm tra hạn ngay trong thao tác BE; tác vụ định kỳ chạy muộn không làm yêu cầu quá hạn được duyệt hoặc tiếp tục giữ chỗ logic.
- CONFIRMED không hết hạn theo quy tắc này.
- Không có hạn phản hồi Tenant vì không còn bước phản hồi lịch đề xuất.
- Ca đã bắt đầu không được nhận yêu cầu mới dù vừa được giải phóng.

## 23. Tenant chủ động hủy

- Tenant chỉ hủy lịch của chính mình.
- PENDING còn hiệu lực và ca chưa bắt đầu: được hủy.
- CONFIRMED: tự hủy khi còn ít nhất hai giờ trước giờ bắt đầu; đúng mốc hai giờ vẫn được phép.
- Còn dưới hai giờ: không tự hủy trên hệ thống, hiển thị thông tin liên hệ phía quản lý.
- Owner/Manager có thể hủy thay sau khi xác nhận đúng yêu cầu của Tenant theo mục 24.
- Tenant không bắt buộc nhập lý do; ghi chú tùy chọn.
- Hủy thành công chuyển CANCELLED, nhả ca, lưu lịch sử và thông báo.
- Liên hệ ngoài hệ thống chưa tự làm thay đổi trạng thái.
- Lịch đã kết thúc không tiếp tục hủy.

## 24. Owner/Manager hủy và phòng không thể xem

- Owner/Manager có quyền với phòng được hủy, bắt buộc nhập lý do; không bị giới hạn bởi mốc hai giờ của Tenant.
- Từ chối một yêu cầu đang xét vì không chấp nhận lịch dùng REJECTED.
- Hủy theo yêu cầu Tenant hoặc vì sự việc phát sinh làm lịch không thực hiện được dùng CANCELLED.
- Phòng/chi nhánh bảo trì, ngừng hoạt động hoặc không thể tiếp khách: hủy các PENDING/CONFIRMED tương lai bị ảnh hưởng và thông báo.
- Sửa/tắt cấu hình ca đơn thuần không đồng nghĩa phòng ngừng hoạt động; áp dụng mục 17.
- Nếu ca đã bắt đầu/đã qua, vẫn được ghi nhận CANCELLED khi thực tế buổi xem không diễn ra vì phía cho thuê không thể tiếp khách; lưu thời điểm ghi nhận thực tế.
- Không ghi NO_SHOW cho Tenant trong trường hợp phía cho thuê không thể tiếp khách.
- Nếu buổi xem đã diễn ra thì ghi nhận kết quả, không hủy.
- Phân biệt tài khoản thao tác với bên yêu cầu/nguyên nhân hủy.
- Không ghi đè trạng thái lịch đã kết thúc bằng thao tác hủy thông thường.

## 25. Bộ trạng thái

Chỉ dùng bảy trạng thái:

| Trạng thái | Ý nghĩa |
| --- | --- |
| PENDING | Đang chờ duyệt, giữ ca |
| CONFIRMED | Đã duyệt, giữ ca |
| REJECTED | Đã bị từ chối |
| CANCELLED | Đã hủy |
| EXPIRED | Hết hạn xử lý yêu cầu chờ duyệt |
| COMPLETED | Buổi xem thực tế đã hoàn tất |
| NO_SHOW | Tenant không đến theo điều kiện mục 27 |

Chuyển trạng thái thông thường:
- PENDING → CONFIRMED / REJECTED / CANCELLED / EXPIRED.
- CONFIRMED → CANCELLED / COMPLETED / NO_SHOW.
- Trạng thái kết thúc không tự quay về trạng thái giữ ca.
- Không dùng trạng thái chờ phản hồi đề xuất.
- Không tự suy đoán COMPLETED/NO_SHOW khi qua giờ.
- Ngoại lệ sửa nhầm COMPLETED ↔ NO_SHOW được kiểm soát riêng ở mục 35.
- Lý do kết thúc được lưu riêng, không tạo thêm trạng thái cho từng nguyên nhân.

## 26. Ghi nhận đã xem

- Owner/Manager có quyền với phòng ghi nhận, không bắt buộc cùng tài khoản đã duyệt.
- Chỉ xử lý lịch CONFIRMED; Tenant đã đến và buổi xem thực tế đã kết thúc.
- Được thao tác từ giờ bắt đầu ca trở đi; không phải đợi hết ca nếu đã xem xong.
- Không bắt buộc Tenant xác nhận lại.
- Chuyển COMPLETED, lưu tài khoản và thời điểm ghi nhận.
- Cho ghi nhận muộn sau ngày hẹn; không tự ghi lùi thời điểm thao tác.
- COMPLETED chỉ xác nhận đã xem; không tạo booking, quyền giữ chỗ thuê, ưu tiên thuê hoặc hợp đồng.

## 27. Không đến và lịch cần cập nhật kết quả

- Owner/Manager có quyền chỉ ghi NO_SHOW cho lịch CONFIRMED, từ thời điểm kết thúc ca trở đi.
- Điều kiện: Tenant không đến trong ca và phía cho thuê vẫn có thể tiếp khách.
- Không tự chuyển trạng thái chỉ vì hết ca.
- Lịch CONFIRMED có giờ kết thúc <= hiện tại được đưa vào bộ lọc Cần cập nhật kết quả; đây không phải trạng thái mới.
- Đã xem thì COMPLETED; không đến thì NO_SHOW; không thể phục vụ do phía cho thuê thì CANCELLED theo mục 24.
- Chưa xác định thực tế thì giữ CONFIRMED để tiếp tục xử lý.
- Cho phép ghi nhận muộn, lưu thời điểm thao tác thật.
- Lịch đã kết thúc không được dùng thao tác ghi nhận thông thường để đổi sang NO_SHOW.

## 28. Nội dung kết quả

- Kết quả chính là COMPLETED hoặc NO_SHOW.
- Ghi chú kết quả tùy chọn, tối đa 500 ký tự.
- Owner/Manager có quyền nhập; Tenant của lịch và phía quản lý có quyền được xem.
- Không bắt buộc ghi chú để hoàn tất.
- Lý do từ chối, lý do hủy và ghi chú kết quả là các nội dung riêng; không ghi đè lẫn nhau.
- Chưa có ghi chú nội bộ riêng, chấm điểm hoặc khảo sát.
- Nội dung ghi chú không tự kích hoạt đặt phòng hay giữ chỗ thuê.
- Sửa sau khi lưu theo mục 35.

## 29. Sự kiện giữ chỗ thuê làm ảnh hưởng lịch xem

- Mới gửi yêu cầu đặt phòng, chưa hình thành quyền giữ chỗ: chưa hủy lịch xem.
- Giữ tạm chờ thanh toán có hiệu lực: chặn tạo/duyệt lịch xem bị ảnh hưởng, chưa hủy lịch hiện hữu.
- Đã xác minh đủ cọc và booking xác nhận quyền giữ chỗ thuê chính thức có hiệu lực: hủy lịch xem bị ảnh hưởng theo mục 30–31.
- Giữ tạm hết hạn/thanh toán thất bại, không hình thành quyền giữ chỗ chính thức: bỏ chặn nếu vẫn hợp lệ.
- Hạn duyệt PENDING vẫn chạy trong lúc bị chặn, không tự gia hạn.
- Căn cứ dữ liệu chính thức từ flow đặt phòng; không dựa riêng thông báo thanh toán FE hoặc một trạng thái phòng.
- Không tự diễn giải một mã booking/tiền cọc là đủ nếu chưa thống nhất ý nghĩa với thành viên phụ trách.
- Hủy tự động dùng CANCELLED, lưu nguyên nhân, nguồn hệ thống và booking liên quan, rồi thông báo.
- Chỉ triển khai phía lịch xem, không thay đổi nghiệp vụ booking/thanh toán.

## 30. Phạm vi lịch bị hủy

- Khi phòng không còn đủ điều kiện do quyền giữ chỗ thuê chính thức có hiệu lực, hủy các PENDING/CONFIRMED có giờ bắt đầu còn ở tương lai thuộc phạm vi bị ảnh hưởng.
- Bao gồm lịch của chính Tenant vừa đặt phòng/cọc; không còn cần giữ ca xem cho người đó khi phòng hết khả dụng.
- Không ảnh hưởng phòng khác.
- Giữ nguyên các lịch đã kết thúc và lịch sử.
- Không tự hủy hồi tố lịch đã bắt đầu/đã qua nhưng chưa cập nhật; xử lý thực tế theo mục 24, 26–27.
- Kiểm tra khả dụng khi tra cứu, tạo và duyệt.
- Cần cơ chế nhận biết thay đổi hoặc tác vụ định kỳ đọc dữ liệu chính thức để tự hủy; không chỉ kiểm tra khi mở trang.
- Phòng theo slot áp dụng thêm mục 31.

## 31. Phòng theo slot

- Còn ít nhất một slot hợp lệ có thể thuê thì nhận/duyệt và giữ lịch xem.
- Một slot được giữ chính thức nhưng còn slot hợp lệ khác thì không hủy toàn bộ lịch phòng.
- Không còn slot hợp lệ do đã thuê/giữ chính thức thì hủy lịch tương lai theo mục 30.
- Nếu chỗ khả dụng cuối đang giữ tạm: chỉ chặn tạo/duyệt, chưa hủy; khi thành chính thức thì hủy, khi hết giữ tạm thì xét mở lại.
- Slot hợp lệ phải đang hoạt động, được phép cho thuê, chưa bị người thuê sử dụng và không bị quyền giữ chỗ liên quan chiếm.
- Không chỉ đếm trạng thái AVAILABLE; sử dụng nguồn khả dụng thống nhất với thành viên đặt phòng.
- Phòng/chi nhánh vẫn phải đáp ứng điều kiện hoạt động chung.
- Hai slot trống không cho hai Tenant cùng đặt một phòng/ngày/ca: chỉ một yêu cầu giữ ca thành công.

## 32. Phòng mở lại

- Khi quyền giữ chỗ thuê chấm dứt và phòng/slot đủ điều kiện, mở khả năng đặt lịch mới.
- Không tự khôi phục lịch đã CANCELLED hoặc EXPIRED; Tenant phải tạo yêu cầu mới.
- Lịch chỉ bị chặn tạm, chưa kết thúc thì tiếp tục theo trạng thái và hạn hiện có; không gia hạn hoặc tạo lại hạn.
- Nếu đã hết hạn trong thời gian chặn thì giữ EXPIRED.
- Không ưu tiên tự động cho người có lịch cũ.
- Flow lịch xem chỉ đọc/tiếp nhận kết quả thay đổi, không hủy hoặc sửa booking.

## 33. Quan hệ với đặt phòng và chi phí

- Đặt lịch và xem phòng miễn phí.
- Không yêu cầu tiền cọc để đến xem; chưa áp dụng phí phạt hủy/không đến.
- Không bắt buộc xem trước khi đặt phòng.
- Lịch xem chỉ giữ ca, không giữ quyền thuê hay tạo ưu tiên thuê.
- COMPLETED không tự tạo booking; muốn thuê thì dùng flow đặt phòng riêng.
- NO_SHOW không tự thu phí, trừ tiền hoặc khóa quyền đặt lịch trong đợt đầu.
- Hiển thị rõ: Đặt lịch xem phòng chỉ giữ ca xem, không giữ chỗ thuê phòng.

## 34. Dữ liệu người dùng được nhập/sửa

- Khi tạo, Tenant gửi phòng, ngày, ID ca, họ tên và số điện thoại liên hệ hợp lệ.
- BE lấy người đặt từ phiên đăng nhập, tự đặt PENDING, tự xác định/lưu giờ đã hẹn và tính expiresAt.
- Tenant không gán người duyệt, thời điểm duyệt, trạng thái, kết quả hoặc lý do từ chối.
- Duyệt không nhận tài khoản/thời điểm duyệt tùy ý; BE tự ghi nhận.
- Từ chối cần lý do; Owner/Manager hủy cần lý do; Tenant hủy có ghi chú tùy chọn.
- Hoàn tất/không đến nhận ghi chú kết quả tùy chọn, tối đa 500 ký tự.
- EXPIRED do hệ thống xác định, không cho người dùng tự gán.
- Không có cập nhật chung cho phép truyền status tùy ý.
- Không sửa trực tiếp phòng/ngày/ca/người đặt sau khi gửi.
- Mỗi hành động chỉ nhận dữ liệu được phép; dữ liệu không được phép trong request phải bị từ chối.
- BE kiểm tra quyền, trạng thái, thời gian và khả dụng, không phụ thuộc nút ẩn trên FE.

## 35. Lịch sử, sửa kết quả và xóa

- Lưu lịch sử tạo, duyệt, từ chối, hủy, hết hạn, ghi nhận và sửa kết quả/ghi chú.
- Lưu hành động, tài khoản hoặc hệ thống, thời điểm thực tế, dữ liệu trước/sau, lý do và tham chiếu liên quan khi có.
- Không ghi đè lịch sử cũ.
- Owner/Manager có quyền được sửa ghi chú kết quả hoặc sửa nhầm COMPLETED ↔ NO_SHOW.
- Mọi lần sửa kết quả/ghi chú đều bắt buộc lý do sửa; lưu trước/sau và người sửa.
- Đổi sang NO_SHOW chỉ khi đã hết ca và đáp ứng điều kiện thực tế mục 27; COMPLETED phải đáp ứng mục 26.
- Không bắt buộc tài khoản sửa là tài khoản ghi nhận ban đầu.
- Không sửa về PENDING/CONFIRMED, không sửa phòng/ngày/ca/người đặt, không khôi phục ca.
- Đợt đầu không cung cấp xóa cứng/xóa mềm cho người dùng; dùng hủy theo quy định, giữ lịch để tra cứu.

## 36. Thông báo

- Đợt đầu dùng thông báo trong hệ thống có danh sách và liên kết chi tiết; chưa triển khai email/SMS/kênh khác.
- Tạo yêu cầu: gửi Owner và Manager có quyền quản lý lịch xem của phòng.
- Duyệt/từ chối: gửi Tenant; từ chối kèm lý do.
- Tenant tự hủy: gửi phía quản lý có quyền.
- Owner/Manager hủy: gửi Tenant kèm lý do.
- Hệ thống hủy hoặc yêu cầu hết hạn: gửi Tenant và phía quản lý có quyền.
- Ghi nhận/sửa kết quả hoặc ghi chú kết quả: gửi Tenant.
- Không gửi cho người không liên quan hoặc chính tài khoản thao tác; mỗi tài khoản chỉ nhận một thông báo cho cùng sự kiện.
- Nội dung có phòng/chi nhánh, ngày/ca/giờ đã hẹn, sự kiện/trạng thái, lý do liên quan và liên kết chi tiết.
- Thông báo lỗi không đảo ngược thay đổi lịch đã lưu; ghi nhận lỗi và thử lại, tránh trùng.
- Dùng module thông báo chung nếu có; chỉ bổ sung phần liên quan lịch xem.

## 37. Đã đọc và nhắc tự động

- Mở thông báo hoặc đánh dấu đã đọc thì lưu thời điểm đọc riêng cho người nhận.
- Đã đọc không chuyển trạng thái hoặc quyết định hiệu lực lịch; không có bước đồng ý xác nhận lịch.
- Nhắc Tenant một giờ trước giờ bắt đầu nếu lịch còn CONFIRMED.
- Nhắc Owner/Manager có quyền một giờ trước expiresAt nếu còn PENDING.
- Mỗi loại nhắc một lần/người nhận/lịch; thử lại không tạo trùng.
- Kiểm tra trạng thái ngay trước khi gửi; bỏ nhắc không còn phù hợp.
- Nếu tạo/duyệt sau mốc nhắc tương ứng thì không gửi nhắc bù; đã có thông báo tạo/duyệt.
- Đọc lời nhắc không gia hạn hoặc thay đổi lịch.

## 38. Tra cứu và dữ liệu hiển thị

- Guest xem phòng công khai và ngày/ca khả dụng, không thấy danh tính người giữ ca.
- USER/TENANT chỉ xem danh sách, chi tiết và lịch sử nghiệp vụ của chính mình.
- Owner/Manager xem theo phạm vi mục 5.
- Tenant thấy phòng/chi nhánh, ngày/ca/giờ đã lưu, thông tin liên hệ đã dùng, trạng thái, hạn phản hồi khi PENDING, lý do/ghi chú liên quan, các mốc xử lý và thông tin liên hệ công khai của bên cho thuê/chi nhánh.
- Hiện nút hủy khi đáp ứng điều kiện.
- Tenant có bộ lọc ngày hẹn và trạng thái.
- Phía quản lý thấy thông tin Tenant, người/thời điểm duyệt và lịch sử gồm lần sửa; lọc chi nhánh, phòng, khoảng ngày, trạng thái và Cần cập nhật kết quả.
- Danh sách phân trang, mặc định theo ngày/giờ hẹn tăng dần.
- BE kiểm soát quyền đọc ở danh sách, chi tiết, lịch sử và thông báo; đổi ID không vượt quyền.
- Hiển thị giờ Việt Nam. Khả dụng lúc tra cứu không bảo đảm còn chỗ khi gửi; BE kiểm tra lại.

## 39. Đồng bộ FE–BE

- Dùng hợp đồng API theo kiến trúc BE hiện có sau khi đáp ứng nghiệp vụ; sửa FE tương ứng.
- Codex kiểm tra code và thống nhất request/response, ID, đường dẫn, trạng thái, bộ lọc, phân trang và lỗi trước khi nối từng phần.
- FE dùng ID thật do BE cấp, không tự tạo ID thay thế.
- Ngày xem truyền YYYY-MM-DD theo ngày Việt Nam; gửi ID ca, không nhập giờ tự do.
- Thời điểm tuyệt đối truyền định dạng có múi giờ rõ ràng; BE lưu thống nhất, FE hiển thị giờ Việt Nam.
- Đồng bộ đủ bảy trạng thái; nếu dùng mã số phải có bảng ánh xạ rõ ràng.
- Lỗi có mã/thông báo thống nhất và thông tin trường khi phù hợp.
- Chuyển các phần lịch xem sang API thật: khả dụng, tạo, danh sách/chi tiết/lịch sử, xử lý lịch, cấu hình ca, thông báo/đã đọc.
- Dữ liệu thực lưu BE, tải lại trang vẫn đúng.
- Security, booking và module chung chưa sẵn sàng có thể dùng lớp tích hợp giả lập riêng để phát triển; phải ghi rõ phần chưa tích hợp thật.
- Không sửa nghiệp vụ booking/thanh toán để hoàn thành flow lịch xem.

## 40. Tranh ca, gửi lặp và thao tác đồng thời

- Chỉ giữ ca sau khi tạo thành công; hai Tenant cùng tranh một phòng/ngày/ca chỉ một người thành công.
- Bảo đảm giới hạn cùng Tenant bằng cơ chế BE/database, kể cả gửi đồng thời ở nhiều phòng.
- Không chỉ kiểm tra còn trống rồi lưu mà thiếu bảo vệ đồng thời.
- Nhận diện một lần gửi được thử lại để không tạo lịch/giữ ca/thông báo trùng; trả kết quả đã ghi nhận.
- Tenant chủ động đặt lại sau khi yêu cầu cũ kết thúc hợp lệ là yêu cầu mới.
- Hai người cùng duyệt chỉ ghi một lần; không ghi đè người duyệt đầu tiên.
- Thao tác sau dùng trạng thái mới nhất: hủy trước thì không duyệt; duyệt trước thì lần hủy tiếp kiểm tra điều kiện CONFIRMED.
- Duyệt chỉ thành công khi PENDING còn hạn tại thời điểm ghi nhận. Tác vụ hết hạn không đổi CONFIRMED thành EXPIRED.
- Kiểm tra khả dụng chính thức khi tạo/duyệt; quyền giữ chỗ thuê đã có hiệu lực phải chặn, có hiệu lực sau thì xử lý hủy theo mục 30–31.
- Thống nhất cơ chế nhận biết thay đổi với thành viên đặt phòng; không dựa vào dữ liệu FE.
- Tác vụ tự động, thử lại thông báo và xử lý lặp không tạo thay đổi/lịch sử/thông báo trùng.
- Chỉ phát sinh lịch sử/thông báo cho thay đổi đã lưu thành công; dùng cơ chế nhất quán và thử lại phù hợp.
- Codex chọn giải pháp kỹ thuật phù hợp repository để bảo đảm các bất biến trên, không tự mở rộng phạm vi nghiệp vụ.

## Hướng dẫn triển khai cho Codex

1. Đọc bản này và code hiện tại; các sơ đồ/mock cũ chỉ là tham khảo khi khác quyết định cuối cùng.
2. Lập danh sách phần cần sửa trong phạm vi lịch xem; phân biệt thay đổi được triển khai với phụ thuộc cần thành viên khác cung cấp.
3. Không tự suy đoán ý nghĩa trạng thái booking, cách phân biệt phòng nguyên căn/slot hoặc ánh xạ tài khoản khi nguồn dữ liệu chưa đủ. Thống nhất hợp đồng đọc dữ liệu với thành viên phụ trách.
4. Không thực hiện tạo/sửa/hủy booking hoặc xác nhận/thu/hoàn tiền cọc.
5. Không tạo lại chức năng ngày nghỉ, lịch theo thứ hoặc lịch mặc định chi nhánh.
6. Chia công việc thành từng phần BE và FE có thể kiểm tra được; kiểm tra đặc biệt giữ ca đồng thời, giới hạn Tenant, hết hạn, phân quyền và tích hợp khả dụng.
7. Bản này mô tả nghiệp vụ cần triển khai, không khẳng định các chức năng đã có trong repository.

