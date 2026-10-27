import { Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { dateOnly } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { managerApi } from '@/services/manager'
import { useState } from 'react'
import { useParams } from 'react-router'
import { AdjustmentRequest } from './adjustment-request'
import { ActionDialog, ManagerLink, ManagerPage, ManagerStatus, Records } from './components'
import { useManagerAction, useManagerList, useManagerQuery } from './context'

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
              {query.data.documentStatus === 'ISSUED' && (
                <div className="mt-6">
                  <AdjustmentRequest invoiceId={invoiceId} total={query.data.totalAmount} />
                </div>
              )}
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
