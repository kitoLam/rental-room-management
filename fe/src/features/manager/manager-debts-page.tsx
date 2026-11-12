import { dateOnly, vnDateKey } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { useState } from 'react'
import {
  ManagerLink,
  ManagerPage,
  ManagerStatus,
  Records,
  ScopeFilters,
  SearchBox,
} from './components'
import { useManagerList } from './context'

const DAY_MS = 86_400_000

/** Backend value when present; otherwise derived from dueDate (mock data) in Vietnam time. */
function overdueDays(invoice: { overdueDays?: number; dueDate: string; financialStatus: string }) {
  if (invoice.overdueDays !== undefined) return invoice.overdueDays
  if (invoice.financialStatus === 'PAID' || !invoice.dueDate) return 0
  const diff = Date.parse(`${vnDateKey(new Date().toISOString())}T00:00:00Z`) - Date.parse(`${invoice.dueDate}T00:00:00Z`)
  return Number.isNaN(diff) ? 0 : Math.max(0, Math.floor(diff / DAY_MS))
}

export function ManagerDebts() {
  const [q, setQ] = useState(''),
    [overdue, setOverdue] = useState(false),
    [page, setPage] = useState(1),
    [scope, setScope] = useState<Record<string, string>>({
      month: new URLSearchParams(location.search).get('month') || '',
    }),
    query = useManagerList(
      'invoices',
      {
        q,
        documentStatus: 'ISSUED',
        debtOnly: 'true',
        ...scope,
        ...(overdue ? { financialStatus: 'OVERDUE' } : {}),
        page: String(page - 1),
      },
      true,
    )
  return (
    <ManagerPage
      title="Công nợ cá nhân"
      description="Số dư được tính từ hóa đơn, trả trước áp dụng và thanh toán đã xác minh; hiển thị số ngày trễ hạn của từng khoản."
    >
      <ScopeFilters
        value={scope}
        onChange={(v) => {
          setScope(v)
          setPage(1)
        }}
        tenant
      />
      <div className="flex flex-wrap gap-3">
        <SearchBox
          value={q}
          onChange={(v) => {
            setQ(v)
            setPage(1)
          }}
        />
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={overdue}
            onChange={(e) => {
              setOverdue(e.target.checked)
              setPage(1)
            }}
          />
          Chỉ quá hạn
        </label>
      </div>
      <Records
        query={query}
        page={page}
        onPage={setPage}
        columns={[
          {
            label: 'Người chịu nghĩa vụ',
            render: (i) => (
              <>
                <ManagerLink to={`/manager/tenancies/${i.contractTenantId}`}>
                  {i.tenantName}
                </ManagerLink>
                <p className="text-xs text-muted-foreground">{i.roomName}</p>
              </>
            ),
          },
          {
            label: 'Hóa đơn / kỳ',
            render: (i) => (
              <ManagerLink to={`/manager/invoices/${i.id}`}>
                {i.code} · {i.billingMonth.slice(0, 7)}
              </ManagerLink>
            ),
          },
          { label: 'Còn phải thu', render: (i) => <strong>{formatVnd(i.outstanding)}</strong> },
          {
            label: 'Hạn / trạng thái',
            render: (i) => (
              <>
                {i.dueDate ? dateOnly(i.dueDate) : 'Chưa có hạn'}
                <p className="mt-2">
                  <ManagerStatus value={i.financialStatus} />
                </p>
              </>
            ),
          },
          {
            label: 'Thời gian trễ hạn',
            render: (i) => {
              const days = overdueDays(i)
              return days > 0 ? (
                <strong className="text-destructive">Trễ {days} ngày</strong>
              ) : (
                <span className="text-muted-foreground">Chưa quá hạn</span>
              )
            },
          },
        ]}
        empty="Không có công nợ phù hợp."
      />
    </ManagerPage>
  )
}
