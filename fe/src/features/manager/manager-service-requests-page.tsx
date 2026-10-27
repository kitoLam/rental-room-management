import { Modal } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { type ManagerRecord } from '@/interfaces/manager'
import { dateOnly, dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { useState } from 'react'
import {
  ActionDialog,
  ManagerLink,
  ManagerPage,
  ManagerStatus,
  Records,
  SearchBox,
} from './components'
import { useManagerAction, useManagerList } from './context'

export function ManagerServiceRequests() {
  const [q, setQ] = useState(''),
    [status, setStatus] = useState(''),
    [page, setPage] = useState(1),
    query = useManagerList('service-requests', { q, status, page: String(page - 1) }, true),
    [selected, setSelected] = useState<ManagerRecord<'service-requests'> | null>(null),
    [decision, setDecision] = useState(''),
    mutation = useManagerAction(() => {
      setSelected(null)
      setDecision('')
    })
  return (
    <ManagerPage
      title="Yêu cầu dịch vụ"
      description="Xét đăng ký và yêu cầu ngừng dịch vụ của từng người thuê."
    >
      <div className="flex flex-wrap gap-3">
        <SearchBox
          value={q}
          onChange={(v) => {
            setQ(v)
            setPage(1)
          }}
        />
        <select
          aria-label="Trạng thái yêu cầu"
          className="input w-auto"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="PENDING">Chờ đăng ký</option>
          <option value="CANCEL_REQUESTED">Chờ ngừng</option>
          <option value="APPROVED">Đang dùng</option>
          <option value="REJECTED">Từ chối</option>
          <option value="CANCELLED">Đã ngừng</option>
        </select>
      </div>
      <Records
        query={query}
        page={page}
        onPage={setPage}
        columns={[
          {
            label: 'Dịch vụ',
            render: (s) => (
              <>
                <strong>{s.name}</strong>
                <p className="text-xs text-muted-foreground">
                  {s.mandatory ? 'Bắt buộc' : 'Tùy chọn'} · {formatVnd(s.unitPrice)}/{s.unit}
                </p>
              </>
            ),
          },
          {
            label: 'Người thuê',
            render: (s) => (
              <>
                <ManagerLink to={`/manager/tenancies/${s.contractTenantId}`}>
                  {s.tenantName}
                </ManagerLink>
                <p className="text-xs text-muted-foreground">{s.roomName}</p>
              </>
            ),
          },
          {
            label: 'Thời gian',
            render: (s) => (
              <>
                {s.startDate && dateOnly(s.startDate)} – {s.endDate && dateOnly(s.endDate)}
              </>
            ),
          },
          {
            label: 'Kết quả',
            render: (s) => (
              <>
                <ManagerStatus value={s.status || 'DRAFT'} />
                <div className="mt-2">
                  <Button variant="outline" onClick={() => setSelected(s)}>
                    Xem yêu cầu
                  </Button>
                </div>
              </>
            ),
          },
        ]}
      />
      <Modal
        title="Xét yêu cầu dịch vụ"
        open={!!selected && !decision}
        onOpenChange={(v) => {
          if (!v) setSelected(null)
        }}
      >
        {selected && (
          <div className="grid gap-5">
            <Facts
              items={[
                ['Dịch vụ', selected.name],
                ['Người thuê', selected.tenantName],
                ['Ghi chú', selected.note],
                ['Trạng thái', <ManagerStatus value={selected.status || 'DRAFT'} />],
              ]}
            />
            {selected.history.map((h, n) => (
              <p className="border-l border-border pl-3 text-sm leading-6" key={n}>
                {dateTime(h.at)} · {h.note}
              </p>
            ))}
            {!selected.mandatory &&
              ['PENDING', 'CANCEL_REQUESTED'].includes(selected.status || '') && (
                <div className="flex gap-3">
                  <Button onClick={() => setDecision('approve')}>Chấp thuận</Button>
                  <Button variant="outline" onClick={() => setDecision('reject')}>
                    Từ chối
                  </Button>
                </div>
              )}
          </div>
        )}
      </Modal>
      <ActionDialog
        title="Xác nhận quyết định dịch vụ"
        open={!!decision}
        onOpenChange={(v) => {
          if (!v) setDecision('')
        }}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={(value) =>
          mutation.mutate({
            resource: 'service-requests',
            id: selected!.subscriptionId || selected!.id,
            value: { ...value, contractTenantId: selected!.contractTenantId, decision },
          })
        }
      />
    </ManagerPage>
  )
}
