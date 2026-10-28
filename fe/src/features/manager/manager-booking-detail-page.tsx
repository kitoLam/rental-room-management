import { Modal, Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { dateOnly, dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { managerApi } from '@/services/manager'
import { bookingService } from '@/services/guest-user'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import {
  ActionDialog,
  ManagerForm,
  ManagerLink,
  ManagerPage,
  ManagerStatus,
} from './components'
import {
  managerLink,
  useManager,
  useManagerAction,
  useManagerQuery,
} from './context'
import { History } from './leasing-shared'
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
    payments = useQuery({ queryKey: ['booking-payments', bookingId], queryFn: () => bookingService.payments(bookingId), enabled: !!bookingId }),
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
                {query.data.status === 'REQUESTED' && (
                  <>
                    <Button onClick={() => setDecision('review')}>Duyệt và gửi điều khoản</Button>
                    <Button variant="outline" onClick={() => setDecision('reject')}>
                      Từ chối
                    </Button>
                  </>
                )}
                {query.data.status === 'CONFIRMED' && (
                  <Button onClick={() => setDecision('convert')}>Tạo hợp đồng từ giữ phòng</Button>
                )}
                {query.data.status === 'EXPIRED' && query.data.depositStatus === 'PAID' && (
                  <Button onClick={() => mutation.mutate({ resource: 'bookings', id: bookingId, action: 'refund', value: {} })}>
                    Duyệt xử lý hoàn cọc
                  </Button>
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
            <Panel>
              <h2 className="mb-4 font-bold">Giao dịch cọc</h2>
              {payments.data?.length ? <ul className="divide-y divide-border">
                {payments.data.map((payment) => <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div><p className="break-all font-medium">{payment.reference}</p><p className="text-sm text-muted-foreground">{formatVnd(payment.amount)} · <ManagerStatus value={payment.status} /></p></div>
                  {payment.status === 'PENDING' && payment.instructions.startsWith('Chuyển khoản') && <div className="flex gap-2">
                    <Button onClick={() => mutation.mutate({ resource: 'bookings', id: bookingId, action: 'reconcile', value: { paymentId: payment.id, successful: true, reason: 'Owner xác nhận đã nhận chuyển khoản.' } })}>Xác nhận đã nhận</Button>
                    <Button variant="outline" onClick={() => mutation.mutate({ resource: 'bookings', id: bookingId, action: 'reconcile', value: { paymentId: payment.id, successful: false, reason: 'Owner đối soát không thấy giao dịch.' } })}>Không nhận được</Button>
                  </div>}
                </li>)}</ul> : <p className="text-sm text-muted-foreground">Chưa có giao dịch cọc.</p>}
              {payments.error && <p role="alert" className="mt-3 text-sm text-danger">Không tải được giao dịch.</p>}
            </Panel>
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
      ) : decision === 'review' ? (
        <Modal title="Duyệt yêu cầu và gửi điều khoản" open onOpenChange={(v) => !v && setDecision('')}>
          <ManagerForm
            schema={z.object({
              expectedMoveInDate: z.iso.date(),
              expectedMoveOutDate: z.iso.date(),
              holdingDepositAmount: z.number().int().positive(),
              paymentDeadline: z.iso.datetime(),
              holdExpiresAt: z.iso.datetime(),
              cancellationPolicy: z.string().trim().min(1).max(2000),
            }).refine((v) => v.expectedMoveOutDate > v.expectedMoveInDate && Date.parse(v.holdExpiresAt) > Date.parse(v.paymentDeadline), 'Kiểm tra khoảng thuê và hai mốc thời gian.')}
            defaults={{
              expectedMoveInDate: query.data?.startDate || '',
              expectedMoveOutDate: query.data?.endDate || '',
              holdingDepositAmount: 0,
              paymentDeadline: '',
              holdExpiresAt: '',
              cancellationPolicy: '',
            }}
            fields={[
              { name: 'expectedMoveInDate', label: 'Ngày bắt đầu thuê', kind: 'date' },
              { name: 'expectedMoveOutDate', label: 'Ngày kết thúc thuê', kind: 'date' },
              { name: 'holdingDepositAmount', label: 'Số tiền cọc giữ chỗ (VND)', kind: 'number', min: 1 },
              { name: 'paymentDeadline', label: 'Hạn thanh toán', kind: 'datetime-local' },
              { name: 'holdExpiresAt', label: 'Hạn giữ chỗ', kind: 'datetime-local' },
              { name: 'cancellationPolicy', label: 'Chính sách hủy', kind: 'textarea' },
            ]}
            pending={mutation.isPending}
            error={mutation.error}
            submitLabel="Gửi điều khoản cho khách"
            onSubmit={(value) => mutation.mutate({ resource: 'bookings', id: bookingId, action: 'review', value: { ...value, accepted: true } })}
          />
        </Modal>
      ) : decision === 'reject' ? (
        <ActionDialog
          title="Từ chối yêu cầu giữ phòng"
          open={!!decision}
          onOpenChange={(v) => {
            if (!v) setDecision('')
          }}
          pending={mutation.isPending}
          error={mutation.error}
          onConfirm={(data) =>
            mutation.mutate({ resource: 'bookings', id: bookingId, action: 'review', value: { accepted: false, rejectReason: data.reason } })
          }
        />
      ) : null}
    </ManagerPage>
  )
}
