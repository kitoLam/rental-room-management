import { dateOnly } from '@/lib/activity'
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
      description="Số dư được tính từ hóa đơn, trả trước áp dụng và thanh toán đã xác minh."
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
                {dateOnly(i.dueDate)}
                <p className="mt-2">
                  <ManagerStatus value={i.financialStatus} />
                </p>
              </>
            ),
          },
        ]}
        empty="Không có công nợ phù hợp."
      />
    </ManagerPage>
  )
}
