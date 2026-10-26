import { useState } from 'react'
import { Link } from 'react-router'
import { Panel, QueryState, Notice, Modal } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { Records, ManagerStatus, ActionDialog } from '@/features/manager/components'
import { ownerApi } from '@/services/owner'
import type { OwnerSummary } from '@/interfaces/owner'
import { useOwner, useOwnerList, useOwnerQuery, useOwnerMutation, operationsLink } from './context'
import { OwnerPage, OwnerFilters, MoneyStats } from './components'
import { useOwnerFilters } from './context'
import { dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
function BranchComparison({ data }: { data: OwnerSummary }) {
  const max = Math.max(1, ...data.rows.flatMap((r) => [r.billed, r.receipts]))
  return (
    <Panel>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold">Hóa đơn & thực thu</h2>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>
            <i className="mr-1 inline-block size-2 bg-primary" />
            Đã phát hành
          </span>
          <span>
            <i className="mr-1 inline-block size-2 bg-slate-400" />
            Thực thu
          </span>
        </div>
      </div>
      {data.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có chi nhánh trong phạm vi.</p>
      ) : (
        <div className="grid gap-6">
          {data.rows.map((r) => (
            <div key={r.id}>
              <Link className="text-sm font-bold text-primary" to={`/owner/branches/${r.id}`}>
                {r.name}
              </Link>
              <div className="mt-3 grid gap-2">
                {[
                  ['Đã phát hành', r.billed, 'bg-primary'],
                  ['Thực thu', r.receipts, 'bg-slate-400'],
                ].map(([label, amount, color]) => (
                  <div
                    key={String(label)}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
                  >
                    <div className="h-2 overflow-hidden rounded-sm bg-background">
                      <div
                        className={`h-full ${color}`}
                        style={{ width: `${(Number(amount) / max) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums">
                      <span className="sr-only">{label}: </span>
                      {formatVnd(Number(amount))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-5 text-xs leading-5 text-muted-foreground">
        Kỳ {data.period}. Thực thu theo ngày xác minh, gồm tiền thuê trả trước thực nhận; không gồm
        tiền giữ phòng hoặc sandbox.
      </p>
    </Panel>
  )
}
function Utilization({ data }: { data: OwnerSummary }) {
  return (
    <Panel>
      <h2 className="mb-5 font-bold">Tài nguyên & vận hành</h2>
      <div className="divide-y divide-border">
        {data.rows.map((r) => (
          <div key={r.id} className="py-4 first:pt-0">
            <div className="flex flex-wrap justify-between gap-2">
              <h3 className="text-sm font-bold">{r.name}</h3>
              <ManagerStatus value={r.status} />
            </div>
            <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Phòng nguyên căn (ROOM)</dt>
                <dd className="mt-1 font-bold">
                  {r.rooms.occupied} đang ở · {r.rooms.held} giữ · {r.rooms.available} trống /{' '}
                  {r.rooms.total} phòng
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Chỗ ở (SLOT đang hoạt động)</dt>
                <dd className="mt-1 font-bold">
                  {r.slots.occupied} đang ở · {r.slots.held} giữ · {r.slots.available} trống ·{' '}
                  {r.slots.unavailable} không phục vụ / {r.slots.total} chỗ
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Hợp đồng / sửa chữa mở</dt>
                <dd className="mt-1 font-bold">
                  {r.activeContracts} / {r.maintenanceCount}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Quản lý chính</dt>
                <dd className="mt-1 font-bold">{r.managerName || 'Cần phân công'}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-primary">
              <Link to={operationsLink(r.id, 'rooms')}>Phòng và chỗ ở</Link>
              <Link to={operationsLink(r.id, 'bookings')}>Giữ phòng ({r.bookingCount})</Link>
              <Link to={operationsLink(r.id, 'debts')}>Công nợ</Link>
              <Link to={operationsLink(r.id, 'maintenance')}>Sửa chữa</Link>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Tài nguyên là trạng thái hiện tại. Hợp đồng đang hoạt động; giữ phòng theo tháng tạo yêu
        cầu.
      </p>
    </Panel>
  )
}
export function OwnerOverview({
  kind = 'dashboard',
}: {
  kind?: 'dashboard' | 'finance' | 'reports'
}) {
  const { scope, branches } = useOwner(),
    state = useOwnerFilters({ month: new Date().toISOString().slice(0, 7) }),
    query = useOwnerQuery(
      'summary',
      () => ownerApi.summary({ month: state.filters.month, ...(scope ? { branchId: scope } : {}) }),
      [state.filters.month],
    ),
    title =
      kind === 'finance'
        ? 'Tài chính'
        : kind === 'reports'
          ? 'Báo cáo chi nhánh'
          : 'Tổng quan chủ trọ'
  return (
    <OwnerPage title={title} description="Theo dõi chi nhánh, dòng tiền và các việc cần xử lý.">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-3 text-sm">
          Kỳ báo cáo
          <input
            className="input w-auto max-w-full"
            aria-label="Kỳ báo cáo"
            type="month"
            value={state.filters.month}
            onChange={(e) => state.change('month', e.target.value)}
          />
        </label>
        {kind === 'dashboard' && (
          <Link className="text-sm font-bold text-primary" to="/owner/branches/new">
            Tạo chi nhánh
          </Link>
        )}
      </div>
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            {kind === 'dashboard' && (
              <div className="flex flex-wrap gap-x-8 gap-y-3 border-y border-border py-5 text-sm">
                <span>
                  <strong className="mr-2 text-2xl">{query.data.rows.length}</strong>chi nhánh
                </span>
                {['ACTIVE', 'DRAFT', 'INACTIVE'].map((status, i) => (
                  <span key={status}>
                    {query.data!.rows.filter((r) => r.status === status).length}{' '}
                    {['hoạt động', 'nháp', 'ngừng hoạt động'][i]}
                  </span>
                ))}
                <span>{query.data.rows.filter((r) => !r.managerName).length} cần phân công</span>
                <span>{query.data.rows.reduce((n, r) => n + r.roomCount, 0)} phòng tổng cộng</span>
                <span>
                  {query.data.rows.reduce((n, r) => n + r.slots.total, 0)} chỗ SLOT hoạt động
                </span>
              </div>
            )}
            <MoneyStats
              items={[
                ['Hóa đơn đã phát hành trong kỳ', query.data.totals.billed],
                ['Thực thu xác minh trong kỳ', query.data.totals.receipts],
                ['Dư nợ hóa đơn kỳ báo cáo', query.data.totals.debt],
                ['Nợ quá hạn của kỳ báo cáo', query.data.totals.overdue],
                ['Thu sandbox trong kỳ (tách riêng)', query.data.totals.sandboxReceipts],
                ['Tiền chưa phân bổ (lũy kế thực)', query.data.totals.unmatched],
              ]}
            />
            <div className="flex flex-wrap gap-5 text-sm font-bold text-primary">
              <Link to={`/owner/approvals/invoices${scope ? `?branchId=${scope}` : ''}`}>
                {query.data.pendingApprovals} yêu cầu chờ duyệt
              </Link>
              <Link to={`/owner/payments?status=REVIEW${scope ? `&branchId=${scope}` : ''}`}>
                {query.data.totals.exceptions} giao dịch cần đối soát
              </Link>
              <Link to={`/owner/payments${scope ? `?branchId=${scope}` : ''}`}>Xem giao dịch</Link>
              <Link to={`/owner/manager-assignments${scope ? `?branchId=${scope}` : ''}`}>
                Kiểm tra phân công
              </Link>
            </div>
            <BranchComparison data={query.data} />
            {kind === 'finance' ? (
              <>
                <h2 className="font-bold">Số dư lũy kế thực nhận</h2>
                <MoneyStats
                  items={[
                    ['Tiền thuê trả trước đã nhận', query.data.totals.prepaidReceived],
                    ['Trả trước đã áp dụng', query.data.totals.prepaidApplied],
                    ['Trả trước chưa sử dụng', query.data.totals.prepaidUnused],
                    ['Tiền giữ phòng thực nhận', query.data.totals.holdReceived],
                    ['Tiền giữ sandbox (tách riêng)', query.data.totals.holdSandbox],
                  ]}
                />
                <Notice>
                  Áp dụng trả trước không tạo dòng tiền mới. Chưa định nghĩa doanh thu kế toán hoặc
                  triển khai hoàn tiền. Dư nợ theo kỳ báo cáo; mở công nợ từng chi nhánh để xem mọi
                  kỳ.
                </Notice>
              </>
            ) : null}
            <Utilization data={query.data} />
            {kind === 'reports' && (
              <Panel>
                <Facts
                  items={[
                    ['Hóa đơn đã phát hành trong kỳ', String(query.data.totals.invoiceCount)],
                    ['Hóa đơn quá hạn trong kỳ', String(query.data.totals.overdueCount)],
                    ['Hợp đồng đang hoạt động', String(query.data.totals.activeContracts)],
                    ['Quan hệ thuê đang hoạt động', String(query.data.totals.activeTenancies)],
                    ['Giữ phòng tạo trong kỳ', String(query.data.totals.bookingCount)],
                    ['Sửa chữa chưa hoàn tất', String(query.data.totals.maintenanceCount)],
                    [
                      'Phân công quản lý',
                      `${query.data.rows.filter((r) => r.managerName).length}/${query.data.rows.length} chi nhánh`,
                    ],
                  ]}
                />
              </Panel>
            )}
            {kind === 'dashboard' && <RecentOwnerActivity />}
          </>
        )}
      </QueryState>
      {branches.length === 0 && <Notice>Bắt đầu bằng việc tạo một chi nhánh nháp.</Notice>}
    </OwnerPage>
  )
}
export const OwnerDashboard = () => <OwnerOverview />
export const OwnerFinance = () => <OwnerOverview kind="finance" />
export const OwnerReports = () => <OwnerOverview kind="reports" />
function RecentOwnerActivity() {
  const query = useOwnerList('activity', { size: '4' })
  return (
    <Panel>
      <div className="mb-4 flex justify-between gap-3">
        <h2 className="font-bold">Sự kiện gần đây</h2>
        <Link className="text-sm font-bold text-primary" to="/owner/activity">
          Xem tất cả
        </Link>
      </div>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
        empty={query.data?.content.length === 0}
        emptyMessage="Chưa có sự kiện mới."
        emptyAction={null}
      >
        <div className="divide-y divide-border">
          {query.data?.content.map((a) => (
            <div className="py-3" key={a.id}>
              <p className="text-sm">{a.summary}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {dateTime(a.at)} · {a.actorName}
              </p>
            </div>
          ))}
        </div>
      </QueryState>
    </Panel>
  )
}
export function OwnerPayments() {
  const state = useOwnerFilters({ month: '', environment: '', targetType: '' }),
    query = useOwnerList('payments', state.filters)
  return (
    <OwnerPage
      title="Giao dịch & đối soát"
      description="Tiền nhận, tiền phân bổ và môi trường thanh toán được theo dõi riêng."
    >
      <OwnerFilters
        state={state}
        period
        statuses={[
          { value: 'PENDING', label: 'Chờ xác minh' },
          { value: 'VERIFIED', label: 'Đã xác minh' },
          { value: 'REVIEW', label: 'Cần đối soát' },
          { value: 'FAILED', label: 'Thất bại' },
        ]}
      >
        <select
          aria-label="Môi trường giao dịch"
          className="input w-auto"
          value={state.filters.environment}
          onChange={(e) => state.change('environment', e.target.value)}
        >
          <option value="">Mọi môi trường</option>
          <option value="SANDBOX">Sandbox</option>
          <option value="LIVE">Thực tế (LIVE)</option>
          <option value="PRODUCTION">Thực tế (PRODUCTION)</option>
        </select>
        <select
          aria-label="Loại nghĩa vụ"
          className="input w-auto"
          value={state.filters.targetType}
          onChange={(e) => state.change('targetType', e.target.value)}
        >
          <option value="">Mọi nghĩa vụ</option>
          <option value="INVOICE">Hóa đơn</option>
          <option value="PREPAID_RENT">Trả trước</option>
          <option value="BOOKING_HOLD">Giữ phòng</option>
        </select>
      </OwnerFilters>
      <Records
        query={query}
        page={state.page}
        onPage={state.onPage}
        columns={[
          {
            label: 'Tham chiếu / chi nhánh',
            render: (p) => (
              <Link
                to={operationsLink(p.branchId, `payments/${p.id}`)}
                className="font-bold text-primary"
              >
                {p.reference}
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {p.branchName} · {p.payerName}
                </span>
              </Link>
            ),
          },
          {
            label: 'Nghĩa vụ',
            render: (p) =>
              p.targetType === 'INVOICE'
                ? 'Hóa đơn'
                : p.targetType === 'PREPAID_RENT'
                  ? 'Trả trước'
                  : 'Giữ phòng',
          },
          {
            label: 'Nhận / phân bổ',
            render: (p) => (
              <>
                {formatVnd(p.amountReceived)}
                <span className="mt-1 block text-xs text-muted-foreground">
                  Phân bổ: {formatVnd(p.allocatedAmount)}
                </span>
              </>
            ),
          },
          {
            label: 'Trạng thái',
            render: (p) => (
              <>
                <ManagerStatus value={p.status} />
                <p className="mt-2 text-xs">
                  {p.method} · {p.environment === 'SANDBOX' ? 'Sandbox' : 'Thực tế'}
                </p>
              </>
            ),
          },
          {
            label: 'Ghi nhận',
            render: (p) => (
              <span className="text-xs">
                {dateTime(p.createdAt)}
                {p.note && <span className="mt-1 block text-muted-foreground">{p.note}</span>}
              </span>
            ),
          },
        ]}
      />
      <Notice>
        Mở giao dịch để xem chứng cứ, lịch sử và xác minh QR đủ điều kiện trong công cụ đối soát
        dùng chung. Hoàn tiền và kết nối ngân hàng thật chưa được triển khai.
      </Notice>
    </OwnerPage>
  )
}
export function OwnerApprovals() {
  const state = useOwnerFilters(),
    query = useOwnerList('approvals', state.filters),
    [id, setId] = useState<string | null>(null),
    [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | null>(null),
    mutation = useOwnerMutation(() => {
      setDecision(null)
    }),
    current = query.data?.content.find((p) => p.id === id)
  return (
    <OwnerPage
      title="Duyệt điều chỉnh hóa đơn"
      description="Quyết định phê duyệt được lưu riêng với việc thực thi điều chỉnh."
    >
      <OwnerFilters
        state={state}
        statuses={[
          { value: 'PENDING', label: 'Chờ duyệt' },
          { value: 'APPROVED', label: 'Đã duyệt' },
          { value: 'REJECTED', label: 'Từ chối' },
        ]}
      />
      <Records
        query={query}
        page={state.page}
        onPage={state.onPage}
        empty="Chưa có yêu cầu điều chỉnh phù hợp."
        columns={[
          {
            label: 'Yêu cầu',
            render: (p) => (
              <button
                className="min-h-11 text-left text-sm font-bold text-primary"
                onClick={() => {
                  setId(p.id)
                  mutation.reset()
                }}
              >
                Hóa đơn kỳ {p.billingMonth.slice(0, 7)}
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {p.requesterName} · {dateTime(p.createdAt)}
                </span>
              </button>
            ),
          },
          {
            label: 'Hiện tại / đề xuất',
            render: (p) => (
              <>
                {formatVnd(p.originalTotal)}
                <span className="mt-1 block text-xs text-muted-foreground">
                  Đề xuất {formatVnd(p.proposedTotal)}
                </span>
              </>
            ),
          },
          {
            label: 'Trạng thái',
            render: (p) => (
              <>
                <ManagerStatus value={p.status} />
                <p className="mt-2 text-xs text-muted-foreground">Chưa áp dụng</p>
              </>
            ),
          },
          { label: 'Lý do', render: (p) => p.reason },
        ]}
      />
      <Modal
        title="Chi tiết yêu cầu điều chỉnh"
        open={!!current && !decision}
        onOpenChange={(v) => {
          if (!v) setId(null)
        }}
      >
        {current && (
          <div className="grid gap-5">
            <Facts
              items={[
                ['Người yêu cầu', current.requesterName],
                ['Kỳ hóa đơn', current.billingMonth.slice(0, 7)],
                ['Giá trị đã phát hành', formatVnd(current.originalTotal)],
                ['Giá trị đề xuất', formatVnd(current.proposedTotal)],
                ['Tác động dự kiến', formatVnd(current.proposedTotal - current.originalTotal)],
                ['Lý do', current.reason],
                ['Quyết định', <ManagerStatus value={current.status} />],
                ['Thực thi', 'Chưa áp dụng'],
              ]}
            />
            <Link
              className="text-sm font-bold text-primary"
              to={operationsLink(current.branchId, `invoices/${current.invoiceId}`)}
            >
              Xem hóa đơn gốc
            </Link>
            {current.evidence.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {current.evidence.map((image, i) => (
                  <img
                    src={image}
                    alt={`Chứng cứ ${i + 1}`}
                    key={image}
                    className="w-full rounded-lg"
                  />
                ))}
              </div>
            )}
            {current.history.map((h, i) => (
              <p key={i} className="text-sm leading-6">
                {dateTime(h.at)} · {h.actor}: {h.note}
              </p>
            ))}
            <Notice>
              Phê duyệt chỉ ghi nhận quyết định. Hóa đơn đã phát hành và các giao dịch giữ nguyên,
              chờ quy trình điều chỉnh được chốt.
            </Notice>
            {current.status === 'PENDING' && (
              <div className="flex gap-3">
                <Button onClick={() => setDecision('APPROVED')}>Chấp thuận đề xuất</Button>
                <Button variant="outline" onClick={() => setDecision('REJECTED')}>
                  Từ chối
                </Button>
              </div>
            )}
            {mutation.isSuccess && <Notice tone="success">Đã ghi nhận quyết định.</Notice>}
          </div>
        )}
      </Modal>
      <ActionDialog
        title={
          decision === 'APPROVED' ? 'Chấp thuận đề xuất điều chỉnh?' : 'Từ chối đề xuất điều chỉnh?'
        }
        open={!!decision}
        onOpenChange={(v) => {
          if (!v) setDecision(null)
        }}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={(v) => mutation.mutate({ path: `/approvals/${id}`, value: { ...v, decision } })}
      />
    </OwnerPage>
  )
}
export function OwnerActivityPage() {
  const state = useOwnerFilters({ month: '', type: '' }),
    query = useOwnerList('activity', state.filters),
    { branches } = useOwner()
  return (
    <OwnerPage
      title="Hoạt động quan trọng"
      description="Theo dõi thay đổi phân công, chính sách và chứng từ trong phạm vi chủ trọ."
    >
      <OwnerFilters state={state} period>
        <select
          aria-label="Loại hoạt động"
          className="input w-auto"
          value={state.filters.type}
          onChange={(e) => state.change('type', e.target.value)}
        >
          <option value="">Mọi hoạt động</option>
          {[
            ['BRANCH', 'Chi nhánh'],
            ['ASSIGNMENT', 'Phân công'],
            ['INVITATION', 'Lời mời'],
            ['POLICY', 'Chính sách'],
            ['QR', 'QR nhận tiền'],
            ['INVOICE', 'Hóa đơn'],
            ['PAYMENT', 'Giao dịch'],
            ['APPROVAL_REQUEST', 'Yêu cầu duyệt'],
            ['APPROVAL_DECISION', 'Quyết định duyệt'],
            ['MAINTENANCE', 'Sửa chữa'],
          ].map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </OwnerFilters>
      <Records
        query={query}
        page={state.page}
        onPage={state.onPage}
        empty="Chưa có hoạt động phù hợp."
        columns={[
          {
            label: 'Sự kiện',
            render: (a) => (
              <>
                {a.summary}
                {a.route && (
                  <Link className="mt-2 block text-xs font-bold text-primary" to={a.route}>
                    Mở hồ sơ liên quan
                  </Link>
                )}
              </>
            ),
          },
          {
            label: 'Chi nhánh',
            render: (a) => branches.find((b) => b.id === a.branchId)?.name || 'Quan hệ chủ trọ',
          },
          { label: 'Người thực hiện', render: (a) => a.actorName },
          { label: 'Thời gian', render: (a) => dateTime(a.at) },
        ]}
      />
    </OwnerPage>
  )
}
