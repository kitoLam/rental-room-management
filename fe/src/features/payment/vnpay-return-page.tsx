import { useQuery } from '@tanstack/react-query'
import { useSearchParams, Link } from 'react-router'
import { CheckCircle2, XCircle, AlertTriangle, ArrowRight, Home } from 'lucide-react'
import { Container } from '@/components/common/container'
import { Button } from '@/components/ui/button'
import { formatVnd } from '@/lib/format'

interface VnPayReturnData {
  validSignature: boolean
  transactionCode: string
  amount: number
  bankCode: string
  bankTranNo?: string
  cardType?: string
  orderInfo: string
  payDate: string
  responseCode: string
  transactionNo?: string
  transactionStatus: string
  status: 'SUCCESS' | 'FAILED' | 'INVALID_SIGNATURE'
  message: string
}

export function VnPayReturnPage() {
  const [params] = useSearchParams()

  const query = useQuery<VnPayReturnData>({
    queryKey: ['vnpay-return', params.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/v1/vnpay/return?${params.toString()}`)
      if (!res.ok) {
        throw new Error('Không thể kết nối đến máy chủ để xác thực kết quả')
      }
      const json = await res.json()
      return json.data || json
    },
    enabled: params.has('vnp_SecureHash'),
    retry: false,
  })

  const isPending = query.isPending
  const error = query.error
  const data = query.data

  const isSuccess = data?.status === 'SUCCESS'
  const isInvalidSignature = data?.status === 'INVALID_SIGNATURE'

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-6 sm:p-10 shadow-sm">
        {isPending ? (
          <div className="py-12 text-center">
            <div className="mx-auto size-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-4 text-base font-bold text-foreground">
              Đang xác thực kết quả với VNPay...
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Vui lòng không tắt hoặc tải lại trang.</p>
          </div>
        ) : error || !data ? (
          <div className="text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-danger/10 text-danger">
              <AlertTriangle size={36} />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-foreground">Xác thực thất bại</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : 'Dữ liệu giao dịch không hợp lệ.'}
            </p>
            <div className="mt-8">
              <Link to="/">
                <Button className="w-full">
                  <Home size={18} />
                  Về trang chủ
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-center">
              <div
                className={`mx-auto flex size-16 items-center justify-center rounded-full ${
                  isSuccess
                    ? 'bg-success/10 text-success'
                    : isInvalidSignature
                      ? 'bg-warning/10 text-warning'
                      : 'bg-danger/10 text-danger'
                }`}
              >
                {isSuccess ? (
                  <CheckCircle2 size={40} />
                ) : isInvalidSignature ? (
                  <AlertTriangle size={40} />
                ) : (
                  <XCircle size={40} />
                )}
              </div>

              <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold text-foreground">
                {isSuccess ? 'Thanh toán thành công!' : 'Thanh toán không thành công'}
              </h1>

              <p className="mt-2 text-sm text-muted-foreground">{data.message}</p>

              <div className="my-6 border-y border-border py-4">
                <p className="text-xs font-bold text-muted-foreground uppercase">Số tiền thanh toán</p>
                <p className="mt-1 text-3xl font-extrabold text-primary">
                  {formatVnd(data.amount || 0)}
                </p>
              </div>
            </div>

            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between border-b border-border/50 pb-2">
                <dt className="text-muted-foreground">Mã giao dịch (TxnRef):</dt>
                <dd className="font-mono font-bold text-foreground">{data.transactionCode}</dd>
              </div>
              {data.transactionNo && (
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <dt className="text-muted-foreground">Mã GD VNPay:</dt>
                  <dd className="font-mono text-foreground">{data.transactionNo}</dd>
                </div>
              )}
              {data.bankCode && (
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <dt className="text-muted-foreground">Ngân hàng thanh toán:</dt>
                  <dd className="font-bold text-foreground">{data.bankCode}</dd>
                </div>
              )}
              {data.orderInfo && (
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <dt className="text-muted-foreground">Nội dung:</dt>
                  <dd className="text-right text-foreground">{data.orderInfo}</dd>
                </div>
              )}
              <div className="flex justify-between border-b border-border/50 pb-2">
                <dt className="text-muted-foreground">Mã phản hồi:</dt>
                <dd className="font-mono text-foreground">{data.responseCode || '00'}</dd>
              </div>
              <div className="flex justify-between pb-1">
                <dt className="text-muted-foreground">Kiểm tra chữ ký:</dt>
                <dd
                  className={`font-bold ${data.validSignature ? 'text-success' : 'text-danger'}`}
                >
                  {data.validSignature ? 'Hợp lệ (HMAC-SHA512)' : 'Không hợp lệ'}
                </dd>
              </div>
            </dl>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/" className="flex-1">
                <Button variant="outline" className="w-full">
                  <Home size={18} />
                  Về trang chủ
                </Button>
              </Link>
              <Link to="/rooms" className="flex-1">
                <Button className="w-full">
                  Xem phòng
                  <ArrowRight size={18} />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </Container>
  )
}
export default VnPayReturnPage
