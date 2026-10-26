import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Copy, QrCode, RefreshCw, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Field,
  InlineError,
  Modal,
  Notice,
  Page,
  Panel,
  QueryState,
  RecordStatus,
} from '@/components/common/page'
import { bookingService } from '@/services/guest-user'
import { invalidateActivity } from '@/services/query-client'
import { provider } from '@/services/config'
import { formatVnd } from '@/lib/format'
import { dateOnly, dateTime } from '@/lib/activity'
import { uuid } from '@/lib/validation'
import type { PaymentScenario } from '@/interfaces/domain'

export default function PaymentPage() {
  const { bookingId = '' } = useParams()
  const [scenario, setScenario] = useState<PaymentScenario>('success')
  const [copied, setCopied] = useState('')
  const [copyError, setCopyError] = useState<Error | null>(null)
  const [qr, setQr] = useState(false)
  const [clock, setClock] = useState(Date.now)
  const booking = useQuery({
    queryKey: ['bookings', bookingId],
    queryFn: () => bookingService.get(bookingId),
    enabled: uuid(bookingId),
    refetchInterval: 3000,
  })
  const payments = useQuery({
    queryKey: ['payments', bookingId],
    queryFn: () => bookingService.payments(bookingId),
    enabled: uuid(bookingId),
    refetchInterval: 3000,
  })
  const initiate = useMutation({
    mutationFn: () => bookingService.initiate(bookingId, scenario),
    onSuccess: async () => {
      await invalidateActivity()
    },
  })
  const paymentState = payments.data?.map((p) => `${p.id}-${p.status}`).join(',') || ''
  useEffect(() => {
    if (paymentState) void invalidateActivity()
  }, [paymentState])
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      setCopyError(null)
    } catch {
      setCopyError(new Error('Chưa thể sao chép. Bạn có thể chọn và sao chép nội dung trực tiếp.'))
    }
  }
  if (!uuid(bookingId))
    return (
      <Page title="Liên kết thanh toán không hợp lệ" back="/user/bookings">
        <Notice>Chọn một yêu cầu giữ chỗ từ danh sách.</Notice>
      </Page>
    )
  const b = booking.data
  const p = payments.data?.[0]
  const seconds = b
    ? Math.max(
        0,
        Math.floor(
          (Math.min(Date.parse(b.paymentDueAt), Date.parse(b.temporaryHoldUntil)) - clock) / 1000,
        ),
      )
    : 0
  const canPay =
    b?.status === 'AWAITING_PAYMENT' &&
    seconds > 0 &&
    !payments.data?.some((p) => ['PENDING', 'VERIFIED'].includes(p.status))
  const mock = provider('leasing') === 'mock'
  return (
    <Page
      title="Khoản giữ chỗ của bạn."
      eyebrow={mock ? 'THANH TOÁN DEMO · KHÔNG CHUYỂN TIỀN THẬT' : 'THANH TOÁN GIỮ CHỖ'}
      back={`/user/bookings/${bookingId}`}
      description="Việc bắt đầu thanh toán chưa xác nhận giữ chỗ. Trạng thái được cập nhật sau khi giao dịch được xác minh."
    >
      <QueryState
        pending={booking.isPending || payments.isPending}
        error={booking.error || payments.error}
        retry={() => {
          void booking.refetch()
          void payments.refetch()
        }}
      >
        {b && (
          <div className="grid items-start gap-7 lg:grid-cols-[1.2fr_1fr]">
            <Panel>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-bold">{b.roomTitle}</h2>
                <RecordStatus status={b.status} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {b.branchName}
                {b.slotLabel ? ` · ${b.slotLabel}` : ''}
              </p>
              <p className="mt-3 text-sm">
                {dateOnly(b.startDate)} → {dateOnly(b.endDate)}
              </p>
              <div className="my-7 rounded-xl bg-primary-soft p-5">
                <p className="text-xs text-primary">
                  KHOẢN GIỮ CHỖ THEO CHÍNH SÁCH V{b.policySnapshot.version}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-page-title font-bold text-primary">
                    {formatVnd(b.holdAmount)}
                  </p>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Sao chép số tiền"
                    onClick={() => {
                      void copy(String(b.holdAmount), 'Đã sao chép số tiền')
                    }}
                  >
                    <Copy />
                  </Button>
                </div>
              </div>
              <dl className="space-y-5 text-sm">
                <div>
                  <dt className="text-muted-foreground">Hạn thanh toán</dt>
                  <dd className="mt-2">
                    {dateTime(b.paymentDueAt)}
                    {b.status === 'AWAITING_PAYMENT' && (
                      <span className="ml-2 font-bold tabular-nums text-warning">
                        ({Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')})
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Nội dung tham chiếu</dt>
                  <dd className="mt-2 flex flex-wrap items-center gap-3">
                    <span className="break-all font-bold">
                      {p?.reference || 'Được cấp khi bắt đầu thanh toán'}
                    </span>
                    {p && (
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Sao chép tham chiếu"
                        onClick={() => {
                          void copy(p.reference, 'Đã sao chép tham chiếu')
                        }}
                      >
                        <Copy />
                      </Button>
                    )}
                  </dd>
                </div>
              </dl>
              {copied && (
                <p role="status" className="mt-4 text-sm text-primary">
                  {copied}
                </p>
              )}
              <InlineError error={copyError} />
              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  loading={payments.isFetching}
                  onClick={() => {
                    void payments.refetch()
                    void booking.refetch()
                  }}
                >
                  <RefreshCw />
                  Kiểm tra trạng thái
                </Button>
                <Button variant="outline" onClick={() => setQr(true)}>
                  <QrCode />
                  {mock ? 'Hướng dẫn demo' : 'Xem mã QR'}
                </Button>
              </div>
              <div className="mt-6">
                {b.status === 'EXPIRED' || (b.status === 'AWAITING_PAYMENT' && !seconds) ? (
                  <Notice tone="warning">
                    Yêu cầu đã hết hạn. Không tiếp tục thanh toán; giao dịch đến muộn cần được đối
                    soát riêng.
                  </Notice>
                ) : b.status === 'CONFIRMED' ? (
                  <Notice tone="success">
                    Đã xác minh khoản giữ chỗ. Yêu cầu đã được xác nhận.
                  </Notice>
                ) : p?.status === 'PENDING' ? (
                  <Notice>
                    Giao dịch đang chờ xác minh. Bạn không cần tự xác nhận đã nhận tiền.
                  </Notice>
                ) : p?.status === 'REVIEW' ? (
                  <Notice tone="warning">
                    Giao dịch cần đối soát. Trạng thái giữ chỗ không tự thay đổi.
                  </Notice>
                ) : (
                  <Notice>Chỉ giao dịch đã xác minh trong thời hạn mới xác nhận yêu cầu.</Notice>
                )}
              </div>
            </Panel>
            <div className="space-y-6">
              {mock && (
                <Panel>
                  <ShieldCheck className="mb-3 size-7 text-primary" />
                  <h2 className="font-bold">Thử luồng thanh toán an toàn</h2>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    Bộ mô phỏng đóng vai bên xác minh giao dịch. Không có tài khoản ngân hàng hoặc
                    mã QR nhận tiền thật.
                  </p>
                  <div className="mt-5">
                    <Field id="payment-scenario" label="Tình huống mô phỏng">
                      <select
                        id="payment-scenario"
                        className="input"
                        value={scenario}
                        disabled={!canPay || initiate.isPending}
                        onChange={(e) => setScenario(e.target.value as PaymentScenario)}
                      >
                        <option value="success">Đủ tiền, xác minh sau khoảng 6 giây</option>
                        <option value="pending">Tiếp tục chờ xác minh</option>
                        <option value="failure">Giao dịch không thành công</option>
                        <option value="late">Hết hạn sau 3 giây, tiền đến muộn</option>
                      </select>
                    </Field>
                  </div>
                  <InlineError error={initiate.error} />
                  <Button
                    className="mt-5 w-full"
                    loading={initiate.isPending}
                    disabled={!canPay}
                    onClick={() => initiate.mutate()}
                  >
                    Bắt đầu thanh toán demo
                  </Button>
                  <p className="mt-3 text-xs leading-6 text-muted-foreground">
                    Kịch bản đến muộn rút ngắn hạn của yêu cầu demo này để kiểm tra việc hết hạn.
                  </p>
                </Panel>
              )}
              <Panel>
                <h2 className="mb-4 font-bold">Lịch sử giao dịch</h2>
                {payments.data?.length ? (
                  <ul className="divide-y divide-border">
                    {payments.data.map((payment) => (
                      <li key={payment.id} className="space-y-3 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="text-sm font-bold">{formatVnd(payment.amount)}</span>
                          <RecordStatus status={payment.status} />
                        </div>
                        <p className="break-all text-xs text-muted-foreground">
                          {payment.reference} · {dateTime(payment.createdAt)}
                        </p>
                        {payment.verifiedAt && (
                          <p className="text-xs text-primary">
                            Xác minh lúc {dateTime(payment.verifiedAt)}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Chưa có giao dịch. Khoản giữ chỗ chưa được thanh toán.
                  </p>
                )}
                <Button asChild variant="link" className="mt-4 px-0">
                  <Link to={`/user/bookings/${bookingId}`}>Về chi tiết giữ chỗ</Link>
                </Button>
              </Panel>
            </div>
            <Modal
              open={qr}
              onOpenChange={setQr}
              title={mock ? 'Hướng dẫn thanh toán demo' : 'Mã QR thanh toán'}
              description="Kiểm tra môi trường giao dịch trước khi tiếp tục."
            >
              {mock ? (
                <Notice>
                  Không chuyển tiền thật. Chọn một tình huống và bắt đầu mô phỏng; kết quả xác minh
                  sẽ do bộ mô phỏng trả về.
                </Notice>
              ) : p?.qrUrl && /^https:\/\//.test(p.qrUrl) ? (
                <img
                  src={p.qrUrl}
                  alt="Mã QR thanh toán do máy chủ cung cấp"
                  className="mx-auto max-h-80"
                />
              ) : (
                <Notice>Máy chủ chưa cung cấp mã QR hoặc hướng dẫn thanh toán.</Notice>
              )}
            </Modal>
          </div>
        )}
      </QueryState>
    </Page>
  )
}
