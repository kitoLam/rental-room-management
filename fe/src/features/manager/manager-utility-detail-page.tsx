import { Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { dateOnly } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { managerApi } from '@/services/manager'
import { useState } from 'react'
import { useParams } from 'react-router'
import { ActionDialog, ManagerLink, ManagerPage, ManagerStatus } from './components'
import { useManagerAction, useManagerQuery } from './context'

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
