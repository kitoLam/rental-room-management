import { InlineError, Modal, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { ManagerForm, type FieldSpec } from '@/features/manager/components'
import { Facts } from '@/features/tenant/components'
import { useNow } from '@/hooks/use-now'
import { policyInputSchema } from '@/interfaces/owner'
import { dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { ownerApi } from '@/services/owner'
import { useState } from 'react'
import { useParams } from 'react-router'
import { z } from 'zod'
import { OwnerPage } from './components'
import { useOwnerMutation, useOwnerQuery } from './context'

export function OwnerPolicies() {
  const clock = useNow()
  const { branchId = '' } = useParams(),
    query = useOwnerQuery('policies', () => ownerApi.policies(branchId), [branchId]),
    [open, setOpen] = useState(false),
    [preview, setPreview] = useState<Record<string, unknown> | null>(null),
    mutation = useOwnerMutation(() => setOpen(false))
  const schema = z
    .object(policyInputSchema.shape)
    .omit({ appointmentPolicy: true })
    .extend({
      openingHour: z.number().int().min(0).max(23),
      closingHour: z.number().int().min(1).max(24),
      maxDurationMinutes: z.number().int().min(15).max(480),
      cancellationHours: z.number().int().min(0).max(168),
    })
  const last = query.data?.[0],
    defaults = {
      effectiveFrom: new Date(clock + 60000).toISOString(),
      collectionDay: last?.collectionDay ?? 5,
      paymentGraceDays: last?.paymentGraceDays ?? 3,
      bookingHoldAmount: last?.bookingHoldAmount ?? 500000,
      paymentWindowMinutes: last?.paymentWindowMinutes ?? 15,
      temporaryHoldMinutes: last?.temporaryHoldMinutes ?? 30,
      confirmedHoldMinutes: last?.confirmedHoldMinutes ?? 1440,
      cancellationTerms: last?.cancellationTerms || '',
      openingHour: last?.appointmentPolicy.openingHour ?? 8,
      closingHour: last?.appointmentPolicy.closingHour ?? 20,
      maxDurationMinutes: last?.appointmentPolicy.maxDurationMinutes ?? 60,
      cancellationHours: last?.appointmentPolicy.cancellationHours ?? 2,
    }
  const fields: FieldSpec[] = [
    {
      name: 'effectiveFrom',
      label: 'Hiệu lực từ (ISO, gồm múi giờ)',
      hint: 'Ví dụ 2026-10-20T08:00:00+07:00',
    },
    ...[
      ['collectionDay', 'Ngày thu tiền (1–28)'],
      ['paymentGraceDays', 'Số ngày gia hạn'],
      ['bookingHoldAmount', 'Tiền giữ phòng (VND)'],
      ['paymentWindowMinutes', 'Hạn thanh toán (phút)'],
      ['temporaryHoldMinutes', 'Giữ tạm (phút)'],
      ['confirmedHoldMinutes', 'Giữ đã xác nhận (phút)'],
      ['openingHour', 'Giờ mở cửa'],
      ['closingHour', 'Giờ đóng cửa'],
      ['maxDurationMinutes', 'Thời lượng xem tối đa (phút)'],
      ['cancellationHours', 'Hủy lịch trước (giờ)'],
    ].map(([name, label]) => ({ name, label, kind: 'number' as const, step: 1 })),
    { name: 'cancellationTerms', label: 'Điều khoản hủy', kind: 'textarea' },
  ]
  return (
    <OwnerPage
      title="Chính sách chi nhánh"
      description="Mỗi thay đổi tạo một phiên bản mới. Booking và hóa đơn giữ snapshot đã chốt."
      actions={
        <Button
          onClick={() => {
            setOpen(true)
            setPreview(null)
          }}
        >
          Tạo phiên bản
        </Button>
      }
    >
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
        empty={query.data?.length === 0}
        emptyMessage="Chi nhánh chưa có chính sách."
        emptyAction={<Button onClick={() => setOpen(true)}>Tạo chính sách đầu tiên</Button>}
      >
        <div className="grid gap-5">
          {query.data?.map((p) => (
            <Panel key={p.id}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-bold">Phiên bản {p.version}</h2>
                <span className="text-xs text-muted-foreground">
                  {Date.parse(p.effectiveFrom) > clock ? 'Sắp hiệu lực' : 'Đã hiệu lực'} ·{' '}
                  {dateTime(p.effectiveFrom)}
                </span>
              </div>
              <Facts
                items={[
                  ['Thu tiền / gia hạn', `Ngày ${p.collectionDay} · ${p.paymentGraceDays} ngày`],
                  ['Tiền giữ phòng', formatVnd(p.bookingHoldAmount)],
                  [
                    'Thanh toán / giữ tạm',
                    `${p.paymentWindowMinutes} / ${p.temporaryHoldMinutes} phút`,
                  ],
                  ['Giữ xác nhận', `${p.confirmedHoldMinutes} phút`],
                  [
                    'Lịch xem',
                    `${p.appointmentPolicy.openingHour}h–${p.appointmentPolicy.closingHour}h · tối đa ${p.appointmentPolicy.maxDurationMinutes} phút`,
                  ],
                  ['Hủy lịch trước', `${p.appointmentPolicy.cancellationHours} giờ`],
                  ['Điều khoản hủy', p.cancellationTerms],
                ]}
              />
            </Panel>
          ))}
        </div>
      </QueryState>
      <Modal
        open={open}
        onOpenChange={(v) => {
          if (!mutation.isPending) setOpen(v)
        }}
        title="Phiên bản chính sách mới"
      >
        {!preview ? (
          <ManagerForm
            schema={schema}
            defaults={defaults}
            fields={fields}
            onSubmit={(v) => setPreview(v)}
            pending={false}
            error={null}
            submitLabel="Xem trước"
          />
        ) : (
          <div className="grid gap-4">
            <Facts
              items={[
                ['Hiệu lực', String(preview.effectiveFrom)],
                ['Tiền giữ', formatVnd(Number(preview.bookingHoldAmount))],
                ['Ngày thu', String(preview.collectionDay)],
                ['Hạn giữ tạm', `${preview.temporaryHoldMinutes} phút`],
                ['Điều khoản hủy', String(preview.cancellationTerms)],
              ]}
            />
            <InlineError error={mutation.error} />
            <Button
              disabled={mutation.isPending}
              onClick={() => {
                const { openingHour, closingHour, maxDurationMinutes, cancellationHours, ...rest } =
                  preview
                mutation.mutate({
                  path: `/branches/${branchId}/policies`,
                  value: {
                    ...rest,
                    appointmentPolicy: {
                      openingHour,
                      closingHour,
                      maxDurationMinutes,
                      cancellationHours,
                    },
                  },
                })
              }}
            >
              Lưu phiên bản
            </Button>
            <Button
              disabled={mutation.isPending}
              variant="outline"
              onClick={() => setPreview(null)}
            >
              Chỉnh sửa
            </Button>
          </div>
        )}
      </Modal>
    </OwnerPage>
  )
}
