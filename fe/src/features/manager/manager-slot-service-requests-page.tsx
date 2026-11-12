import { InlineError, Modal, Panel, QueryState } from '@/components/common/page'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { formatVnd } from '@/lib/format'
import {
  requestStatusLabel,
  requestStatusTone,
  serviceCatalogApi,
  type RequestStatus,
  type SlotServiceRequest,
} from '@/services/service-catalog'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ManagerPage } from './components'
import { useManager } from './context'

const filters: { value: RequestStatus | ''; label: string }[] = [
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Từ chối' },
  { value: '', label: 'Tất cả' },
]

/** Staff review of tenants' requests to add / stop optional (slot) services. */
export function ManagerSlotServiceRequests() {
  const { branch } = useManager()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<RequestStatus | ''>('PENDING')
  const [approving, setApproving] = useState<SlotServiceRequest | null>(null)
  const [rejecting, setRejecting] = useState<SlotServiceRequest | null>(null)
  const list = useQuery({
    queryKey: ['slot-service-requests', branch.id, status],
    queryFn: () => serviceCatalogApi.requests(branch.id, status || undefined),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['slot-service-requests'] })

  return (
    <ManagerPage
      title="Yêu cầu dịch vụ tự chọn"
      description="Người thuê xin đăng ký thêm hoặc huỷ dịch vụ tự chọn. Duyệt xong, dịch vụ được thêm vào / kết thúc trên hợp đồng từ ngày hiệu lực."
    >
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Button key={f.label} variant={status === f.value ? 'default' : 'outline'} onClick={() => setStatus(f.value)}>
            {f.label}
          </Button>
        ))}
      </div>
      <Panel className="p-0 sm:p-0">
        <QueryState
          pending={list.isPending}
          error={list.error}
          retry={list.refetch}
          empty={list.data?.length === 0}
          emptyMessage="Không có yêu cầu nào."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-bold">Người thuê · Hợp đồng</th>
                  <th className="px-3 py-3 font-bold">Yêu cầu</th>
                  <th className="px-3 py-3 font-bold">Trạng thái</th>
                  <th className="px-5 py-3 text-right font-bold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {list.data?.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 align-top">
                    <td className="px-5 py-4">
                      <p className="font-bold">{r.tenantName || 'Người thuê'}</p>
                      <p className="text-xs text-muted-foreground">{r.contractNumber}</p>
                    </td>
                    <td className="px-3 py-4">
                      <p className="font-medium">
                        {r.action === 'ADD' ? 'Đăng ký' : 'Huỷ'} · {r.serviceName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.quantity} × {formatVnd(r.unitPrice ?? 0)} / {r.unit}
                      </p>
                      {r.note && <p className="mt-1 text-xs">“{r.note}”</p>}
                      {r.rejectReason && <p className="mt-1 text-xs text-danger">Lý do: {r.rejectReason}</p>}
                    </td>
                    <td className="px-3 py-4">
                      <StatusBadge tone={requestStatusTone[r.status]}>{requestStatusLabel[r.status]}</StatusBadge>
                      {r.effectiveDate && <p className="mt-1 text-xs text-muted-foreground">Hiệu lực {r.effectiveDate}</p>}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      {r.status === 'PENDING' && (
                        <div className="flex justify-end gap-2">
                          <Button variant="soft" onClick={() => setApproving(r)}>
                            Duyệt
                          </Button>
                          <Button variant="outline" className="text-danger" onClick={() => setRejecting(r)}>
                            Từ chối
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </QueryState>
      </Panel>
      {approving && (
        <DecisionModal
          title="Duyệt yêu cầu"
          request={approving}
          approve
          onClose={() => setApproving(null)}
          onDone={() => {
            setApproving(null)
            void refresh()
          }}
        />
      )}
      {rejecting && (
        <DecisionModal
          title="Từ chối yêu cầu"
          request={rejecting}
          onClose={() => setRejecting(null)}
          onDone={() => {
            setRejecting(null)
            void refresh()
          }}
        />
      )}
    </ManagerPage>
  )
}

function DecisionModal({
  title,
  request,
  approve = false,
  onClose,
  onDone,
}: {
  title: string
  request: SlotServiceRequest
  approve?: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [value, setValue] = useState(approve ? new Date().toISOString().slice(0, 10) : '')
  const decide = useMutation({
    mutationFn: () => (approve ? serviceCatalogApi.approve(request.id, value) : serviceCatalogApi.reject(request.id, value)),
    onSuccess: onDone,
  })
  return (
    <Modal
      title={title}
      description={`${request.action === 'ADD' ? 'Đăng ký' : 'Huỷ'} “${request.serviceName}” · ${request.tenantName || ''}`}
      open
      onOpenChange={(o) => !o && onClose()}
    >
      <div className="grid gap-4">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{approve ? 'Ngày hiệu lực' : 'Lý do từ chối'}</span>
          {approve ? (
            <input type="date" value={value} onChange={(e) => setValue(e.target.value)} className="input" />
          ) : (
            <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={3} maxLength={500} className="input min-h-20" />
          )}
        </label>
        <InlineError error={decide.error} />
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={decide.isPending}>
            Huỷ
          </Button>
          <Button loading={decide.isPending} disabled={!approve && !value.trim()} onClick={() => decide.mutate()}>
            {approve ? 'Duyệt' : 'Từ chối'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
