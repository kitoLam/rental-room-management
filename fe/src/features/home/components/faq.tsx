import { Container } from '@/components/common/container'
const questions = [
  [
    'Tôi có cần đăng nhập để tìm phòng?',
    'Bạn có thể xem và tìm phòng tự do. Khi đặt lịch xem hoặc yêu cầu giữ chỗ, TroPro sẽ mời bạn đăng nhập để theo dõi yêu cầu.',
  ],
  [
    'Có bắt buộc xem phòng trước khi giữ chỗ?',
    'Không. Đặt lịch xem và yêu cầu giữ chỗ là hai lựa chọn độc lập. Bạn có thể chọn cách phù hợp với mình.',
  ],
  [
    'Khoản giữ chỗ có phải tiền thuê trả trước?',
    'Khoản giữ chỗ là khoản riêng theo chính sách chi nhánh. Giá thuê và tiền thuê trả trước sẽ được thỏa thuận khi lập hợp đồng.',
  ],
  [
    'Khi nào yêu cầu giữ chỗ được xác nhận?',
    'Sau khi khoản thanh toán được hệ thống hoặc bên có thẩm quyền xác minh, trong thời hạn giữ chỗ. Thao tác gửi tiền hoặc bắt đầu thanh toán chưa đồng nghĩa đã xác nhận.',
  ],
]
export function Faq() {
  return (
    <section id="faq" className="scroll-mt-24 border-t border-border py-16 sm:py-20">
      <Container className="grid gap-9 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <p className="mb-3 text-xs font-bold tracking-[0.14em] text-primary">
            TRƯỚC KHI BẠN BẮT ĐẦU
          </p>
          <h2 className="text-page-title font-bold">
            Thuê phòng,
            <br />
            rõ từng bước.
          </h2>
          <p className="mt-4 max-w-xs text-sm leading-7 text-muted-foreground">
            Một vài điều cần biết để bạn yên tâm chọn nơi ở tiếp theo.
          </p>
        </div>
        <dl className="divide-y divide-border">
          {questions.map(([q, a]) => (
            <div key={q} className="py-5 first:pt-0">
              <dt className="mb-3 font-bold">{q}</dt>
              <dd className="text-sm leading-7 text-muted-foreground">{a}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  )
}
