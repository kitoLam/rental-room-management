import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { Panel, QueryState, Modal, Notice, InlineError, Field } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { imageAttachment } from '@/features/tenant/attachments'
import type { Attachment } from '@/interfaces/tenant'
import {
  chargeInputSchema,
  segmentInputSchema,
  recordInputSchema,
  type ManagerRecord,
} from '@/interfaces/manager'
import { formatVnd } from '@/lib/format'
import { dateOnly, dateTime } from '@/lib/activity'
import { managerApi } from '@/services/manager'
import {
  ManagerPage,
  ManagerLink,
  ManagerStatus,
  Records,
  SearchBox,
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

export function EvidenceInput({
  value,
  onChange,
  disabled = false,
}: {
  value: Attachment[]
  onChange: (v: Attachment[]) => void
  disabled?: boolean
}) {
  const [error, setError] = useState<Error | null>(null),
    [loading, setLoading] = useState(false)
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3">
      <Field
        id="manager-evidence"
        label="Ảnh minh chứng"
        hint="Tối đa 3 ảnh PNG, JPG hoặc WebP; mỗi ảnh 1 MB."
      >
        <input
          id="manager-evidence"
          className="input min-w-0 w-full max-w-full text-xs"
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          disabled={disabled || loading}
          onChange={async (e) => {
            const files = Array.from(e.target.files || [])
            e.target.value = ''
            if (files.length + value.length > 3) {
              setError(new Error('Tối đa 3 ảnh.'))
              return
            }
            setLoading(true)
            setError(null)
            try {
              onChange([...value, ...(await Promise.all(files.map(imageAttachment)))])
            } catch (e) {
              setError(e instanceof Error ? e : new Error('Không đọc được ảnh.'))
            } finally {
              setLoading(false)
            }
          }}
        />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        {value.map((a) => (
          <div key={a.id} className="min-w-0">
            <img
              src={a.url}
              alt={a.name}
              className="aspect-square w-full rounded-lg object-cover"
            />
            <Button
              type="button"
              variant="ghost"
              disabled={disabled}
              onClick={() => onChange(value.filter((v) => v.id !== a.id))}
            >
              Xóa ảnh
            </Button>
          </div>
        ))}
      </div>
      <InlineError error={error} />
    </div>
  )
}
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
export function ManagerUtilities() {
  const [q, setQ] = useState(''),
    [month, setMonth] = useState(''),
    [status, setStatus] = useState(''),
    [page, setPage] = useState(1),
    query = useManagerList('utility-charges', { q, month, status, page: String(page - 1) })
  return (
    <ManagerPage
      title="Điện nước & chi phí"
      description="Mỗi khoản phí có các đoạn chỉ số, giá và phân bổ riêng."
      actions={
        <ManagerLink to="/manager/utility-charges/new" button>
          Tạo khoản phí
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
        <input
          aria-label="Tháng tính phí"
          type="month"
          className="input w-auto"
          value={month}
          onChange={(e) => {
            setMonth(e.target.value)
            setPage(1)
          }}
        />
        <select
          aria-label="Trạng thái khoản phí"
          className="input w-auto"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả</option>
          <option value="DRAFT">Nháp</option>
          <option value="FINALIZED">Đã chốt</option>
        </select>
      </div>
      <Records
        query={query}
        page={page}
        onPage={setPage}
        columns={[
          {
            label: 'Khoản phí',
            render: (c) => (
              <>
                <ManagerLink to={`/manager/utility-charges/${c.id}`}>
                  {c.name} · {c.billingMonth.slice(0, 7)}
                </ManagerLink>
                <p className="text-xs text-muted-foreground">{c.roomName}</p>
              </>
            ),
          },
          {
            label: 'Giai đoạn',
            render: (c) => (
              <>
                {dateOnly(c.startDate)} – {dateOnly(c.endDate)}
                <p className="text-xs text-muted-foreground">{c.segments.length} đoạn</p>
              </>
            ),
          },
          { label: 'Tổng phí phòng', render: (c) => <strong>{formatVnd(c.totalAmount)}</strong> },
          { label: 'Trạng thái', render: (c) => <ManagerStatus value={c.status} /> },
        ]}
      />
    </ManagerPage>
  )
}
type Segment = z.infer<typeof segmentInputSchema>
function newSegment(): Segment {
  return {
    startDate: '',
    endDate: '',
    previousReading: 0,
    currentReading: 0,
    quantity: 1,
    unitPrice: 0,
    reason: 'NORMAL',
    meterId: null,
  }
}
export function ManagerUtilityEditor() {
  const { chargeId } = useParams(),
    query = useManagerQuery(
      'charge-editor',
      (b) => (chargeId ? managerApi.get(b, 'utility-charges', chargeId) : Promise.resolve(null)),
      [chargeId],
    )
  return (
    <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
      {query.data && query.data.status !== 'DRAFT' ? (
        <Notice>Khoản phí đã chốt, chỉ xem lịch sử.</Notice>
      ) : (
        <UtilityEditorForm key={chargeId || 'new'} initial={query.data || undefined} />
      )}
    </QueryState>
  )
}
function UtilityEditorForm({ initial }: { initial?: ManagerRecord<'utility-charges'> }) {
  const { chargeId } = useParams(),
    { branch } = useManager(),
    navigate = useNavigate(),
    rooms = useManagerList('rooms', { size: '100' }),
    services = useManagerList('services', { size: '100' }),
    meters = useManagerList('meters', { size: '100' }),
    [segments, setSegments] = useState<Segment[]>(
      initial?.segments.map((s) => ({
        ...s,
        reason: s.reasonType || 'NORMAL',
        meterId: s.meterId || null,
      })) || [newSegment()],
    ),
    [evidence, setEvidence] = useState<Attachment[]>(
      () =>
        initial?.evidence
          .filter((url) => url.startsWith('data:'))
          .map((url, n) => ({
            id: crypto.randomUUID(),
            name: `Minh chứng ${n + 1}`,
            mime: url.slice(5, url.indexOf(';')) as Attachment['mime'],
            size: atob(url.split(',')[1]).length,
            url,
          })) || [],
    ),
    [error, setError] = useState<Error | null>(null),
    [preview, setPreview] = useState<z.infer<typeof chargeInputSchema> | null>(null),
    mutation = useManagerAction((result) =>
      navigate(managerLink(`/manager/utility-charges/${result?.id || chargeId}`, branch.id)),
    )
  const calculation = useMutation({
    mutationFn: (value: unknown) => managerApi.previewCharge(branch.id, value),
    onSuccess: () => undefined,
  })
  const update = (n: number, key: keyof Segment, value: unknown) =>
    setSegments((rows) => rows.map((s, i) => (i === n ? { ...s, [key]: value } : s)))
  return (
    <ManagerPage
      title={chargeId ? 'Chỉnh sửa khoản phí nháp' : 'Tạo khoản phí theo đoạn'}
      actions={<ManagerLink to="/manager/utility-charges">Danh sách khoản phí</ManagerLink>}
    >
      <QueryState
        pending={rooms.isPending || services.isPending || meters.isPending}
        error={rooms.error || services.error || meters.error}
        retry={() => {
          void rooms.refetch()
          void services.refetch()
          void meters.refetch()
        }}
      >
        <Panel>
          <ManagerForm
            schema={chargeInputSchema.pick({ roomId: true, serviceId: true, billingMonth: true })}
            defaults={
              initial
                ? {
                    roomId: initial.roomId,
                    serviceId: initial.serviceId,
                    billingMonth: initial.billingMonth,
                  }
                : {
                    roomId: '',
                    serviceId: '',
                    billingMonth: new Date().toISOString().slice(0, 7) + '-01',
                  }
            }
            fields={[
              {
                name: 'roomId',
                label: 'Phòng',
                kind: 'select',
                options: rooms.data?.content.map((r) => ({
                  value: r.id,
                  label: `${r.code} · ${r.title}`,
                })),
              },
              {
                name: 'serviceId',
                label: 'Dịch vụ',
                kind: 'select',
                options: services.data?.content
                  .filter((s) => s.active)
                  .map((s) => ({
                    value: s.id,
                    label: `${s.name} · ${s.billingMethod === 'METERED' ? 'Theo chỉ số' : 'Theo số lượng'}`,
                  })),
              },
              { name: 'billingMonth', label: 'Kỳ tính phí (ngày đầu tháng)', kind: 'date' },
            ]}
            pending={mutation.isPending || calculation.isPending}
            error={error || mutation.error || calculation.error}
            submitLabel="Kiểm tra & xem trước"
            onSubmit={(base) => {
              const parsed = chargeInputSchema.safeParse({ ...base, segments, evidence })
              if (!parsed.success) {
                setError(
                  new Error('Kiểm tra ngày, chỉ số, số lượng, đơn giá và mã công tơ của các đoạn.'),
                )
                return
              }
              setError(null)
              calculation.mutate(parsed.data, { onSuccess: () => setPreview(parsed.data) })
            }}
          >
            <Notice>
              Khoảng ngày không gồm ngày kết thúc. Tách đoạn khi đổi giá, đặt lại hoặc thay công tơ.
            </Notice>
            {segments.map((s, n) => (
              <fieldset
                key={n}
                className="grid min-w-0 grid-cols-1 gap-4 rounded-lg border border-border p-4"
              >
                <legend className="px-2 text-sm font-bold">Đoạn {n + 1}</legend>
                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  {(['startDate', 'endDate'] as const).map((key, i) => (
                    <Field key={key} id={`segment-${n}-${key}`} label={i ? 'Đến ngày' : 'Từ ngày'}>
                      <input
                        id={`segment-${n}-${key}`}
                        className="input min-w-0"
                        type="date"
                        value={s[key]}
                        onChange={(e) => update(n, key, e.target.value)}
                      />
                    </Field>
                  ))}
                  {(['previousReading', 'currentReading', 'quantity', 'unitPrice'] as const).map(
                    (key, i) => (
                      <Field
                        key={key}
                        id={`segment-${n}-${key}`}
                        label={
                          [
                            'Chỉ số đầu (bỏ trống nếu không đo)',
                            'Chỉ số cuối (bỏ trống nếu không đo)',
                            'Số lượng (không đo)',
                            'Đơn giá (VND)',
                          ][i]
                        }
                      >
                        <input
                          id={`segment-${n}-${key}`}
                          className="input"
                          type="number"
                          min="0"
                          step={key === 'unitPrice' ? 1 : 0.001}
                          value={s[key] ?? ''}
                          onChange={(e) =>
                            update(n, key, e.target.value === '' ? null : Number(e.target.value))
                          }
                        />
                      </Field>
                    ),
                  )}
                </div>
                <Field id={`meter-${n}`} label="Công tơ (bỏ trống nếu không đo)">
                  <select
                    id={`meter-${n}`}
                    className="input"
                    value={s.meterId || ''}
                    onChange={(e) => update(n, 'meterId', e.target.value || null)}
                  >
                    <option value="">Không dùng công tơ</option>
                    {meters.data?.content.map((m) => (
                      <option value={m.id} key={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id={`reason-${n}`} label="Loại đoạn">
                  <select
                    id={`reason-${n}`}
                    className="input"
                    value={s.reason}
                    onChange={(e) => update(n, 'reason', e.target.value)}
                  >
                    <option value="NORMAL">Thông thường</option>
                    <option value="PRICE_CHANGE">Đổi giá</option>
                    <option value="METER_RESET">Đặt lại công tơ</option>
                    <option value="METER_REPLACEMENT">Thay công tơ</option>
                  </select>
                </Field>
                {segments.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSegments(segments.filter((_, i) => i !== n))}
                  >
                    Xóa đoạn {n + 1}
                  </Button>
                )}
              </fieldset>
            ))}
            <div>
              <Button
                type="button"
                variant="outline"
                disabled={segments.length >= 12}
                onClick={() =>
                  setSegments([
                    ...segments,
                    { ...newSegment(), startDate: segments.at(-1)?.endDate || '' },
                  ])
                }
              >
                Thêm đoạn tính phí
              </Button>
            </div>
            <EvidenceInput value={evidence} onChange={setEvidence} />
          </ManagerForm>
        </Panel>
      </QueryState>
      <Modal
        title="Xác nhận lưu khoản phí nháp"
        open={!!preview}
        onOpenChange={(v) => {
          if (!v && !mutation.isPending) setPreview(null)
        }}
      >
        {preview && (
          <div className="grid gap-5">
            <p className="text-sm">
              {preview.segments.length} đoạn tính phí trong kỳ {preview.billingMonth.slice(0, 7)}.
              Hệ thống kiểm tra liên tục chỉ số và khoảng ngày khi lưu.
            </p>
            <p className="text-2xl font-bold tabular-nums">
              {formatVnd(calculation.data?.totalAmount || 0)}
            </p>
            {calculation.data?.segments.map((s, n) => (
              <p key={s.id} className="text-sm">
                Đoạn {n + 1}: {s.quantity} {s.unit} × {formatVnd(s.unitPrice)} ={' '}
                {formatVnd(s.amount)}
              </p>
            ))}
            <Notice>
              Lưu nháp chưa tạo nghĩa vụ hóa đơn. Mở chi tiết để kiểm tra tổng, sau đó chốt phân bổ.
            </Notice>
            <InlineError error={mutation.error} />
            <Button
              loading={mutation.isPending}
              onClick={() =>
                mutation.mutate({ resource: 'utility-charges', id: chargeId, value: preview })
              }
            >
              Lưu khoản phí nháp
            </Button>
          </div>
        )}
      </Modal>
    </ManagerPage>
  )
}
export function ManagerUtilityDetail() {
  const { chargeId = '' } = useParams(),
    query = useManagerQuery('charge', (b) => managerApi.get(b, 'utility-charges', chargeId), [
      chargeId,
    ]),
    [open, setOpen] = useState(false),
    mutation = useManagerAction(() => setOpen(false))
  return (
    <ManagerPage
      title="Chi tiết khoản phí"
      actions={<ManagerLink to="/manager/utility-charges">Danh sách khoản phí</ManagerLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <Facts
                items={[
                  ['Dịch vụ', query.data.name],
                  ['Phòng', query.data.roomName],
                  ['Kỳ phí', query.data.billingMonth.slice(0, 7)],
                  ['Tổng phí phòng', formatVnd(query.data.totalAmount)],
                  ['Trạng thái', <ManagerStatus value={query.data.status} />],
                ]}
              />
              <p className="mt-5 text-sm leading-6 text-muted-foreground">{query.data.snapshot}</p>
              {query.data.status === 'DRAFT' && (
                <div className="mt-5 flex flex-wrap gap-4">
                  <ManagerLink to={`/manager/utility-charges/${chargeId}/edit`}>
                    Sửa các đoạn nháp
                  </ManagerLink>
                  <Button className="mt-5" onClick={() => setOpen(true)}>
                    Chốt phí & phân bổ
                  </Button>
                </div>
              )}
            </Panel>
            <Panel>
              <h2 className="mb-5 font-bold">Các đoạn tính phí</h2>
              <div className="grid gap-5">
                {query.data.segments.map((s) => (
                  <div key={s.id} className="border-t border-border pt-4 first:border-0 first:pt-0">
                    <p className="text-sm font-bold">
                      {dateOnly(s.startDate)} – {dateOnly(s.endDate)}
                    </p>
                    <p className="mt-2 text-sm">
                      {s.previousReading !== null
                        ? `${s.previousReading} → ${s.currentReading} · `
                        : ''}
                      {s.quantity} {s.unit} × {formatVnd(s.unitPrice)} ={' '}
                      <strong>{formatVnd(s.amount)}</strong>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{s.reason}</p>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel>
              <h2 className="mb-5 font-bold">Phân bổ theo cư trú</h2>
              {query.data.participants.length ? (
                query.data.participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap justify-between gap-3 border-t border-border py-3"
                  >
                    <ManagerLink to={`/manager/tenancies/${p.id}`}>{p.label}</ManagerLink>
                    <span className="text-sm">
                      {p.days} ngày · {formatVnd(p.amount)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sẽ tính theo từng đoạn khi chốt phí.
                </p>
              )}
            </Panel>
            {query.data.evidence.length > 0 && (
              <Panel>
                <div className="grid grid-cols-3 gap-3">
                  {query.data.evidence.map((url, n) => (
                    <a key={n} href={url} target="_blank" rel="noreferrer">
                      <img
                        src={url}
                        alt={`Minh chứng ${n + 1}`}
                        className="aspect-square w-full rounded-lg object-cover"
                      />
                    </a>
                  ))}
                </div>
              </Panel>
            )}
          </>
        )}
      </QueryState>
      <ActionDialog
        title="Chốt khoản phí và tạo phân bổ?"
        open={open}
        onOpenChange={setOpen}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={(value) =>
          mutation.mutate({ resource: 'utility-charges', id: chargeId, action: 'finalize', value })
        }
      />
    </ManagerPage>
  )
}
export function ManagerAllocations() {
  const [status, setStatus] = useState(''),
    [page, setPage] = useState(1),
    query = useManagerList('cost-allocations', { status, page: String(page - 1) }, true),
    [selected, setSelected] = useState<ManagerRecord<'cost-allocations'> | null>(null),
    [decision, setDecision] = useState(''),
    mutation = useManagerAction(() => {
      setDecision('')
      setSelected(null)
    })
  return (
    <ManagerPage title="Xét phân bổ chi phí">
      <select
        aria-label="Trạng thái phân bổ"
        className="input max-w-xs"
        value={status}
        onChange={(e) => {
          setStatus(e.target.value)
          setPage(1)
        }}
      >
        <option value="">Tất cả trạng thái</option>
        <option value="PENDING">Chờ duyệt</option>
        <option value="APPROVED">Đã duyệt</option>
        <option value="REJECTED">Từ chối</option>
        <option value="SUPERSEDED">Đã thay thế</option>
      </select>
      <Records
        query={query}
        page={page}
        onPage={setPage}
        columns={[
          {
            label: 'Đề xuất',
            render: (p) => (
              <>
                <strong>{p.chargeName}</strong>
                <p className="text-xs text-muted-foreground">
                  {p.tenantName} · {dateTime(p.createdAt)}
                </p>
              </>
            ),
          },
          { label: 'Tổng nguồn', render: (p) => formatVnd(p.sourceAmount) },
          { label: 'Trạng thái', render: (p) => <ManagerStatus value={p.status} /> },
          {
            label: 'Chi tiết',
            render: (p) => (
              <Button variant="outline" onClick={() => setSelected(p)}>
                So sánh phân bổ
              </Button>
            ),
          },
        ]}
      />
      <Modal
        title="So sánh phân bổ"
        open={!!selected && !decision}
        onOpenChange={(v) => {
          if (!v) setSelected(null)
        }}
      >
        {selected && (
          <div className="grid gap-5">
            <p className="text-sm leading-6">{selected.reason}</p>
            <div className="flex flex-wrap gap-5">
              <ManagerLink to={`/manager/utility-charges/${selected.chargeId}`}>
                Khoản phí nguồn
              </ManagerLink>
              {selected.invoiceId && (
                <ManagerLink to={`/manager/invoices/${selected.invoiceId}`}>
                  Hóa đơn liên quan
                </ManagerLink>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="py-3">Cư trú</th>
                    <th>Mặc định</th>
                    <th>Đề xuất</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.defaultShares.map((s) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="py-3">{s.label}</td>
                      <td>{formatVnd(s.amount)}</td>
                      <td>{formatVnd(selected.shares.find((v) => v.id === s.id)?.amount || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm font-bold">
              Tổng đề xuất: {formatVnd(selected.shares.reduce((s, v) => s + v.amount, 0))}
            </p>
            <Notice>
              Hóa đơn đã phát hành giữ nguyên. Phân bổ chỉ cập nhật nguồn chưa chốt vào hóa đơn.
            </Notice>
            {selected.decision && <p className="text-sm">{selected.decision}</p>}
            {selected.status === 'PENDING' && (
              <div className="flex gap-3">
                <Button onClick={() => setDecision('approve')}>Duyệt phân bổ</Button>
                <Button variant="outline" onClick={() => setDecision('reject')}>
                  Từ chối
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
      <ActionDialog
        title="Xác nhận kết quả phân bổ"
        open={!!decision}
        onOpenChange={(v) => {
          if (!v) setDecision('')
        }}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={(value) =>
          mutation.mutate({
            resource: 'cost-allocations',
            id: selected!.id,
            value: { ...value, decision },
          })
        }
      />
    </ManagerPage>
  )
}
export function ManagerMaintenance() {
  const [q, setQ] = useState(''),
    [status, setStatus] = useState(''),
    [page, setPage] = useState(1),
    query = useManagerList('maintenance', { q, status, page: String(page - 1) }, true)
  return (
    <ManagerPage title="Sửa chữa & bảo trì">
      <div className="flex flex-wrap gap-3">
        <SearchBox
          value={q}
          onChange={(v) => {
            setQ(v)
            setPage(1)
          }}
        />
        <select
          aria-label="Trạng thái sửa chữa"
          className="input w-auto"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="OPEN">Mới gửi</option>
          <option value="ACCEPTED">Đã tiếp nhận</option>
          <option value="IN_PROGRESS">Đang xử lý</option>
          <option value="COMPLETED">Hoàn tất</option>
          <option value="REJECTED">Từ chối</option>
        </select>
      </div>
      <Records
        query={query}
        page={page}
        onPage={setPage}
        columns={[
          {
            label: 'Yêu cầu',
            render: (r) => (
              <>
                <ManagerLink to={`/manager/maintenance/${r.id}`}>{r.title}</ManagerLink>
                <p className="text-xs text-muted-foreground">
                  {r.assetName} · {r.roomName}
                </p>
              </>
            ),
          },
          {
            label: 'Người gửi',
            render: (r) => (
              <>
                <p>{r.tenantName}</p>
                <p className="text-xs text-muted-foreground">{dateTime(r.createdAt)}</p>
              </>
            ),
          },
          { label: 'Mức độ', render: (r) => <ManagerStatus value={r.priority} /> },
          {
            label: 'Xử lý',
            render: (r) => (
              <>
                <ManagerStatus value={r.status} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {r.assignedTo || 'Chưa phân công'}
                </p>
              </>
            ),
          },
        ]}
      />
    </ManagerPage>
  )
}
export function ManagerMaintenanceDetail() {
  const { reportId = '' } = useParams(),
    query = useManagerQuery(
      'maintenance-detail',
      (b) => managerApi.get(b, 'maintenance', reportId),
      [reportId],
      true,
    ),
    [action, setAction] = useState(''),
    [recordId, setRecordId] = useState(''),
    [evidence, setEvidence] = useState<Attachment[]>([]),
    mutation = useManagerAction(() => {
      setAction('')
      setEvidence([])
    })
  return (
    <ManagerPage
      title="Xử lý sửa chữa"
      actions={<ManagerLink to="/manager/maintenance">Danh sách sửa chữa</ManagerLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <h2 className="mb-5 text-xl font-bold">{query.data.title}</h2>
              <Facts
                items={[
                  ['Tài sản / dịch vụ', query.data.assetName],
                  ['Phòng', query.data.roomName],
                  ['Người gửi', query.data.tenantName],
                  ['Trạng thái', <ManagerStatus value={query.data.status} />],
                  ['Mức độ', <ManagerStatus value={query.data.priority} />],
                  ['Phụ trách', query.data.assignedTo],
                ]}
              />
              <p className="mt-6 whitespace-pre-wrap text-sm leading-7">{query.data.description}</p>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {query.data.attachments.map((a) => (
                  <img
                    src={a.url}
                    alt={a.name}
                    key={a.id}
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                {(query.data.status === 'OPEN'
                  ? [
                      ['accept', 'Tiếp nhận'],
                      ['reject', 'Từ chối'],
                    ]
                  : query.data.status === 'ACCEPTED'
                    ? [
                        ['assign', 'Phân công'],
                        ['start', 'Bắt đầu xử lý'],
                        ['record', 'Thêm nhật ký'],
                      ]
                    : query.data.status === 'IN_PROGRESS'
                      ? [
                          ['assign', 'Phân công lại'],
                          ['record', 'Thêm nhật ký'],
                          ['complete', 'Hoàn tất sửa chữa'],
                        ]
                      : []
                ).map(([a, label]) => (
                  <Button variant="outline" key={a} onClick={() => setAction(a)}>
                    {label}
                  </Button>
                ))}
              </div>
            </Panel>
            <Panel>
              <h2 className="mb-5 font-bold">Nhật ký & trách nhiệm chi phí</h2>
              <ol className="grid gap-6">
                {query.data.records.map((r) => (
                  <li key={r.id} className="border-l-2 border-border pl-4">
                    <p className="text-xs text-muted-foreground">
                      {dateTime(r.at)} · {r.performedBy}
                    </p>
                    <p className="mt-2 text-sm leading-6">{r.description}</p>
                    {r.cost > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-bold">
                          {formatVnd(r.cost)} ·{' '}
                          {r.responsibleParty === 'TENANT' ? 'Người thuê' : 'Chủ nhà'} chịu
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <ManagerStatus value={r.approvalStatus || 'PENDING'} />
                          {r.approvalStatus === 'PENDING' && (
                            <>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setRecordId(r.id)
                                  setAction('cost-approve')
                                }}
                              >
                                Duyệt trách nhiệm chi phí
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setRecordId(r.id)
                                  setAction('cost-reject')
                                }}
                              >
                                Từ chối chi phí
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      {r.evidence.map((url, n) => (
                        <img
                          src={url}
                          alt={`Minh chứng nhật ký ${n + 1}`}
                          key={n}
                          className="aspect-square w-full rounded-lg object-cover"
                        />
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
            <Notice>
              Chỉ chi phí người thuê đã được duyệt của yêu cầu hoàn tất mới được chọn làm nguồn hóa
              đơn.
            </Notice>
          </>
        )}
      </QueryState>
      {action === 'record' ? (
        <Modal
          title="Thêm nhật ký xử lý"
          open
          onOpenChange={(v) => {
            if (!v && !mutation.isPending) setAction('')
          }}
        >
          <ManagerForm
            schema={recordInputSchema.omit({ evidence: true })}
            defaults={{ description: '', cost: 0, responsibleParty: '' }}
            fields={[
              { name: 'description', label: 'Công việc đã thực hiện', kind: 'textarea' },
              { name: 'cost', label: 'Chi phí (VND)', kind: 'number' },
              {
                name: 'responsibleParty',
                label: 'Bên chịu chi phí',
                kind: 'select',
                nullable: true,
                options: [
                  { value: 'OWNER', label: 'Chủ nhà' },
                  { value: 'TENANT', label: 'Người thuê' },
                ],
              },
            ]}
            pending={mutation.isPending}
            error={mutation.error}
            onSubmit={(value) =>
              mutation.mutate({
                resource: 'maintenance',
                id: reportId,
                action,
                value: { ...value, evidence, reason: value.description },
              })
            }
          >
            <EvidenceInput value={evidence} onChange={setEvidence} disabled={mutation.isPending} />
          </ManagerForm>
        </Modal>
      ) : (
        <ActionDialog
          title="Xác nhận xử lý sửa chữa"
          open={!!action}
          onOpenChange={(v) => {
            if (!v) setAction('')
          }}
          fields={
            ['accept', 'assign'].includes(action)
              ? [{ name: 'handler', label: 'Người được phân công' }]
              : []
          }
          pending={mutation.isPending}
          error={mutation.error}
          onConfirm={(value) =>
            mutation.mutate({
              resource: 'maintenance',
              id: reportId,
              action,
              value: { ...value, ...(recordId ? { recordId } : {}) },
            })
          }
        />
      )}
    </ManagerPage>
  )
}
