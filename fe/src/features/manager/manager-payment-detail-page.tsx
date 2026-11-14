import { Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { managerApi } from '@/services/manager'
import { useState } from 'react'
import { useParams } from 'react-router'
import { ActionDialog, ManagerLink, ManagerPage, ManagerStatus } from './components'
import { useManagerAction, useManagerQuery } from './context'

export function ManagerPaymentDetail() {
  const { paymentId = '' } = useParams(),
    query = useManagerQuery(
      'payment',
      (b) => managerApi.get(b, 'payments', paymentId),
      [paymentId],
      true,
    ),
    [verifyOpen, setVerifyOpen] = useState(false),
    mutation = useManagerAction(() => setVerifyOpen(false))
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
                {query.data.bookingId && (
                  <ManagerLink to={`/manager/bookings/${query.data.bookingId}`}>
                    Giữ phòng
                  </ManagerLink>
                )}
                {['PENDING', 'REVIEW'].includes(query.data.status) &&
                  query.data.method === 'TRANSFER' && query.data.environment !== 'SANDBOX' && (
                    <Button onClick={() => setVerifyOpen(true)}>Đối chiếu & xác minh</Button>
                  )}
              </div>
            </Panel>

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
          </>
        )}
      </QueryState>
      <ActionDialog
        title="Xác minh biên nhận và phân bổ tiền?"
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        fields={[
          { name: 'reference', label: 'Tham chiếu trên biên nhận' },
          { name: 'amount', label: 'Số tiền trên biên nhận (VND)', kind: 'number' },
          { name: 'providerTransactionId', label: 'Mã giao dịch nhà cung cấp' },
        ]}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={(value) =>
          mutation.mutate({
            resource: 'payments',
            id: paymentId,
            value: { ...value, note: value.reason, decision: 'verify' },
          })
        }
      />
    </ManagerPage>
  )
}
