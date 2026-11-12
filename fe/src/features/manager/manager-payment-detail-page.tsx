import { Notice, Panel, QueryState } from '@/components/common/page'
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
