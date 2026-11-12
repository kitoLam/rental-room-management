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

export function ManagerInvoices() {
  const [q, setQ] = useState(''),
    [month, setMonth] = useState(() => new URLSearchParams(location.search).get('month') || ''),
    [documentStatus, setDocument] = useState(''),
    [financialStatus, setFinancial] = useState(''),
    [page, setPage] = useState(1),
    [scope, setScope] = useState<Record<string, string>>({}),
    query = useManagerList(
      'invoices',
      { q, month, documentStatus, financialStatus, ...scope, page: String(page - 1) },
      true,
    )
  return (
    <ManagerPage
      title="Hóa đơn"
      description="Một hóa đơn cho từng nghĩa vụ thuê cá nhân trong kỳ."
      actions={
        <ManagerLink to="/manager/invoices/new" button>
          Lập hóa đơn
        </ManagerLink>
      }
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
        <input
          aria-label="Kỳ hóa đơn"
          className="input w-auto"
          type="month"
          value={month}
          onChange={(e) => {
            setMonth(e.target.value)
            setPage(1)
          }}
        />
        <select
          aria-label="Trạng thái chứng từ"
          className="input w-auto"
          value={documentStatus}
          onChange={(e) => {
            setDocument(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả chứng từ</option>
          <option value="DRAFT">Nháp</option>
          <option value="ISSUED">Đã phát hành</option>
          <option value="CANCELLED">Đã hủy</option>
        </select>
        <select
          aria-label="Trạng thái thanh toán"
          className="input w-auto"
          value={financialStatus}
          onChange={(e) => {
            setFinancial(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả thanh toán</option>
          <option value="UNPAID">Chưa thanh toán</option>
          <option value="PARTIAL">Thanh toán một phần</option>
          <option value="PAID">Đã đủ</option>
          <option value="OVERDUE">Quá hạn</option>
        </select>
      </div>
      <Records
        query={query}
        page={page}
        onPage={setPage}
        columns={[
          {
            label: 'Hóa đơn',
            render: (i) => (
              <>
                <ManagerLink to={`/manager/invoices/${i.id}`}>{i.code}</ManagerLink>
                <p className="text-xs text-muted-foreground">
                  {i.billingMonth.slice(0, 7)} · {i.tenantName}
                </p>
                <p className="text-xs text-muted-foreground">{i.roomName}</p>
              </>
            ),
          },
          {
            label: 'Nghĩa vụ / còn lại',
            render: (i) => (
              <>
                <strong className="tabular-nums">{formatVnd(i.totalAmount)}</strong>
                <p className="text-xs text-muted-foreground">Còn {formatVnd(i.outstanding)}</p>
              </>
            ),
          },
          { label: 'Hạn thanh toán', render: (i) => dateOnly(i.dueDate) },
          {
            label: 'Trạng thái',
            render: (i) => (
              <div className="flex flex-wrap gap-2">
                <ManagerStatus value={i.documentStatus} />
                {i.documentStatus === 'ISSUED' && <ManagerStatus value={i.financialStatus} />}
              </div>
            ),
          },
        ]}
      />
    </ManagerPage>
  )
}
