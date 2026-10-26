import { useState } from 'react'
import { AdjustmentRequest } from './adjustment-request'
import { useNavigate, useParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { Panel, QueryState, Field, Modal, Notice, InlineError } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { invoiceInputSchema, type InvoiceSources } from '@/interfaces/manager'
import { managerApi } from '@/services/manager'
import { queryClient } from '@/services/query-client'
import { dateOnly, dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import {
  ManagerPage,
  ManagerLink,
  ManagerStatus,
  Records,
  SearchBox,
  ScopeFilters,
  ManagerForm,
  ActionDialog,
} from './components'
import {
  useManager,
  useManagerList,
  useManagerQuery,
  useManagerAction,
  managerLink,
} from './context'

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
export function ManagerInvoiceDetail() {
  const { invoiceId = '' } = useParams(),
    query = useManagerQuery(
      'invoice',
      (b) => managerApi.get(b, 'invoices', invoiceId),
      [invoiceId],
      true,
    ),
    payments = useManagerList('payments', { invoiceId, size: '100' }, true),
    [action, setAction] = useState(''),
    mutation = useManagerAction(() => setAction(''))
  return (
    <ManagerPage
      title="Chi tiết hóa đơn"
      actions={<ManagerLink to="/manager/invoices">Danh sách hóa đơn</ManagerLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <h2 className="mb-5 text-xl font-bold">{query.data.code}</h2>
              <Facts
                items={[
                  [
                    'Người thuê',
                    <ManagerLink to={`/manager/tenancies/${query.data.contractTenantId}`}>
                      {query.data.tenantName}
                    </ManagerLink>,
                  ],
                  ['Phòng', query.data.roomName],
                  [
                    'Kỳ / hạn thanh toán',
                    `${query.data.billingMonth.slice(0, 7)} · ${dateOnly(query.data.dueDate)}`,
                  ],
                  ['Chứng từ', <ManagerStatus value={query.data.documentStatus} />],
                  [
                    'Thanh toán',
                    query.data.documentStatus === 'ISSUED' ? (
                      <ManagerStatus value={query.data.financialStatus} />
                    ) : (
                      'Chưa phát hành'
                    ),
                  ],
                ]}
              />
              <div className="mt-6 divide-y divide-border">
                {query.data.items.map((i) => (
                  <div key={i.id} className="flex flex-wrap justify-between gap-3 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{i.label}</p>
                      <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
                        {i.snapshot}
                      </p>
                    </div>
                    <strong className="text-sm tabular-nums">{formatVnd(i.amount)}</strong>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-3 border-t border-border pt-5 text-sm">
                {[
                  ['Tổng nghĩa vụ', query.data.totalAmount],
                  ['Trả trước đã áp dụng', query.data.prepaidApplied],
                  ['Thanh toán đã phân bổ', query.data.verifiedAllocated],
                  ['Còn phải thanh toán', query.data.outstanding],
                ].map(([label, amount]) => (
                  <p key={String(label)} className="flex flex-wrap justify-between gap-3">
                    <span>{label}</span>
                    <strong className="tabular-nums">{formatVnd(Number(amount))}</strong>
                  </p>
                ))}
              </div>
              {query.data.documentStatus === 'DRAFT' && (
                <div className="mt-6 flex flex-wrap gap-3">
                  <ManagerLink to={`/manager/invoices/${invoiceId}/edit`}>Sửa nháp</ManagerLink>
                  <Button onClick={() => setAction('issue')}>Phát hành hóa đơn</Button>
                  <Button variant="outline" onClick={() => setAction('cancel')}>
                    Hủy nháp
                  </Button>
                </div>
              )}
              {query.data.documentStatus === 'ISSUED' && <div className="mt-6"><AdjustmentRequest invoiceId={invoiceId} total={query.data.totalAmount}/></div>}
            </Panel>
            {query.data.documentStatus === 'ISSUED' && (
              <Notice>
                Chứng từ đã phát hành được giữ nguyên. Điều chỉnh sau phát hành thuộc quy trình chủ
                sở hữu được duyệt.
              </Notice>
            )}
            <Records
              query={payments}
              page={1}
              onPage={() => undefined}
              columns={[
                {
                  label: 'Giao dịch liên quan',
                  render: (p) => (
                    <ManagerLink to={`/manager/payments/${p.id}`}>{p.reference}</ManagerLink>
                  ),
                },
                {
                  label: 'Tiền nhận / phân bổ',
                  render: (p) => (
                    <>
                      {formatVnd(p.amountReceived)} / {formatVnd(p.allocatedAmount)}
                    </>
                  ),
                },
                { label: 'Trạng thái', render: (p) => <ManagerStatus value={p.status} /> },
              ]}
              empty="Chưa có giao dịch liên quan."
            />
          </>
        )}
      </QueryState>
      <ActionDialog
        title={
          action === 'issue' ? 'Phát hành và gửi hóa đơn cho người thuê?' : 'Hủy hóa đơn nháp?'
        }
        open={!!action}
        onOpenChange={(v) => {
          if (!v) setAction('')
        }}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={(value) =>
          mutation.mutate({ resource: 'invoices', id: invoiceId, action, value })
        }
      />
    </ManagerPage>
  )
}
type InvoiceInput = z.infer<typeof invoiceInputSchema>
function InvoiceBuilder({
  tenantId,
  month,
  invoiceId,
  initial,
}: {
  tenantId: string
  month: string
  invoiceId?: string
  initial?: InvoiceInput
}) {
  const { branch } = useManager(),
    navigate = useNavigate(),
    sources = useManagerQuery(
      'invoice-sources',
      (b) => managerApi.sources(b, tenantId, month, invoiceId),
      [tenantId, month, invoiceId],
    ),
    [selected, setSelected] = useState<string[]>(
      initial?.sources.map((s) => `${s.type}:${s.id}`) || [],
    ),
    [prepaid, setPrepaid] = useState(
      initial?.prepaidSourcePaymentId
        ? `${initial.prepaidSourcePaymentId}:${initial.prepaidBucket}`
        : '',
    ),
    [preview, setPreview] = useState<InvoiceInput | null>(null),
    mutation = useManagerAction((result) =>
      navigate(managerLink(`/manager/invoices/${result?.id || invoiceId}`, branch.id)),
    )
  const total = (data: InvoiceInput, eligible: InvoiceSources) =>
    data.rentAmount +
    data.adjustment +
    eligible.sources
      .filter((s) => data.sources.some((v) => v.type === s.type && v.id === s.id))
      .reduce((sum, s) => sum + s.amount, 0)
  return (
    <QueryState pending={sources.isPending} error={sources.error} retry={sources.refetch}>
      {sources.data && (
        <Panel>
          <ManagerForm
            schema={invoiceInputSchema.omit({
              contractTenantId: true,
              billingMonth: true,
              sources: true,
              prepaidSourcePaymentId: true,
              prepaidBucket: true,
            })}
            defaults={
              initial
                ? { ...initial }
                : {
                    dueDate: sources.data.dueDate,
                    rentAmount: sources.data.rentAmount,
                    rentApprovalNote: sources.data.policyNote,
                    adjustment: 0,
                    adjustmentReason: '',
                    prepaidAmount: 0,
                  }
            }
            fields={[
              { name: 'dueDate', label: 'Hạn thanh toán', kind: 'date' },
              { name: 'rentAmount', label: 'Tiền thuê đã thỏa thuận (VND)', kind: 'number' },
              {
                name: 'rentApprovalNote',
                label: 'Căn cứ tiền thuê đã duyệt',
                kind: 'textarea',
                hint: 'Dùng số tiền đã được thỏa thuận; không tự chia giá theo ngày.',
              },
              { name: 'adjustment', label: 'Điều chỉnh trong nháp (VND)', kind: 'number' },
              { name: 'adjustmentReason', label: 'Lý do điều chỉnh', kind: 'textarea' },
              { name: 'prepaidAmount', label: 'Trả trước áp dụng (VND)', kind: 'number' },
            ]}
            pending={mutation.isPending}
            error={mutation.error}
            submitLabel="Xem trước hóa đơn"
            onSubmit={(data) => {
              const [paymentId, bucket] = prepaid.split(':')
              setPreview({
                ...data,
                contractTenantId: tenantId,
                billingMonth: month,
                sources: sources
                  .data!.sources.filter((s) => selected.includes(`${s.type}:${s.id}`))
                  .map(({ type, id }) => ({ type, id })),
                prepaidSourcePaymentId: paymentId || null,
                prepaidBucket: bucket || 'FIRST_MONTH',
              } as InvoiceInput)
            }}
          >
            <Notice>{sources.data.policyNote}</Notice>
            <fieldset className="grid gap-3">
              <legend className="mb-3 text-sm font-bold">Nguồn phí đã chốt / được duyệt</legend>
              {sources.data.sources.length ? (
                sources.data.sources.map((s) => (
                  <div key={`${s.type}:${s.id}`}>
                    <label className="flex min-h-11 items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 shrink-0 accent-primary"
                        checked={selected.includes(`${s.type}:${s.id}`)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, `${s.type}:${s.id}`]
                              : selected.filter((v) => v !== `${s.type}:${s.id}`),
                          )
                        }
                      />
                      <span>
                        {s.label} · <strong>{formatVnd(s.amount)}</strong>
                      </span>
                    </label>
                    {s.sourceRoute && <ManagerLink to={s.sourceRoute}>Xem nguồn phí</ManagerLink>}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Không có phí đủ điều kiện trong kỳ.</p>
              )}
            </fieldset>
            <Field id="invoice-prepaid-source" label="Nguồn trả trước đủ điều kiện">
              <select
                id="invoice-prepaid-source"
                className="input"
                value={prepaid}
                onChange={(e) => setPrepaid(e.target.value)}
              >
                <option value="">Không áp dụng</option>
                {sources.data.prepaid.map((p) => (
                  <option key={`${p.paymentId}:${p.bucket}`} value={`${p.paymentId}:${p.bucket}`}>
                    {p.label} · Tối đa {formatVnd(p.available)}
                  </option>
                ))}
              </select>
            </Field>
          </ManagerForm>
        </Panel>
      )}
      <Modal
        title="Kiểm tra hóa đơn trước khi lưu"
        open={!!preview}
        onOpenChange={(v) => {
          if (!v && !mutation.isPending) setPreview(null)
        }}
      >
        {preview && sources.data && (
          <div className="grid gap-5">
            <Facts
              items={[
                ['Kỳ hóa đơn', preview.billingMonth.slice(0, 7)],
                ['Tổng nghĩa vụ', formatVnd(total(preview, sources.data))],
                ['Trả trước áp dụng', formatVnd(preview.prepaidAmount)],
                [
                  'Còn lại dự kiến',
                  formatVnd(Math.max(0, total(preview, sources.data) - preview.prepaidAmount)),
                ],
              ]}
            />
            <Notice>
              Đây là hóa đơn nháp. Phát hành tại màn hình chi tiết sau khi kiểm tra nguồn phí và
              đúng người chịu nghĩa vụ.
            </Notice>
            <InlineError error={mutation.error} />
            <Button
              loading={mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  resource: 'invoices',
                  id: invoiceId,
                  value: preview,
                  method: invoiceId ? 'PATCH' : 'POST',
                })
              }
            >
              Lưu hóa đơn nháp
            </Button>
          </div>
        )}
      </Modal>
    </QueryState>
  )
}
export function ManagerInvoiceEditor() {
  const { invoiceId } = useParams(),
    tenants = useManagerList('tenants', { size: '100' }),
    initial = useManagerQuery(
      'invoice-editor',
      (b) => (invoiceId ? managerApi.invoiceEditor(b, invoiceId) : Promise.resolve(null)),
      [invoiceId],
    ),
    [tenantId, setTenant] = useState(''),
    [month, setMonth] = useState(new Date().toISOString().slice(0, 7)),
    id = initial.data?.contractTenantId || tenantId,
    period = initial.data?.billingMonth || `${month}-01`
  return (
    <ManagerPage
      title={invoiceId ? 'Chỉnh sửa hóa đơn nháp' : 'Lập hóa đơn cá nhân'}
      actions={<ManagerLink to="/manager/invoices">Danh sách hóa đơn</ManagerLink>}
    >
      <QueryState
        pending={tenants.isPending || initial.isPending}
        error={tenants.error || initial.error}
        retry={() => {
          void tenants.refetch()
          void initial.refetch()
        }}
      >
        <Panel>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="invoice-tenant" label="Người chịu nghĩa vụ">
              <select
                id="invoice-tenant"
                className="input"
                value={id}
                disabled={!!invoiceId}
                onChange={(e) => setTenant(e.target.value)}
              >
                <option value="">Chọn quan hệ thuê</option>
                {tenants.data?.content
                  .filter((t) => ['ACTIVE', 'LEFT'].includes(t.status))
                  .map((t) => (
                    <option value={t.id} key={t.id}>
                      {t.userName} · {t.roomName}
                      {t.slotName ? ` · ${t.slotName}` : ''}
                    </option>
                  ))}
              </select>
            </Field>
            <Field id="invoice-month" label="Kỳ hóa đơn">
              <input
                id="invoice-month"
                type="month"
                className="input"
                value={period.slice(0, 7)}
                disabled={!!invoiceId}
                onChange={(e) => setMonth(e.target.value)}
              />
            </Field>
          </div>
        </Panel>
        {id && month && (
          <InvoiceBuilder
            key={`${id}:${period}:${invoiceId}`}
            tenantId={id}
            month={period}
            invoiceId={invoiceId}
            initial={initial.data || undefined}
          />
        )}
      </QueryState>
    </ManagerPage>
  )
}
export function ManagerPayments() {
  const [q, setQ] = useState(''),
    [status, setStatus] = useState(''),
    [type, setType] = useState(''),
    [environment, setEnvironment] = useState(''),
    [page, setPage] = useState(1),
    [scope, setScope] = useState<Record<string, string>>({
      month: new URLSearchParams(location.search).get('month') || '',
    }),
    query = useManagerList(
      'payments',
      { q, status, targetType: type, environment, ...scope, page: String(page - 1) },
      true,
    )
  return (
    <ManagerPage
      title="Thanh toán & đối soát"
      description="Tách tiền giữ phòng, trả trước, tiền hóa đơn và giao dịch mô phỏng."
    >
      <ScopeFilters
        value={scope}
        onChange={(v) => {
          setScope(v)
          setPage(1)
        }}
        tenant
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
          aria-label="Loại thanh toán"
          className="input w-auto"
          value={type}
          onChange={(e) => {
            setType(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả loại</option>
          <option value="BOOKING_HOLD">Giữ phòng</option>
          <option value="PREPAID_RENT">Thuê trả trước</option>
          <option value="INVOICE">Hóa đơn</option>
        </select>
        <select
          aria-label="Môi trường thanh toán"
          className="input w-auto"
          value={environment}
          onChange={(e) => {
            setEnvironment(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả môi trường</option>
          <option value="SANDBOX">Mô phỏng</option>
          <option value="LIVE">Biên nhận ngân hàng</option>
          <option value="PRODUCTION">Nhà cung cấp</option>
        </select>
        <select
          aria-label="Trạng thái thanh toán"
          className="input w-auto"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="PENDING">Chờ xác minh</option>
          <option value="VERIFIED">Đã xác minh</option>
          <option value="REVIEW">Cần đối soát</option>
          <option value="FAILED">Thất bại</option>
        </select>
      </div>
      <Records
        query={query}
        page={page}
        onPage={setPage}
        columns={[
          {
            label: 'Giao dịch',
            render: (p) => (
              <>
                <ManagerLink to={`/manager/payments/${p.id}`}>{p.reference}</ManagerLink>
                <p className="text-xs text-muted-foreground">
                  {p.payerName} · {dateTime(p.createdAt)}
                </p>
              </>
            ),
          },
          {
            label: 'Nghĩa vụ',
            render: (p) => (
              <>
                <p>
                  {p.targetType === 'BOOKING_HOLD'
                    ? 'Giữ phòng'
                    : p.targetType === 'PREPAID_RENT'
                      ? 'Thuê trả trước'
                      : 'Hóa đơn'}
                </p>
                <p className="text-xs text-muted-foreground">{p.tenantName}</p>
              </>
            ),
          },
          {
            label: 'Nhận / phân bổ',
            render: (p) => (
              <>
                {formatVnd(p.amountReceived)}
                <p className="text-xs text-muted-foreground">
                  Phân bổ {formatVnd(p.allocatedAmount)}
                </p>
              </>
            ),
          },
          {
            label: 'Trạng thái',
            render: (p) => (
              <>
                <ManagerStatus value={p.status} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {p.environment === 'SANDBOX' ? 'Mô phỏng' : 'Biên nhận / nhà cung cấp'}
                </p>
              </>
            ),
          },
        ]}
      />
    </ManagerPage>
  )
}
export function ManagerPaymentDetail() {
  const { paymentId = '' } = useParams(),
    query = useManagerQuery(
      'payment',
      (b) => managerApi.get(b, 'payments', paymentId),
      [paymentId],
      true,
    ),
    [decision, setDecision] = useState(''),
    mutation = useManagerAction(() => setDecision(''))
  return (
    <ManagerPage
      title="Chi tiết đối soát"
      actions={<ManagerLink to="/manager/payments">Danh sách thanh toán</ManagerLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <Facts
                items={[
                  ['Tham chiếu', query.data.reference],
                  ['Người chuyển', query.data.payerName],
                  ['Người chịu nghĩa vụ', query.data.tenantName],
                  ['Đã nhận', formatVnd(query.data.amountReceived)],
                  ['Đã phân bổ', formatVnd(query.data.allocatedAmount)],
                  ['Trạng thái', <ManagerStatus value={query.data.status} />],
                  [
                    'Môi trường',
                    query.data.environment === 'SANDBOX'
                      ? 'Mô phỏng'
                      : 'Biên nhận ngân hàng / nhà cung cấp',
                  ],
                  ['Mã giao dịch nhà cung cấp', query.data.providerTransactionId],
                  ['Ngày nhận', dateTime(query.data.createdAt)],
                  [
                    'Xác minh lúc',
                    query.data.verifiedAt ? dateTime(query.data.verifiedAt) : 'Chưa xác minh',
                  ],
                ]}
              />
              <p className="mt-5 text-sm leading-6">{query.data.note}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                {query.data.invoiceId && (
                  <ManagerLink to={`/manager/invoices/${query.data.invoiceId}`}>
                    Hóa đơn được phân bổ
                  </ManagerLink>
                )}
                {query.data.bookingId && (
                  <ManagerLink to={`/manager/bookings/${query.data.bookingId}`}>
                    Giữ phòng
                  </ManagerLink>
                )}
                {['PENDING', 'REVIEW'].includes(query.data.status) && (
                  <>
                    {query.data.status === 'PENDING' && (
                      <Button variant="outline" onClick={() => setDecision('review')}>
                        Đưa vào đối soát
                      </Button>
                    )}
                    {query.data.method === 'TRANSFER' && query.data.environment !== 'SANDBOX' && (
                      <Button onClick={() => setDecision('verify')}>Đối chiếu & xác minh</Button>
                    )}
                  </>
                )}
              </div>
            </Panel>
            <Notice>
              {query.data.environment === 'SANDBOX'
                ? 'Giao dịch mô phỏng do bộ xử lý sandbox xác minh; không cộng vào dòng tiền thực nhận.'
                : 'Chỉ xác minh sau khi đối chiếu đủ tham chiếu, số tiền, bằng chứng và mã giao dịch duy nhất. Dữ liệu demo là giả lập.'}
            </Notice>
            {query.data.evidence.length > 0 && (
              <Panel>
                <h2 className="mb-4 font-bold">Bằng chứng nhận tiền</h2>
                <div className="grid grid-cols-3 gap-3">
                  {query.data.evidence.map((url, n) => (
                    <img
                      src={url}
                      key={n}
                      alt={`Biên nhận ${n + 1}`}
                      className="aspect-square w-full rounded-lg object-cover"
                    />
                  ))}
                </div>
              </Panel>
            )}
            <Panel>
              <h2 className="mb-5 font-bold">Lịch sử đối soát</h2>
              {query.data.history.length ? (
                query.data.history.map((h, n) => (
                  <p key={n} className="border-t border-border py-3 text-sm leading-6">
                    {dateTime(h.at)} · {h.actor}
                    <br />
                    {h.note}
                  </p>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Chưa có thao tác đối soát thủ công.</p>
              )}
            </Panel>
          </>
        )}
      </QueryState>
      <ActionDialog
        title={
          decision === 'verify'
            ? 'Xác minh biên nhận và phân bổ tiền?'
            : 'Chuyển giao dịch vào đối soát?'
        }
        open={!!decision}
        onOpenChange={(v) => {
          if (!v) setDecision('')
        }}
        fields={
          decision === 'verify'
            ? [
                { name: 'reference', label: 'Tham chiếu trên biên nhận' },
                { name: 'amount', label: 'Số tiền trên biên nhận (VND)', kind: 'number' },
                { name: 'providerTransactionId', label: 'Mã giao dịch nhà cung cấp' },
              ]
            : []
        }
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={(value) =>
          mutation.mutate({
            resource: 'payments',
            id: paymentId,
            value: { ...value, note: value.reason, decision },
          })
        }
      />
    </ManagerPage>
  )
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
export function ManagerZaloSettings() {
  const { branch } = useManager(),
    [success, setSuccess] = useState(false),
    mutation = useMutation({
      mutationFn: (value: unknown) => managerApi.zalo(branch.id, value),
      onSuccess: () => {
        setSuccess(true)
        void queryClient.invalidateQueries()
      },
    })
  return (
    <ManagerPage
      title="Nhóm Zalo chi nhánh"
      description="Thông tin nhóm chỉ hiển thị với người thuê được cấp quyền tại chi nhánh."
    >
      {success && <Notice tone="success">Đã lưu thông tin nhóm Zalo.</Notice>}
      <Panel>
        <ManagerForm
          schema={z.object({ url: z.string().trim().max(500), enabled: z.boolean() })}
          defaults={{ url: branch.zaloUrl || '', enabled: branch.zaloEnabled }}
          fields={[
            { name: 'url', label: 'Liên kết nhóm Zalo', hint: 'Dạng https://zalo.me/g/…' },
            { name: 'enabled', label: 'Hiển thị nhóm cho người thuê', kind: 'check' },
          ]}
          pending={mutation.isPending}
          error={mutation.error}
          onSubmit={(value) => mutation.mutate(value)}
        />
      </Panel>
    </ManagerPage>
  )
}
