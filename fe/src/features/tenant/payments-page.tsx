import { Field, InlineError, Modal, Pagination, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { tenantApi } from '@/services/tenant'
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PaymentRow } from './billing-shared'
import { Facts, TenantPage, TenantStatus } from './components'
import { tenantLink, useTenant, useTenantQuery } from './context'
import { tenantStatusLabel } from './status'
export function PaymentsPage() {
  const { tenancy: t } = useTenant(),
    [params, setParams] = useSearchParams(),
    query = useTenantQuery('payments', tenantApi.payments, [], true),
    [state, setState] = useState(''),
    [month, setMonth] = useState(''),
    [page, setPage] = useState(1)
  const id = params.get('paymentId'),
    selected = query.data?.find((p) => p.id === id),
    rows = (query.data || []).filter(
      (p) => (!state || p.status === state) && (!month || p.createdAt.startsWith(month)),
    ),
    pages = Math.ceil(rows.length / 6),
    current = Math.min(page, Math.max(1, pages))
  function show(paymentId: string | null) {
    const next = new URLSearchParams(params)
    if (paymentId) next.set('paymentId', paymentId)
    else next.delete('paymentId')
    setParams(next)
  }
  return (
    <TenantPage
      title="Lịch sử thanh toán"
      description="Giao dịch nhận tiền và phân bổ được theo dõi riêng."
      actions={
        <Button variant="outline" onClick={() => void query.refetch()}>
          <RefreshCw size={16} />
          Cập nhật
        </Button>
      }
    >
      <div className="flex flex-wrap gap-3">
        <Field label="Trạng thái" id="payment-filter">
          <select
            id="payment-filter"
            className="input"
            value={state}
            onChange={(e) => {
              setState(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Tất cả</option>
            {['PENDING', 'VERIFIED', 'REVIEW', 'FAILED'].map((s) => (
              <option key={s} value={s}>
                {tenantStatusLabel(s)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tháng nhận tiền" id="payment-month">
          <input
            className="input"
            id="payment-month"
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value)
              setPage(1)
            }}
          />
        </Field>
      </div>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
        empty={rows.length === 0}
        emptyMessage="Chưa có thanh toán phù hợp."
        emptyAction={null}
      >
        <Panel>
          {rows.slice((current - 1) * 6, current * 6).map((p) => (
            <PaymentRow key={p.id} payment={p} onOpen={() => show(p.id)} />
          ))}
        </Panel>
        <Pagination page={current} totalPages={pages} onPage={setPage} />
      </QueryState>
      <Modal
        open={!!id}
        onOpenChange={(v) => {
          if (!v) show(null)
        }}
        title="Chi tiết thanh toán"
        drawer
      >
        {selected ? (
          <>
            <TenantStatus value={selected.status} />
            <div className="mt-5">
              <Facts
                items={[
                  ['Tham chiếu', selected.reference],
                  ['Người thanh toán', selected.payerName],
                  ['Số tiền nhận', formatVnd(selected.amountReceived)],
                  ['Đã phân bổ hóa đơn', formatVnd(selected.allocatedAmount)],
                  [
                    'Trả trước kỳ đầu / kỳ cuối',
                    `${formatVnd(selected.prepaidFirstAmount)} / ${formatVnd(selected.prepaidLastAmount)}`,
                  ],
                  [
                    'Đã áp dụng kỳ đầu / kỳ cuối',
                    `${formatVnd(selected.prepaidFirstApplied)} / ${formatVnd(selected.prepaidLastApplied)}`,
                  ],
                  [
                    'Xác minh lúc',
                    selected.verifiedAt ? dateTime(selected.verifiedAt) : 'Chưa xác minh',
                  ],
                  ['Môi trường', selected.environment === 'SANDBOX' ? 'Mô phỏng' : 'Thực tế'],
                ]}
              />
            </div>
            {selected.invoiceId && (
              <Link
                className="mt-5 inline-flex min-h-11 items-center text-sm font-bold text-primary"
                to={tenantLink(`/tenant/invoices/${selected.invoiceId}`, t)}
              >
                Xem hóa đơn liên quan
              </Link>
            )}
            {selected.evidence.length > 0 ? (
              <div className="mt-4 grid gap-3">
                {selected.evidence.map((src) => (
                  <a
                    key={src}
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary underline"
                  >
                    Xem chứng từ
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-xs text-muted-foreground">Chưa có chứng từ đính kèm.</p>
            )}
          </>
        ) : (
          <InlineError
            error={
              query.isPending ? null : new Error('Không tìm thấy thanh toán được phép truy cập.')
            }
          />
        )}
      </Modal>
    </TenantPage>
  )
}
