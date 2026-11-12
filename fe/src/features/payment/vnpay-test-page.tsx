import { useState } from 'react'
import { Container } from '@/components/common/container'
import { Button } from '@/components/ui/button'
import { Copy, Check, CreditCard, ExternalLink, ShieldCheck } from 'lucide-react'

export function VnPayTestPage() {
  const [amount, setAmount] = useState('100000')
  const [orderInfo, setOrderInfo] = useState('Thanh toan tien phong TroPro')
  const [bankCode, setBankCode] = useState('NCB')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ncbCardNumber = '9704198526191432198'

  const copyCard = () => {
    navigator.clipboard.writeText(ncbCardNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/v1/vnpay/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          orderInfo,
          bankCode: bankCode || undefined,
        }),
      })

      const data = await response.json()
      const paymentUrl = data.data?.paymentUrl || data.paymentUrl

      if (paymentUrl) {
        window.location.href = paymentUrl
      } else {
        throw new Error(data.message || 'Không nhận được đường dẫn thanh toán từ máy chủ.')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi tạo giao dịch.')
      setLoading(false)
    }
  }

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 border-b border-border pb-5">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CreditCard size={26} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                Thử nghiệm Cổng thanh toán VNPay
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Môi trường thử nghiệm Sandbox (không trừ tiền thật)
              </p>
            </div>
          </div>

          {/* Hộp thông tin thẻ test NCB */}
          <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                <ShieldCheck size={16} /> Thẻ test VNPay Sandbox (NCB)
              </span>
              <button
                type="button"
                onClick={copyCard}
                className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Đã sao chép' : 'Chép số thẻ'}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Ngân hàng:</p>
                <p className="font-bold text-foreground">NCB (Quốc Dân)</p>
              </div>
              <div>
                <p className="text-muted-foreground">Số thẻ:</p>
                <p className="font-mono font-bold text-foreground">{ncbCardNumber}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tên chủ thẻ:</p>
                <p className="font-bold text-foreground">NGUYEN VAN A</p>
              </div>
              <div>
                <p className="text-muted-foreground">Ngày phát hành / OTP:</p>
                <p className="font-bold text-foreground">07/15 · OTP: 123456</p>
              </div>
            </div>
          </div>

          <form onSubmit={handlePay} className="mt-6 space-y-4">
            <div>
              <label htmlFor="amount" className="block text-sm font-bold text-foreground">
                Số tiền thanh toán (VNĐ)
              </label>
              <input
                id="amount"
                type="number"
                min="5000"
                step="1000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input mt-1.5 w-full"
                required
              />
            </div>

            <div>
              <label htmlFor="orderInfo" className="block text-sm font-bold text-foreground">
                Nội dung thanh toán
              </label>
              <input
                id="orderInfo"
                type="text"
                value={orderInfo}
                onChange={(e) => setOrderInfo(e.target.value)}
                className="input mt-1.5 w-full"
                required
              />
            </div>

            <div>
              <label htmlFor="bankCode" className="block text-sm font-bold text-foreground">
                Phương thức / Ngân hàng
              </label>
              <select
                id="bankCode"
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                className="input mt-1.5 w-full"
              >
                <option value="NCB">Ngân hàng NCB (Thẻ nội địa Sandbox)</option>
                <option value="">Tất cả (Chọn trên giao diện VNPay)</option>
                <option value="VNPAYQR">VNPAY-QR</option>
              </select>
            </div>

            {error && <p className="text-sm font-bold text-danger">{error}</p>}

            <Button type="submit" loading={loading} className="mt-6 w-full py-6 text-base">
              Chuyển sang VNPay Sandbox để thanh toán
              <ExternalLink size={18} />
            </Button>
          </form>
        </div>
      </div>
    </Container>
  )
}
export default VnPayTestPage
