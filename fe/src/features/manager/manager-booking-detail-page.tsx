import { Modal, Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { dateOnly, dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { managerApi } from '@/services/manager'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import {
  ActionDialog,
  ManagerForm,
  ManagerLink,
  ManagerPage,
  ManagerStatus,
  Records,
} from './components'
import {
  managerLink,
  useManager,
  useManagerAction,
  useManagerList,
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
