import { Field, InlineError, Modal, Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { chargeInputSchema, segmentInputSchema, type ManagerRecord } from '@/interfaces/manager'
import type { Attachment } from '@/interfaces/tenant'
import { formatVnd } from '@/lib/format'
import { managerApi } from '@/services/manager'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { ManagerForm, ManagerLink, ManagerPage } from './components'
import { managerLink, useManager, useManagerAction, useManagerList } from './context'
import { EvidenceInput } from './evidence-input'
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
export function UtilityEditorForm({ initial }: { initial?: ManagerRecord<'utility-charges'> }) {
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
