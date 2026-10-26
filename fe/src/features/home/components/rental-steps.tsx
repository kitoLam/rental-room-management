import { Container } from '@/components/common/container'

const steps = [
  { title: 'Tìm phòng', text: 'Lọc theo khu vực, giá và hình thức thuê.' },
  { title: 'Xem phòng nếu cần', text: 'Chọn giờ thuận tiện, chờ chi nhánh xác nhận.' },
  { title: 'Yêu cầu giữ chỗ', text: 'Chọn ngày thuê và đọc chính sách thanh toán.' },
  { title: 'Thống nhất hợp đồng', text: 'Trao đổi giá thuê và điều kiện trước khi nhận phòng.' },
]

export function RentalSteps() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="steps-title"
      // className="scroll-mt-24 border-y border-border bg-surface py-16 sm:py-20"
      className="scroll-mt-24 border-y border-border bg-surface-soft py-16 sm:py-20"
    >
      <Container>
        <h2 id="steps-title" className="text-xl font-bold">
          Thuê phòng trong 4 bước
        </h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {steps.map((step, i) => (
            <li key={step.title} className="relative flex gap-4 lg:flex-col lg:gap-3">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-base font-bold text-primary"
              >
                {i + 1}
              </span>
              {/* Đường nối giữa các bước, chỉ hiện trên desktop */}
              {i < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute top-5 left-14 hidden h-px w-[calc(100%-2rem)] bg-border lg:block"
                />
              )}
              <div>
                <h3 className="text-base font-bold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  )
}
