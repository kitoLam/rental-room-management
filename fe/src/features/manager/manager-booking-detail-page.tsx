import { InlineError, Modal, Notice, Panel, QueryState } from '@/components/common/page'
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
import { bookingReviewTimeErrors } from '@/lib/validation'
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
const toLocalInput = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
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
    payments = useQuery({ queryKey: ['booking-payments', bookingId], queryFn: () => bookingService.payments(bookingId), enabled: !!bookingId }),
    [decision, setDecision] = useState(''),
    [pendingContractDraft, setPendingContractDraft] = useState<Record<string, unknown> | null>(null),
    mutation = useManagerAction((result) => {
      if (decision === 'convert' && result?.id)
        navigate(managerLink(`/manager/contracts/${result.id}`, branch.id))
      setDecision('')
      setPendingContractDraft(null)
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
                  ['Hạn check-in / bàn giao', dateTime(query.data.checkInDeadline || '')],
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
                  <>
                    {!query.data.contractId && <Button onClick={() => setDecision('convert')}>Tạo hợp đồng từ giữ phòng</Button>}
                    <Button variant="outline" onClick={() => setDecision('cancel')}>Không thể bàn giao · Hủy booking</Button>
                  </>
                )}
                {(query.data.status === 'EXPIRED' || query.data.status === 'CANCELLED') && query.data.depositStatus === 'PAID' && (
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
              terms: z.string().trim().min(10),
              rentPrice: z.number().int().positive(),
              contractDepositAmount: z.number().int().nonnegative(),
              paymentDueDay: z.number().int().min(1).max(28),
              landlordName: z.string().trim().min(2),
              landlordIdNumber: z.string().trim().min(5),
              landlordAddress: z.string().trim().min(5),
              electricityInitialReading: z.number().nonnegative(),
              waterInitialReading: z.number().nonnegative(),
              electricityRate: z.number().nonnegative(),
              waterRate: z.number().nonnegative(),
              parkingRate: z.number().nonnegative(),
              maxOccupants: z.number().int().positive(),
              checkInDeadline: z.iso.datetime(),
              serviceDefinitions: z.array(z.string()),
            })}
            defaults={{ terms: '', rentPrice: 0, contractDepositAmount: 0, paymentDueDay: 5,
              landlordName: '', landlordIdNumber: '', landlordAddress: '', electricityInitialReading: 0,
              waterInitialReading: 0, electricityRate: 0, waterRate: 0, parkingRate: 0, maxOccupants: 1,
              checkInDeadline: toLocalInput(query.data?.checkInDeadline), serviceDefinitions: [] }}
            fields={[
              { name: 'landlordName', label: 'Bên cho thuê · họ tên' },
              { name: 'landlordIdNumber', label: 'Bên cho thuê · CCCD/CMND' },
              { name: 'landlordAddress', label: 'Bên cho thuê · địa chỉ' },
              { name: 'terms', label: 'Điều khoản đã thỏa thuận', kind: 'textarea' },
              { name: 'rentPrice', label: 'Giá thuê hàng tháng (VND)', kind: 'number', min: 0 },
              { name: 'contractDepositAmount', label: 'Tiền cọc hợp đồng (VND)', kind: 'number', min: 0 },
              { name: 'paymentDueDay', label: 'Ngày đến hạn thanh toán mỗi tháng', kind: 'number', min: 1 },
              { name: 'electricityInitialReading', label: 'Chỉ số điện đầu kỳ', kind: 'number', min: 0 },
              { name: 'waterInitialReading', label: 'Chỉ số nước đầu kỳ', kind: 'number', min: 0 },
              { name: 'electricityRate', label: 'Đơn giá điện (VND/kWh)', kind: 'number', min: 0 },
              { name: 'waterRate', label: 'Đơn giá nước (VND/m³)', kind: 'number', min: 0 },
              { name: 'parkingRate', label: 'Đơn giá gửi xe (VND/tháng)', kind: 'number', min: 0 },
              { name: 'maxOccupants', label: 'Số người tối đa theo hợp đồng', kind: 'number', min: 1 },
              { name: 'checkInDeadline', label: 'Hạn check-in / bàn giao', kind: 'datetime-local' },
              { name: 'serviceDefinitions', label: 'Dịch vụ: mỗi dòng Service ID|tên|đơn vị|đơn giá|cách tính|MANDATORY/OPTIONAL', kind: 'list', hint: 'Nhập Service ID Mongo 24 ký tự từ catalog. Các dịch vụ MANDATORY được Tenant chọn sẵn và không thể bỏ.' },
            ]}
            pending={mutation.isPending}
            error={mutation.error}
            submitLabel="Xác nhận tạo hợp đồng nháp"
            onSubmit={(value) => {
              const services = (value.serviceDefinitions as string[]).map((line) => {
                const [serviceId, name, unit, unitPrice, calculationType, requirement] = line.split('|').map((part) => part.trim())
                return { serviceId, name, unit, unitPrice: Number(unitPrice), calculationType, mandatory: requirement === 'MANDATORY' }
              })
              setPendingContractDraft({ ...value, checkInDeadline: new Date(String(value.checkInDeadline)).toISOString(), services })
            }}
          />
        </Modal>
      ) : decision === 'review' ? (
        <Modal title="Duyệt yêu cầu và gửi điều khoản" open onOpenChange={(v) => !v && setDecision('')}>
          <ManagerForm
            schema={z.object({
              expectedMoveInDate: z.iso.date(),
              expectedMoveOutDate: z.iso.date(),
              holdingDepositAmount: z.number().int().positive(),
              paymentDeadline: z.string().min(1),
              holdExpiresAt: z.string().min(1),
              checkInDeadline: z.string().min(1),
              cancellationPolicy: z.string().trim().min(1).max(2000),
            }).refine((v) => v.expectedMoveOutDate > v.expectedMoveInDate, {
              path: ['expectedMoveOutDate'],
              message: 'Ngày kết thúc thuê phải sau ngày bắt đầu thuê.',
            }).superRefine((value, context) => {
              for (const [field, message] of Object.entries(bookingReviewTimeErrors(value))) {
                context.addIssue({ code: 'custom', path: [field], message })
              }
            })}
            defaults={{
              expectedMoveInDate: query.data?.startDate || '',
              expectedMoveOutDate: query.data?.endDate || '',
              holdingDepositAmount: 0,
              paymentDeadline: '',
              holdExpiresAt: '',
              checkInDeadline: '',
              cancellationPolicy: '',
            }}
            fields={[
              { name: 'expectedMoveInDate', label: 'Ngày bắt đầu thuê', kind: 'date' },
              { name: 'expectedMoveOutDate', label: 'Ngày kết thúc thuê', kind: 'date' },
              { name: 'holdingDepositAmount', label: 'Số tiền cọc giữ chỗ (VND)', kind: 'number', min: 1 },
              { name: 'paymentDeadline', label: 'Hạn thanh toán', kind: 'datetime-local' },
              { name: 'holdExpiresAt', label: 'Thời điểm hết hạn giữ chỗ', kind: 'datetime-local' },
              { name: 'checkInDeadline', label: 'Hạn check-in / bàn giao', kind: 'datetime-local' },
              { name: 'cancellationPolicy', label: 'Chính sách hủy', kind: 'textarea' },
            ]}
            pending={mutation.isPending}
            error={mutation.error}
            submitLabel="Gửi điều khoản cho khách"
            onSubmit={(value) => mutation.mutate({ resource: 'bookings', id: bookingId, action: 'review', value: {
              ...value, accepted: true,
              paymentDeadline: new Date(String(value.paymentDeadline)).toISOString(),
              holdExpiresAt: new Date(String(value.holdExpiresAt)).toISOString(),
              checkInDeadline: new Date(String(value.checkInDeadline)).toISOString(),
            } })}
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
      ) : decision === 'cancel' ? (
        <ActionDialog
          title="Hủy booking do không thể bàn giao"
          open
          onOpenChange={(v) => !v && setDecision('')}
          pending={mutation.isPending}
          error={mutation.error}
          onConfirm={() => mutation.mutate({ resource: 'bookings', id: bookingId, action: 'cancel', value: {} })}
        />
      ) : null}
      {pendingContractDraft && (
        <Modal
          title="Xác nhận tạo hợp đồng nháp"
          description="Kiểm tra lại các điều khoản và khoản tiền trước khi lưu hồ sơ cho khách."
          open
          onOpenChange={(open) => !open && setPendingContractDraft(null)}
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="font-semibold">Giá thuê / tháng</dt><dd>{Number(pendingContractDraft.rentPrice || 0).toLocaleString('vi-VN')} ₫</dd></div>
            <div><dt className="font-semibold">Tiền cọc hợp đồng</dt><dd>{Number(pendingContractDraft.contractDepositAmount || 0).toLocaleString('vi-VN')} ₫</dd></div>
            <div><dt className="font-semibold">Hạn check-in</dt><dd>{dateTime(String(pendingContractDraft.checkInDeadline || ''))}</dd></div>
          </dl>
          <p className="mt-4 text-sm text-muted-foreground">Hồ sơ được lưu ở trạng thái nháp; booking chỉ chuyển thành quan hệ thuê sau bước bàn giao.</p>
          <InlineError error={mutation.error} />
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button variant="outline" disabled={mutation.isPending} onClick={() => setPendingContractDraft(null)}>
              Quay lại chỉnh sửa
            </Button>
            <Button
              loading={mutation.isPending}
              onClick={() => mutation.mutate({ resource: 'bookings', id: bookingId, action: 'convert', value: pendingContractDraft })}
            >
              Xác nhận tạo hợp đồng
            </Button>
          </div>
        </Modal>
      )}
    </ManagerPage>
  )
}
