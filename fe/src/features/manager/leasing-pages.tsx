import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { Panel, QueryState, Modal, Notice } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { dateOnly, dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { managerApi } from '@/services/manager'
import { contractInputSchema, tenancyInputSchema, type ManagerTenancy } from '@/interfaces/manager'
import { appointmentStatuses, bookingStatuses } from '@/interfaces/domain'
import {
  ManagerPage,
  ManagerLink,
  ManagerStatus,
  Records,
  SearchBox,
  ScopeFilters,
  ManagerForm,
  ActionDialog,
  type FieldSpec,
} from './components'
import {
  useManager,
  useManagerList,
  useManagerQuery,
  useManagerAction,
  managerLink,
} from './context'

function History({ items }: { items: { at: string; note: string }[] }) {
  return (
    <ol className="grid gap-4 border-l border-border pl-5">
      {items.map((h, n) => (
        <li key={n}>
          <p className="text-xs text-muted-foreground">{dateTime(h.at)}</p>
          <p className="mt-1 text-sm leading-6">{h.note}</p>
        </li>
      ))}
    </ol>
  )
}
export function ManagerAppointments() {
  const [q, setQ] = useState(''),
    [status, setStatus] = useState(''),
    [page, setPage] = useState(1),
    [scope, setScope] = useState<Record<string, string>>({}),
    query = useManagerList('appointments', { q, status, ...scope, page: String(page - 1) }, true)
  return (
    <ManagerPage
      title="Lịch xem phòng"
      description="Tiếp nhận lịch từ người tìm phòng và cập nhật kết quả."
    >
      <ScopeFilters
        value={scope}
        onChange={(v) => {
          setScope(v)
          setPage(1)
        }}
        dates
      />
      <div className="flex flex-wrap gap-3">
        <SearchBox
          value={q}
          onChange={(v) => {
            setQ(v)
            setPage(1)
          }}
        />
        <select
          aria-label="Trạng thái lịch xem"
          className="input w-auto"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả trạng thái</option>
          {appointmentStatuses.map((s) => (
            <option key={s} value={s}>
              {
                {
                  PENDING: 'Chờ xác nhận',
                  CONFIRMED: 'Đã xác nhận',
                  COMPLETED: 'Hoàn tất',
                  REJECTED: 'Từ chối',
                  CANCELLED: 'Đã hủy',
                }[s]
              }
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
            label: 'Người xem',
            render: (a) => (
              <>
                <strong>{a.requesterName}</strong>
                <p className="break-all text-xs text-muted-foreground">{a.requesterEmail}</p>
                <p className="text-xs text-muted-foreground">{a.requesterPhone}</p>
              </>
            ),
          },
          {
            label: 'Lịch xem',
            render: (a) => (
              <>
                <ManagerLink to={`/manager/appointments/${a.id}`}>{a.roomTitle}</ManagerLink>
                <p className="text-xs text-muted-foreground">{a.note}</p>
              </>
            ),
          },
          {
            label: 'Thời gian',
            render: (a) => (
              <>
                {dateTime(a.startAt)}
                <p className="text-xs text-muted-foreground">Đến {dateTime(a.endAt)}</p>
              </>
            ),
          },
          { label: 'Phụ trách', render: (a) => a.assignedManager || 'Chưa phân công' },
          { label: 'Trạng thái', render: (a) => <ManagerStatus value={a.status} /> },
        ]}
      />
    </ManagerPage>
  )
}
export function ManagerAppointmentDetail() {
  const { appointmentId = '' } = useParams(),
    query = useManagerQuery(
      'appointment',
      (b) => managerApi.get(b, 'appointments', appointmentId),
      [appointmentId],
      true,
    ),
    [decision, setDecision] = useState(''),
    mutation = useManagerAction(() => setDecision(''))
  return (
    <ManagerPage
      title="Chi tiết lịch xem"
      actions={<ManagerLink to="/manager/appointments">Danh sách lịch xem</ManagerLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <Facts
                items={[
                  ['Phòng', query.data.roomTitle],
                  [
                    'Người xem',
                    `${query.data.requesterName} · ${query.data.requesterEmail} · ${query.data.requesterPhone || ''}`,
                  ],
                  ['Bắt đầu', dateTime(query.data.startAt)],
                  ['Kết thúc', dateTime(query.data.endAt)],
                  ['Trạng thái', <ManagerStatus value={query.data.status} />],
                  ['Phụ trách', query.data.assignedManager],
                  ['Ghi chú người xem', query.data.note],
                ]}
              />
              <div className="mt-6 flex flex-wrap gap-3">
                {(query.data.status === 'PENDING'
                  ? [
                      ['CONFIRMED', 'Xác nhận lịch'],
                      ['REJECTED', 'Từ chối'],
                      ['CANCELLED', 'Hủy lịch'],
                    ]
                  : query.data.status === 'CONFIRMED'
                    ? [
                        ['COMPLETED', 'Hoàn tất lịch xem'],
                        ['CANCELLED', 'Hủy lịch'],
                      ]
                    : []
                ).map(([status, label]) => (
                  <Button
                    key={status}
                    variant={status === 'CONFIRMED' ? 'default' : 'outline'}
                    onClick={() => setDecision(status)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </Panel>
            <Panel>
              <h2 className="mb-5 font-bold">Lịch sử xử lý</h2>
              <History items={query.data.timeline} />
            </Panel>
          </>
        )}
      </QueryState>
      <ActionDialog
        title="Cập nhật lịch xem"
        open={!!decision}
        onOpenChange={(v) => {
          if (!v) setDecision('')
        }}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={(data) =>
          mutation.mutate({
            resource: 'appointments',
            id: appointmentId,
            value: { ...data, status: decision },
          })
        }
      />
    </ManagerPage>
  )
}
export function ManagerBookings() {
  const [q, setQ] = useState(''),
    [status, setStatus] = useState(''),
    [page, setPage] = useState(1),
    [scope, setScope] = useState<Record<string, string>>({}),
    query = useManagerList('bookings', { q, status, ...scope, page: String(page - 1) }, true)
  return (
    <ManagerPage
      title="Giữ phòng"
      description="Theo dõi khoản giữ đã xác minh và thời hạn của từng yêu cầu."
    >
      <ScopeFilters
        value={scope}
        onChange={(v) => {
          setScope(v)
          setPage(1)
        }}
        dates
      />
      <div className="flex flex-wrap gap-3">
        <SearchBox
          value={q}
          onChange={(v) => {
            setQ(v)
            setPage(1)
          }}
        />
        <select
          aria-label="Trạng thái giữ phòng"
          className="input w-auto"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả trạng thái</option>
          {bookingStatuses.map((s) => (
            <option key={s} value={s}>
              {
                {
                  REQUESTED: 'Đã yêu cầu',
                  AWAITING_PAYMENT: 'Chờ thanh toán',
                  CONFIRMED: 'Đã xác nhận',
                  CONVERTED: 'Đã chuyển hợp đồng',
                  EXPIRED: 'Hết hạn',
                  CANCELLED: 'Đã hủy',
                  REJECTED: 'Từ chối',
                }[s]
              }
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
            label: 'Giữ phòng',
            render: (b) => (
              <>
                <ManagerLink to={`/manager/bookings/${b.id}`}>{b.roomTitle}</ManagerLink>
                <p className="text-xs text-muted-foreground">{b.slotLabel || 'Nguyên phòng'}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {b.requesterName} · {b.requesterPhone || b.requesterEmail}
                </p>
              </>
            ),
          },
          {
            label: 'Thời hạn thuê',
            render: (b) => (
              <>
                {dateOnly(b.startDate)} – {dateOnly(b.endDate)}
              </>
            ),
          },
          {
            label: 'Khoản giữ',
            render: (b) => (
              <>
                <strong>{formatVnd(b.holdAmount)}</strong>
                <p className="text-xs text-muted-foreground">
                  {b.paymentEnvironment === 'SANDBOX' ? 'Mô phỏng' : 'Nhà cung cấp'}
                </p>
              </>
            ),
          },
          { label: 'Trạng thái', render: (b) => <ManagerStatus value={b.status} /> },
        ]}
      />
    </ManagerPage>
  )
}
export function ManagerBookingDetail() {
  const { bookingId = '' } = useParams(),
    { branch } = useManager(),
    navigate = useNavigate(),
    query = useManagerQuery(
      'booking',
      (b) => managerApi.get(b, 'bookings', bookingId),
      [bookingId],
      true,
    ),
    payments = useManagerList('payments', { bookingId, size: '100' }, true),
    [decision, setDecision] = useState(''),
    mutation = useManagerAction((result) => {
      if (decision === 'convert' && result?.id)
        navigate(managerLink(`/manager/contracts/${result.id}`, branch.id))
      setDecision('')
    })
  return (
    <ManagerPage
      title="Chi tiết giữ phòng"
      actions={<ManagerLink to="/manager/bookings">Danh sách giữ phòng</ManagerLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <Facts
                items={[
                  [
                    'Phòng / chỗ',
                    `${query.data.roomTitle} · ${query.data.slotLabel || 'Nguyên phòng'}`,
                  ],
                  ['Trạng thái', <ManagerStatus value={query.data.status} />],
                  [
                    'Thời hạn thuê',
                    `${dateOnly(query.data.startDate)} – ${dateOnly(query.data.endDate)}`,
                  ],
                  ['Khoản giữ', formatVnd(query.data.holdAmount)],
                  [
                    'Người đặt',
                    `${query.data.requesterName} · ${query.data.requesterEmail} · ${query.data.requesterPhone || ''}`,
                  ],
                  ['Hạn thanh toán', dateTime(query.data.paymentDueAt)],
                  [
                    'Giữ đến',
                    dateTime(query.data.confirmedHoldUntil || query.data.temporaryHoldUntil),
                  ],
                ]}
              />
              <div className="mt-6 flex flex-wrap gap-3">
                {['REQUESTED', 'AWAITING_PAYMENT'].includes(query.data.status) && (
                  <>
                    <Button onClick={() => setDecision('confirm')}>Xác nhận sau xác minh</Button>
                    <Button variant="outline" onClick={() => setDecision('reject')}>
                      Từ chối
                    </Button>
                    <Button variant="outline" onClick={() => setDecision('cancel')}>
                      Hủy yêu cầu
                    </Button>
                  </>
                )}
                {query.data.status === 'CONFIRMED' && (
                  <Button onClick={() => setDecision('convert')}>Tạo hợp đồng từ giữ phòng</Button>
                )}
                {query.data.contractId && (
                  <ManagerLink to={`/manager/contracts/${query.data.contractId}`}>
                    Mở hợp đồng
                  </ManagerLink>
                )}
              </div>
            </Panel>
            <Notice>
              Khoản giữ phòng không tự chuyển thành tiền thuê trả trước. Hợp đồng mới ở trạng thái
              nháp cho đến khi đủ điều kiện kích hoạt.
            </Notice>
            <Records
              query={payments}
              page={1}
              onPage={() => undefined}
              columns={[
                {
                  label: 'Giao dịch',
                  render: (p) => (
                    <ManagerLink to={`/manager/payments/${p.id}`}>{p.reference}</ManagerLink>
                  ),
                },
                { label: 'Số tiền', render: (p) => formatVnd(p.amountReceived) },
                { label: 'Trạng thái', render: (p) => <ManagerStatus value={p.status} /> },
              ]}
              empty="Chưa có giao dịch giữ phòng."
            />
            <Panel>
              <History items={query.data.timeline} />
            </Panel>
          </>
        )}
      </QueryState>
      {decision === 'convert' ? (
        <Modal
          title="Tạo hợp đồng nháp"
          open
          onOpenChange={(v) => {
            if (!v && !mutation.isPending) setDecision('')
          }}
        >
          <ManagerForm
            schema={z.object({
              code: z.string().trim().min(3),
              terms: z.string().trim().min(10),
              monthlyRent: z.number().int().positive(),
              firstMonthRent: z.number().int().nonnegative(),
              lastMonthRent: z.number().int().nonnegative(),
            })}
            defaults={{ code: '', terms: '', monthlyRent: 0, firstMonthRent: 0, lastMonthRent: 0 }}
            fields={[
              { name: 'code', label: 'Mã hợp đồng' },
              { name: 'terms', label: 'Điều khoản đã thỏa thuận', kind: 'textarea' },
              { name: 'monthlyRent', label: 'Giá thuê hàng tháng (VND)', kind: 'number' },
              { name: 'firstMonthRent', label: 'Giá thuê kỳ đầu (VND)', kind: 'number' },
              {
                name: 'lastMonthRent',
                label: 'Giá thuê kỳ cuối (VND)',
                kind: 'number',
                hint: 'Thuê đúng 1 tháng: nhập 0, chỉ trả trước kỳ đầu.',
              },
            ]}
            pending={mutation.isPending}
            error={mutation.error}
            submitLabel="Xác nhận tạo hợp đồng nháp"
            onSubmit={(value) =>
              mutation.mutate({ resource: 'bookings', id: bookingId, action: 'convert', value })
            }
          />
        </Modal>
      ) : (
        <ActionDialog
          title="Xử lý giữ phòng"
          open={!!decision}
          onOpenChange={(v) => {
            if (!v) setDecision('')
          }}
          pending={mutation.isPending}
          error={mutation.error}
          onConfirm={(data) =>
            mutation.mutate({ resource: 'bookings', id: bookingId, value: { ...data, decision } })
          }
        />
      )}
    </ManagerPage>
  )
}
export function ManagerContracts() {
  const [q, setQ] = useState(''),
    [status, setStatus] = useState(''),
    [page, setPage] = useState(1),
    query = useManagerList('contracts', { q, status, page: String(page - 1) }, true)
  return (
    <ManagerPage
      title="Hợp đồng thuê"
      actions={
        <ManagerLink to="/manager/contracts/new" button>
          Tạo hợp đồng
        </ManagerLink>
      }
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
          aria-label="Trạng thái hợp đồng"
          className="input w-auto"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="DRAFT">Nháp</option>
          <option value="ACTIVE">Hiệu lực</option>
          <option value="ENDED">Kết thúc</option>
          <option value="CANCELLED">Đã hủy</option>
        </select>
      </div>
      <Records
        query={query}
        page={page}
        onPage={setPage}
        columns={[
          {
            label: 'Hợp đồng',
            render: (c) => (
              <>
                <ManagerLink to={`/manager/contracts/${c.id}`}>{c.code}</ManagerLink>
                <p className="text-xs text-muted-foreground">{c.roomName}</p>
              </>
            ),
          },
          {
            label: 'Đại diện / thành viên',
            render: (c) => (
              <>
                {c.representativeName || 'Chưa có đại diện'}
                <p className="text-xs text-muted-foreground">
                  {c.tenantCount} quan hệ thuê ·{' '}
                  {c.rentalMode === 'SLOT' ? 'Thuê chỗ' : 'Nguyên phòng'}
                </p>
              </>
            ),
          },
          {
            label: 'Thời hạn',
            render: (c) => (
              <>
                {dateOnly(c.startDate)} – {dateOnly(c.endDate)}
              </>
            ),
          },
          { label: 'Trạng thái', render: (c) => <ManagerStatus value={c.status} /> },
        ]}
      />
    </ManagerPage>
  )
}
export function ManagerContractEditor() {
  const { contractId } = useParams(),
    { branch } = useManager(),
    navigate = useNavigate(),
    rooms = useManagerList('rooms', { size: '100' }),
    query = useManagerQuery(
      'contract-editor',
      (b) => (contractId ? managerApi.get(b, 'contracts', contractId) : Promise.resolve(null)),
      [contractId],
    ),
    mutation = useManagerAction((result) =>
      navigate(managerLink(`/manager/contracts/${result?.id || contractId}`, branch.id)),
    )
  return (
    <ManagerPage
      title={contractId ? 'Chỉnh sửa hợp đồng nháp' : 'Tạo hợp đồng thuê'}
      actions={<ManagerLink to="/manager/contracts">Danh sách hợp đồng</ManagerLink>}
    >
      <QueryState
        pending={query.isPending || rooms.isPending}
        error={query.error || rooms.error}
        retry={() => {
          void query.refetch()
          void rooms.refetch()
        }}
      >
        <Panel>
          <ManagerForm
            schema={contractInputSchema}
            defaults={
              query.data
                ? { ...query.data }
                : { code: '', roomId: '', startDate: '', endDate: '', terms: '' }
            }
            fields={[
              { name: 'code', label: 'Mã hợp đồng' },
              {
                name: 'roomId',
                label: 'Phòng',
                kind: 'select',
                options: rooms.data?.content
                  .filter((r) => r.operationalStatus === 'ACTIVE')
                  .map((r) => ({ value: r.id, label: `${r.code} · ${r.title}` })),
              },
              { name: 'startDate', label: 'Bắt đầu', kind: 'date' },
              { name: 'endDate', label: 'Kết thúc (không gồm)', kind: 'date' },
              { name: 'terms', label: 'Điều khoản chung', kind: 'textarea' },
            ]}
            pending={mutation.isPending}
            error={mutation.error}
            onSubmit={(value) =>
              mutation.mutate({
                resource: 'contracts',
                id: contractId,
                value,
                method: contractId ? 'PATCH' : 'POST',
              })
            }
          />
        </Panel>
      </QueryState>
    </ManagerPage>
  )
}
export function ManagerContractDetail() {
  const { contractId = '' } = useParams(),
    query = useManagerQuery(
      'contract',
      (b) => managerApi.get(b, 'contracts', contractId),
      [contractId],
      true,
    ),
    [action, setAction] = useState(''),
    mutation = useManagerAction(() => setAction(''))
  return (
    <ManagerPage
      title="Hồ sơ hợp đồng"
      actions={<ManagerLink to="/manager/contracts">Danh sách hợp đồng</ManagerLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <h2 className="mb-5 text-xl font-bold">{query.data.code}</h2>
              <Facts
                items={[
                  ['Trạng thái', <ManagerStatus value={query.data.status} />],
                  ['Đại diện', query.data.representativeName],
                  ['Phòng', query.data.roomName],
                  [
                    'Thời hạn',
                    `${dateOnly(query.data.startDate)} – ${dateOnly(query.data.endDate)}`,
                  ],
                  ['Số quan hệ thuê', query.data.tenantCount],
                ]}
              />
              <p className="mt-6 whitespace-pre-wrap text-sm leading-7">{query.data.terms}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ManagerLink to={`/manager/contracts/${contractId}/tenants`}>
                  Thành viên & nghĩa vụ cá nhân
                </ManagerLink>
                <ManagerLink to={`/manager/rooms/${query.data.roomId}`}>Phòng / chỗ ở</ManagerLink>
                {query.data.sourceBookingId && (
                  <ManagerLink to={`/manager/bookings/${query.data.sourceBookingId}`}>
                    Giữ phòng gốc
                  </ManagerLink>
                )}
                {query.data.status === 'DRAFT' && (
                  <>
                    <ManagerLink to={`/manager/contracts/${contractId}/edit`}>Sửa nháp</ManagerLink>
                    <Button onClick={() => setAction('activate')}>Kích hoạt hợp đồng</Button>
                    <Button variant="outline" onClick={() => setAction('cancel')}>
                      Hủy nháp
                    </Button>
                  </>
                )}
                {query.data.status === 'ACTIVE' && (
                  <Button variant="outline" onClick={() => setAction('end')}>
                    Kết thúc khi hết hạn
                  </Button>
                )}
              </div>
            </Panel>
            <Notice>
              Kích hoạt cần đúng một đại diện, không xung đột cư trú và đủ tiền thuê trả trước đã
              xác minh của từng thành viên.
            </Notice>
            <Panel>
              <h2 className="mb-5 font-bold">Lịch sử hợp đồng</h2>
              <History
                items={query.data.history.map((h) => ({ ...h, note: `${h.actor}: ${h.note}` }))}
              />
            </Panel>
          </>
        )}
      </QueryState>
      <ActionDialog
        title="Xác nhận thay đổi trạng thái hợp đồng"
        open={!!action}
        onOpenChange={(v) => {
          if (!v) setAction('')
        }}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={(value) =>
          mutation.mutate({ resource: 'contracts', id: contractId, action, value })
        }
      />
    </ManagerPage>
  )
}
export function ManagerContractTenants() {
  const { contractId = '' } = useParams(),
    contract = useManagerQuery(
      'contract',
      (b) => managerApi.get(b, 'contracts', contractId),
      [contractId],
      true,
    ),
    query = useManagerList('tenants', { contractId, size: '100' }, true),
    users = useManagerQuery('eligible-users', managerApi.users),
    slots = useManagerList('slots', { roomId: contract.data?.roomId || '', size: '100' }),
    [editing, setEditing] = useState<ManagerTenancy | null | undefined>(undefined),
    [action, setAction] = useState<{ id: string; action: string } | null>(null),
    mutation = useManagerAction(() => {
      setEditing(undefined)
      setAction(null)
    })
  const fields: FieldSpec[] = [
    {
      name: 'userId',
      label: 'Tài khoản đã xác minh',
      kind: 'select',
      options: users.data?.map((u) => ({ value: u.id, label: `${u.fullName} · ${u.email}` })),
    },
    {
      name: 'roomSlotId',
      label: 'Chỗ ở (chỉ thuê chỗ)',
      kind: 'select',
      nullable: true,
      options: slots.data?.content.map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` })),
    },
    {
      name: 'role',
      label: 'Vai trò',
      kind: 'select',
      options: [
        { value: 'REPRESENTATIVE', label: 'Đại diện' },
        { value: 'MEMBER', label: 'Thành viên' },
      ],
    },
    { name: 'startDate', label: 'Bắt đầu cư trú', kind: 'date' },
    { name: 'endDate', label: 'Kết thúc cư trú (không gồm)', kind: 'date' },
    ...(
      [
        'monthlyRent',
        'firstMonthRent',
        'lastMonthRent',
        'prepaidFirstRequired',
        'prepaidLastRequired',
      ] as const
    ).map((name, n) => ({
      name,
      label:
        [
          'Giá thuê hàng tháng',
          'Giá thuê kỳ đầu',
          'Giá thuê kỳ cuối',
          'Trả trước kỳ đầu',
          'Trả trước kỳ cuối',
        ][n] + ' (VND)',
      kind: 'number' as const,
      hint:
        name === 'lastMonthRent' || name === 'prepaidLastRequired'
          ? 'Thuê đúng 1 tháng: nhập 0, chỉ trả trước kỳ đầu.'
          : undefined,
    })),
    { name: 'terms', label: 'Điều khoản cá nhân', kind: 'textarea' },
  ]
  return (
    <ManagerPage
      title="Thành viên & nghĩa vụ cá nhân"
      description={contract.data?.code}
      actions={<ManagerLink to={`/manager/contracts/${contractId}`}>Hợp đồng</ManagerLink>}
    >
      <QueryState
        pending={contract.isPending || users.isPending}
        error={contract.error || users.error}
        retry={() => {
          void contract.refetch()
          void users.refetch()
        }}
      >
        <Notice>
          Chọn tài khoản đã có yêu cầu/quan hệ tại chi nhánh. Hồ sơ tài khoản không bị ghi đè khi
          thêm người thuê.
        </Notice>
        {['DRAFT', 'ACTIVE'].includes(contract.data?.status || '') && (
          <div>
            <Button onClick={() => setEditing(null)}>Thêm thành viên</Button>
          </div>
        )}
        <Records
          query={query}
          page={1}
          onPage={() => undefined}
          columns={[
            {
              label: 'Người thuê',
              render: (t) => (
                <>
                  <ManagerLink to={`/manager/tenancies/${t.id}`}>{t.userName}</ManagerLink>
                  <p className="text-xs text-muted-foreground">
                    {t.slotName || 'Nguyên phòng'} ·{' '}
                    {t.role === 'REPRESENTATIVE' ? 'Đại diện' : 'Thành viên'}
                  </p>
                </>
              ),
            },
            {
              label: 'Giá thuê / trả trước',
              render: (t) => (
                <>
                  <strong>{formatVnd(t.monthlyRent)}/tháng</strong>
                  <p className="text-xs text-muted-foreground">
                    Đầu: {formatVnd(t.prepaidFirstRequired)} · Cuối:{' '}
                    {formatVnd(t.prepaidLastRequired)}
                  </p>
                </>
              ),
            },
            { label: 'Trạng thái', render: (t) => <ManagerStatus value={t.status} /> },
            {
              label: 'Thao tác',
              render: (t) => (
                <div className="flex flex-wrap gap-2">
                  {t.status === 'DRAFT' && (
                    <Button variant="outline" onClick={() => setEditing(t)}>
                      Sửa nghĩa vụ
                    </Button>
                  )}
                  {t.status === 'DRAFT' && contract.data?.status === 'ACTIVE' && (
                    <Button
                      variant="outline"
                      onClick={() => setAction({ id: t.id, action: 'activate' })}
                    >
                      Kích hoạt
                    </Button>
                  )}
                  {t.status === 'ACTIVE' && t.role === 'MEMBER' && (
                    <Button
                      variant="outline"
                      onClick={() => setAction({ id: t.id, action: 'representative' })}
                    >
                      Chọn đại diện
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </QueryState>
      <Modal
        title={editing ? 'Sửa nghĩa vụ nháp' : 'Thêm thành viên'}
        open={editing !== undefined}
        onOpenChange={(v) => {
          if (!v && !mutation.isPending) setEditing(undefined)
        }}
      >
        {editing !== undefined && (
          <ManagerForm
            schema={tenancyInputSchema}
            defaults={
              editing
                ? { ...editing }
                : {
                    userId: '',
                    roomSlotId: '',
                    role: 'MEMBER',
                    startDate: contract.data?.startDate,
                    endDate: contract.data?.endDate,
                    monthlyRent: 0,
                    firstMonthRent: 0,
                    lastMonthRent: 0,
                    prepaidFirstRequired: 0,
                    prepaidLastRequired: 0,
                    terms: '',
                  }
            }
            fields={fields}
            pending={mutation.isPending}
            error={mutation.error}
            onSubmit={(value) =>
              mutation.mutate({
                resource: 'tenants',
                id: editing?.id,
                value: { ...value, contractId },
                method: editing ? 'PATCH' : 'POST',
              })
            }
          />
        )}
      </Modal>
      <ActionDialog
        title="Cập nhật quan hệ thuê"
        open={!!action}
        onOpenChange={(v) => {
          if (!v) setAction(null)
        }}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={(value) =>
          mutation.mutate({
            resource: 'tenants',
            id: action!.id,
            action: action!.action,
            value: { ...value, contractId },
          })
        }
      />
    </ManagerPage>
  )
}
