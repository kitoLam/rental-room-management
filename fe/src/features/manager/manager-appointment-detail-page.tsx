import { Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { dateTime } from '@/lib/activity'
import { managerApi } from '@/services/manager'
import { useState } from 'react'
import { useParams } from 'react-router'
import { ActionDialog, ManagerLink, ManagerPage, ManagerStatus } from './components'
import { useManagerAction, useManagerQuery } from './context'
import { History } from './leasing-shared'
export function ManagerAppointmentDetail() {
  const { appointmentId = '' } = useParams(),
    query = useManagerQuery(
      'appointment',
      (b) => managerApi.get(b, 'appointments', appointmentId),
      [appointmentId],
      true,
    ),
    [decision, setDecision] = useState(''),
    mutation = useManagerAction(() => setDecision(''))
  return (
    <ManagerPage
      title="Chi tiết lịch xem"
      actions={<ManagerLink to="/manager/appointments">Danh sách lịch xem</ManagerLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <Facts
                items={[
                  ['Phòng', query.data.roomTitle],
                  [
                    'Người xem',
                    `${query.data.requesterName} · ${query.data.requesterEmail} · ${query.data.requesterPhone || ''}`,
                  ],
                  ['Bắt đầu', dateTime(query.data.startAt)],
                  ['Kết thúc', dateTime(query.data.endAt)],
                  ['Trạng thái', <ManagerStatus value={query.data.status} />],
                  ['Phụ trách', query.data.assignedManager],
                  ['Ghi chú người xem', query.data.note],
                ]}
              />
              <div className="mt-6 flex flex-wrap gap-3">
                {(query.data.status === 'PENDING'
                  ? [
                      ['CONFIRMED', 'Xác nhận lịch'],
                      ['REJECTED', 'Từ chối'],
                      ['CANCELLED', 'Hủy lịch'],
                    ]
                  : query.data.status === 'CONFIRMED'
                    ? [
                        ['COMPLETED', 'Hoàn tất lịch xem'],
                        ['CANCELLED', 'Hủy lịch'],
                      ]
                    : []
                ).map(([status, label]) => (
                  <Button
                    key={status}
                    variant={status === 'CONFIRMED' ? 'default' : 'outline'}
                    onClick={() => setDecision(status)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </Panel>
            <Panel>
              <h2 className="mb-5 font-bold">Lịch sử xử lý</h2>
              <History items={query.data.timeline} />
            </Panel>
          </>
        )}
      </QueryState>
      <ActionDialog
        title="Cập nhật lịch xem"
        open={!!decision}
        onOpenChange={(v) => {
          if (!v) setDecision('')
        }}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={(data) =>
          mutation.mutate({
            resource: 'appointments',
            id: appointmentId,
            value: { ...data, status: decision },
          })
        }
      />
    </ManagerPage>
  )
}
