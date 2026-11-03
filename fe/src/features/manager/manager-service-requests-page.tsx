import { Modal } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { type ManagerRecord } from '@/interfaces/manager'
import { dateOnly, dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { provider } from '@/services/config'
import { useState } from 'react'
import { z } from 'zod'
import {
  ManagerForm,
  ManagerLink,
  ManagerPage,
  ManagerStatus,
  Records,
  SearchBox,
  type FieldSpec,
} from './components'
import { useManagerAction, useManagerList } from './context'

type ServiceRequest = ManagerRecord<'service-requests'>
type Decision = 'approve' | 'reject' | 'confirm-installation' | 'confirm-termination'

const note = z.string().trim().max(500)
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Chọn ngày')
const decisions: Record<
  Decision,
  { title: string; operation: string; label: string; fields: FieldSpec[]; schema: z.ZodType }
> = {
  approve: {
    title: 'Duyệt yêu cầu đăng ký',
    operation: 'APPROVE',
    label: 'Duyệt',
    fields: [{ name: 'reason', label: 'Ghi chú (không bắt buộc)', kind: 'textarea' }],
    schema: z.object({ reason: note }),
  },
  reject: {
    title: 'Từ chối yêu cầu',
    operation: 'REJECT',
    label: 'Từ chối',
    fields: [{ name: 'reason', label: 'Lý do từ chối', kind: 'textarea' }],
    schema: z.object({ reason: note.min(5, 'Nhập lý do từ chối') }),
  },
  'confirm-installation': {
    title: 'Xác nhận ngày lắp đặt',
    operation: 'CONFIRM_INSTALLATION',
    label: 'Xác nhận lắp đặt',
    fields: [
      { name: 'effectiveDate', label: 'Ngày lắp đặt (bắt đầu tính phí)', kind: 'date' },
      { name: 'reason', label: 'Ghi chú (không bắt buộc)', kind: 'textarea' },
    ],
    schema: z.object({ effectiveDate: date, reason: note }),
  },
  'confirm-termination': {
    title: 'Duyệt ngừng và xác nhận ngày kết thúc',
    operation: 'CONFIRM_TERMINATION',
    label: 'Xác nhận ngừng',
    fields: [
      { name: 'effectiveDate', label: 'Ngày kết thúc (ngừng tính phí)', kind: 'date' },
      { name: 'reason', label: 'Ghi chú (không bắt buộc)', kind: 'textarea' },
    ],
    schema: z.object({ effectiveDate: date, reason: note }),
  },
}

const realStatuses = [
  ['PENDING', 'Chờ duyệt'],
  ['APPROVED', 'Đã duyệt, chờ lắp đặt'],
  ['COMPLETED', 'Đã hoàn tất'],
  ['REJECTED', 'Từ chối'],
  ['CANCELLED', 'Người thuê đã hủy'],
]
const mockStatuses = [
  ['PENDING', 'Chờ đăng ký'],
  ['CANCEL_REQUESTED', 'Chờ ngừng'],
  ['APPROVED', 'Đang dùng'],
  ['REJECTED', 'Từ chối'],
  ['CANCELLED', 'Đã ngừng'],
]

/** API thật trả allowedActions; dữ liệu mock chỉ có duyệt / từ chối. */
function operations(s: ServiceRequest): string[] {
  if (s.allowedActions) return s.allowedActions
  return !s.mandatory && ['PENDING', 'CANCEL_REQUESTED'].includes(s.status || '')
    ? ['APPROVE', 'REJECT']
    : []
}

export function ManagerServiceRequests() {
  const real = provider('utilities') === 'real',
    [q, setQ] = useState(''),
    [status, setStatus] = useState(''),
    [action, setAction] = useState(''),
    [page, setPage] = useState(1),
    query = useManagerList('service-requests', { q, status, action, page: String(page - 1) }, true),
    [selected, setSelected] = useState<ServiceRequest | null>(null),
    [decision, setDecision] = useState<Decision | null>(null),
    mutation = useManagerAction(() => {
      setSelected(null)
      setDecision(null)
    })
  const config = decision ? decisions[decision] : null
  return (
    <ManagerPage
      title="Yêu cầu dịch vụ"
      description="Duyệt đăng ký, xác nhận ngày lắp đặt và yêu cầu ngừng dịch vụ của người thuê."
    >
      <div className="flex flex-wrap gap-3">
        <SearchBox
          value={q}
          onChange={(v) => {
            setQ(v)
            setPage(1)
          }}
        />
        {real && (
          <select
            aria-label="Loại yêu cầu"
            className="input w-auto"
            value={action}
            onChange={(e) => {
              setAction(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Tất cả loại</option>
            <option value="REGISTER">Đăng ký</option>
            <option value="STOP">Ngừng</option>
          </select>
        )}
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
          {(real ? realStatuses : mockStatuses).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
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
                  {s.action ? (s.action === 'STOP' ? 'Yêu cầu ngừng' : 'Yêu cầu đăng ký') : s.mandatory ? 'Bắt buộc' : 'Tùy chọn'}{' '}
                  · {formatVnd(s.unitPrice)}/{s.unit}
                </p>
              </>
            ),
          },
          {
            label: 'Người thuê',
            render: (s) => (
              <>
                {s.contractTenantId ? (
                  <ManagerLink to={`/manager/tenancies/${s.contractTenantId}`}>{s.tenantName}</ManagerLink>
                ) : (
                  <strong>{s.tenantName}</strong>
                )}
                <p className="text-xs text-muted-foreground">{s.roomName}</p>
              </>
            ),
          },
          {
            label: 'Thời gian',
            render: (s) =>
              s.action ? (
                <>
                  Đề nghị {s.proposedDate && dateOnly(s.proposedDate)}
                  {s.confirmedDate && (
                    <p className="text-xs text-muted-foreground">Xác nhận {dateOnly(s.confirmedDate)}</p>
                  )}
                </>
              ) : (
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
                ['Loại', selected.action ? (selected.action === 'STOP' ? 'Ngừng dịch vụ' : 'Đăng ký dịch vụ') : null],
                ['Người thuê', `${selected.tenantName} · ${selected.roomName}`],
                ['Ngày đề nghị', selected.proposedDate ? dateOnly(selected.proposedDate) : null],
                ['Ngày xác nhận', selected.confirmedDate ? dateOnly(selected.confirmedDate) : null],
                ['Ghi chú', selected.note],
                ['Trạng thái', <ManagerStatus value={selected.status || 'DRAFT'} />],
              ]}
            />
            {selected.history.map((h, n) => (
              <p className="border-l border-border pl-3 text-sm leading-6" key={n}>
                {dateTime(h.at)} · <ManagerStatus value={h.status} /> {h.note}
              </p>
            ))}
            <div className="flex flex-wrap gap-3">
              {(Object.keys(decisions) as Decision[])
                .filter((key) => operations(selected).includes(decisions[key].operation))
                .map((key) => (
                  <Button
                    key={key}
                    variant={key === 'reject' ? 'outline' : 'default'}
                    onClick={() => {
                      mutation.reset()
                      setDecision(key)
                    }}
                  >
                    {decisions[key].label}
                  </Button>
                ))}
            </div>
          </div>
        )}
      </Modal>
      <Modal
        title={config?.title || 'Xác nhận'}
        open={!!selected && !!config}
        onOpenChange={(v) => {
          if (!v && !mutation.isPending) setDecision(null)
        }}
        description="Kiểm tra đúng người thuê và ngày trước khi xác nhận."
      >
        {selected && config && (
          <ManagerForm
            schema={config.schema}
            fields={config.fields}
            defaults={{
              reason: '',
              effectiveDate: selected.proposedDate || new Date().toISOString().slice(0, 10),
            }}
            pending={mutation.isPending}
            error={mutation.error}
            submitLabel="Xác nhận"
            onSubmit={(value) =>
              mutation.mutate({
                resource: 'service-requests',
                id: real ? selected.id : selected.subscriptionId || selected.id,
                value: { ...value, contractTenantId: selected.contractTenantId, decision },
              })
            }
          />
        )}
      </Modal>
    </ManagerPage>
  )
}
