import { Modal, Notice } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { ActionDialog, ManagerStatus, Records } from '@/features/manager/components'
import { Facts } from '@/features/tenant/components'
import { dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { useState } from 'react'
import { Link } from 'react-router'
import { OwnerFilters, OwnerPage } from './components'
import { operationsLink, useOwnerFilters, useOwnerList, useOwnerMutation } from './context'

export function OwnerApprovals() {
  const state = useOwnerFilters(),
    query = useOwnerList('approvals', state.filters),
    [id, setId] = useState<string | null>(null),
    [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | null>(null),
    mutation = useOwnerMutation(() => {
      setDecision(null)
    }),
    current = query.data?.content.find((p) => p.id === id)
  return (
    <OwnerPage
      title="Duyệt điều chỉnh hóa đơn"
      description="Quyết định phê duyệt được lưu riêng với việc thực thi điều chỉnh."
    >
      <OwnerFilters
        state={state}
        statuses={[
          { value: 'PENDING', label: 'Chờ duyệt' },
          { value: 'APPROVED', label: 'Đã duyệt' },
          { value: 'REJECTED', label: 'Từ chối' },
        ]}
      />
      <Records
        query={query}
        page={state.page}
        onPage={state.onPage}
        empty="Chưa có yêu cầu điều chỉnh phù hợp."
        columns={[
          {
            label: 'Yêu cầu',
            render: (p) => (
              <button
                className="min-h-11 text-left text-sm font-bold text-primary"
                onClick={() => {
                  setId(p.id)
                  mutation.reset()
                }}
              >
                Hóa đơn kỳ {p.billingMonth.slice(0, 7)}
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {p.requesterName} · {dateTime(p.createdAt)}
                </span>
              </button>
            ),
          },
          {
            label: 'Hiện tại / đề xuất',
            render: (p) => (
              <>
                {formatVnd(p.originalTotal)}
                <span className="mt-1 block text-xs text-muted-foreground">
                  Đề xuất {formatVnd(p.proposedTotal)}
                </span>
              </>
            ),
          },
          {
            label: 'Trạng thái',
            render: (p) => (
              <>
                <ManagerStatus value={p.status} />
                <p className="mt-2 text-xs text-muted-foreground">Chưa áp dụng</p>
              </>
            ),
          },
          { label: 'Lý do', render: (p) => p.reason },
        ]}
      />
      <Modal
        title="Chi tiết yêu cầu điều chỉnh"
        open={!!current && !decision}
        onOpenChange={(v) => {
          if (!v) setId(null)
        }}
      >
        {current && (
          <div className="grid gap-5">
            <Facts
              items={[
                ['Người yêu cầu', current.requesterName],
                ['Kỳ hóa đơn', current.billingMonth.slice(0, 7)],
                ['Giá trị đã phát hành', formatVnd(current.originalTotal)],
                ['Giá trị đề xuất', formatVnd(current.proposedTotal)],
                ['Tác động dự kiến', formatVnd(current.proposedTotal - current.originalTotal)],
                ['Lý do', current.reason],
                ['Quyết định', <ManagerStatus value={current.status} />],
                ['Thực thi', 'Chưa áp dụng'],
              ]}
            />
            <Link
              className="text-sm font-bold text-primary"
              to={operationsLink(current.branchId, `invoices/${current.invoiceId}`)}
            >
              Xem hóa đơn gốc
            </Link>
            {current.evidence.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {current.evidence.map((image, i) => (
                  <img
                    src={image}
                    alt={`Chứng cứ ${i + 1}`}
                    key={image}
                    className="w-full rounded-lg"
                  />
                ))}
              </div>
            )}
            {current.history.map((h, i) => (
              <p key={i} className="text-sm leading-6">
                {dateTime(h.at)} · {h.actor}: {h.note}
              </p>
            ))}
            <Notice>
              Phê duyệt chỉ ghi nhận quyết định. Hóa đơn đã phát hành và các giao dịch giữ nguyên,
              chờ quy trình điều chỉnh được chốt.
            </Notice>
            {current.status === 'PENDING' && (
              <div className="flex gap-3">
                <Button onClick={() => setDecision('APPROVED')}>Chấp thuận đề xuất</Button>
                <Button variant="outline" onClick={() => setDecision('REJECTED')}>
                  Từ chối
                </Button>
              </div>
            )}
            {mutation.isSuccess && <Notice tone="success">Đã ghi nhận quyết định.</Notice>}
          </div>
        )}
      </Modal>
      <ActionDialog
        title={
          decision === 'APPROVED' ? 'Chấp thuận đề xuất điều chỉnh?' : 'Từ chối đề xuất điều chỉnh?'
        }
        open={!!decision}
        onOpenChange={(v) => {
          if (!v) setDecision(null)
        }}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={(v) => mutation.mutate({ path: `/approvals/${id}`, value: { ...v, decision } })}
      />
    </OwnerPage>
  )
}
