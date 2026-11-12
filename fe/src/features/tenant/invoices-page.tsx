import { Field, Pagination, Panel, QueryState } from '@/components/common/page'
import { dateOnly, dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { tenantApi } from '@/services/tenant'
import { useState } from 'react'
import { Link } from 'react-router'
import { TenantPage, TenantStatus } from './components'
import { tenantLink, useTenant, useTenantQuery } from './context'
import { tenantStatusLabel } from './status'

export function InvoicesPage() {
  const { tenancy: t } = useTenant(),
    query = useTenantQuery('invoices', tenantApi.invoices, [], true)
  const [month, setMonth] = useState(''),
    [state, setState] = useState(''),
    [document, setDocument] = useState(''),
    [page, setPage] = useState(1)
  const rows = (query.data || []).filter(
      (i) =>
        (!month || i.billingMonth.startsWith(month)) &&
        (!document || i.documentStatus === document) &&
        (!state || (i.documentStatus === 'ISSUED' && i.financialStatus === state)),
    ),
    pages = Math.ceil(rows.length / 6),
    current = Math.min(page, Math.max(1, pages))
  return (
    <TenantPage
      title="Hóa đơn của tôi"
      description="Công nợ và thanh toán được theo dõi riêng cho chỗ ở đang chọn."
    >
      <div className="flex flex-wrap gap-3">
        <Field id="invoice-month" label="Tháng / năm">
          <input
            id="invoice-month"
            type="month"
            className="input w-full"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value)
              setPage(1)
            }}
          />
        </Field>
        <Field id="invoice-state" label="Thanh toán">
          <select
            id="invoice-state"
            className="input"
            value={state}
            onChange={(e) => {
              setState(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Tất cả</option>
            {['UNPAID', 'PARTIAL', 'PAID', 'OVERDUE'].map((s) => (
              <option key={s} value={s}>
                {tenantStatusLabel(s)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="invoice-document" label="Chứng từ">
          <select
            id="invoice-document"
            className="input"
            value={document}
            onChange={(e) => {
              setDocument(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Tất cả</option>
            {['ISSUED', 'DRAFT', 'CANCELLED'].map((s) => (
              <option key={s} value={s}>
                {tenantStatusLabel(s)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
        empty={rows.length === 0}
        emptyMessage="Chưa có hóa đơn phù hợp."
        emptyAction={null}
      >
        <Panel>
          <ul className="divide-y divide-border">
            {rows.slice((current - 1) * 6, current * 6).map((i) => (
              <li key={i.id} className="py-5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <Link
                      to={tenantLink(`/tenant/invoices/${i.id}`, t)}
                      className="text-sm font-bold text-primary hover:underline"
                    >
                      {i.code}
                    </Link>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Kỳ {i.billingMonth.slice(0, 7)} · {t.roomName}
                      {t.slotName ? ` · ${t.slotName}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.branchName} · Hạn {dateOnly(i.dueDate)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Phát hành: {i.issuedAt ? dateTime(i.issuedAt) : 'Chưa phát hành'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <TenantStatus value={i.documentStatus} />
                    {i.documentStatus === 'ISSUED' && <TenantStatus value={i.financialStatus} />}
                  </div>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    ['Tổng hóa đơn', i.totalAmount],
                    ['Đã phân bổ', i.verifiedAllocated],
                    ['Áp dụng trả trước', i.prepaidApplied],
                    ['Còn phải trả', i.outstanding],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="mt-1 text-sm font-bold tabular-nums">
                        {formatVnd(Number(value))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </Panel>
        <Pagination page={current} totalPages={pages} onPage={setPage} />
      </QueryState>
    </TenantPage>
  )
}
