import { InlineError, Modal, Panel, QueryState } from '@/components/common/page'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { formatVnd } from '@/lib/format'
import {
  isInUse,
  requestStatusLabel,
  requestStatusTone,
  serviceCatalogApi,
  type CatalogItem,
} from '@/services/service-catalog'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Plus } from 'lucide-react'
import { useState } from 'react'
import { TenantPage } from './components'
import { useTenant } from './context'

/** Optional (slot) services of the tenant's active contracts: what is in use, request add / cancel. */
export function SlotServicesPage() {
  const queryClient = useQueryClient()
  const contracts = useQuery({ queryKey: ['tenant', 'contracts-real'], queryFn: serviceCatalogApi.myContracts })
  const active = (contracts.data || []).filter((c) => c.status === 'ACTIVE')
  // Always the contract of the tenancy selected in the sidebar ("Không gian thuê").
  const { tenancy } = useTenant()
  const contract = active.find((c) => c.id === tenancy.contractId)
  const room = useQuery({
    queryKey: ['tenant', 'room-of', contract?.roomId],
    queryFn: () => serviceCatalogApi.roomOf(contract!.roomId!),
    enabled: !!contract?.roomId,
  })
  const catalog = useQuery({
    queryKey: ['tenant', 'slot-catalog', room.data?.branchId],
    queryFn: () => serviceCatalogApi.activeOfBranch('slot', room.data!.branchId),
    enabled: !!room.data?.branchId,
  })
  const requests = useQuery({ queryKey: ['tenant', 'slot-requests'], queryFn: serviceCatalogApi.myRequests })
  const [adding, setAdding] = useState<CatalogItem | null>(null)
  const [cancelling, setCancelling] = useState<{ id: string; name: string } | null>(null)

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tenant', 'slot-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['tenant', 'contracts-real'] }),
    ])
  const cancelUse = useMutation({
    mutationFn: (slotServiceId: string) =>
      serviceCatalogApi.createRequest({ contractId: contract!.id, slotServiceId, action: 'CANCEL' }),
    onSuccess: () => {
      setCancelling(null)
      void refresh()
    },
  })
  const withdraw = useMutation({ mutationFn: serviceCatalogApi.cancelRequest, onSuccess: refresh })

  const inUse = (contract?.activeSlotServices || []).filter((s) => isInUse(s))
  const pending = (requests.data || []).filter((r) => r.contractId === contract?.id && r.status === 'PENDING')
  const pendingIds = new Set(pending.map((r) => r.slotServiceId))
  const usedIds = new Set(inUse.map((s) => s.slotServiceId))

  return (
    <TenantPage
      title="Dịch vụ tự chọn"
      description="Đăng ký thêm hoặc huỷ dịch vụ như gửi xe, giặt sấy. Quản lý duyệt xong thì dịch vụ mới bắt đầu / kết thúc."
    >
      <QueryState
        pending={contracts.isPending}
        error={contracts.error}
        retry={contracts.refetch}
        empty={!contract}
        emptyMessage="Chỗ ở đang chọn chưa có hợp đồng đang hiệu lực. Dịch vụ tự chọn dùng được khi hợp đồng của chỗ này có hiệu lực."
      >
        <InlineError error={withdraw.error} />
        <Panel>
          <h2 className="mb-4 font-bold">Đang sử dụng</h2>
          {inUse.length === 0 && <p className="text-sm text-muted-foreground">Chưa dùng dịch vụ tự chọn nào.</p>}
          <ul className="grid gap-3">
            {inUse.map((s) => (
              <li key={s.slotServiceId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
                <div>
                  <p className="font-bold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.quantity} × {formatVnd(s.unitPrice ?? 0)} / tháng
                  </p>
                </div>
                {pendingIds.has(s.slotServiceId) ? (
                  <StatusBadge tone="warning">Đang chờ duyệt</StatusBadge>
                ) : (
                  !s.endDate && (
                    <Button
                      variant="outline"
                      className="text-danger"
                      onClick={() => setCancelling({ id: s.slotServiceId, name: s.name || 'dịch vụ' })}
                    >
                      Yêu cầu huỷ
                    </Button>
                  )
                )}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <h2 className="mb-4 font-bold">Có thể đăng ký thêm</h2>
          <QueryState pending={catalog.isPending} error={catalog.error || room.error} retry={catalog.refetch}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {catalog.data
                ?.filter((item) => !usedIds.has(item.id))
                .map((item) => (
                  <li key={item.id} className="flex flex-col justify-between gap-3 rounded-lg border border-border p-4">
                    <div>
                      <p className="font-bold">{item.name}</p>
                      <p className="text-sm">
                        {formatVnd(item.unitPrice)} <span className="text-muted-foreground">/ tháng</span>
                      </p>
                      {item.description && <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>}
                    </div>
                    {pendingIds.has(item.id) ? (
                      <StatusBadge tone="warning">Đang chờ duyệt</StatusBadge>
                    ) : (
                      <Button variant="soft" onClick={() => setAdding(item)}>
                        <Plus size={16} />
                        Đăng ký
                      </Button>
                    )}
                  </li>
                ))}
            </ul>
          </QueryState>
        </Panel>

        <Panel>
          <h2 className="mb-4 font-bold">Yêu cầu của tôi</h2>
          {requests.data?.filter((r) => r.contractId === contract?.id).length === 0 && (
            <p className="text-sm text-muted-foreground">Chưa có yêu cầu nào.</p>
          )}
          <ul className="grid gap-2">
            {requests.data
              ?.filter((r) => r.contractId === contract?.id)
              .map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {r.action === 'ADD' ? 'Đăng ký' : 'Huỷ'} · {r.serviceName}
                      {r.action === 'ADD' && ` × ${r.quantity}`}
                    </p>
                    {r.rejectReason && <p className="text-xs text-danger">Lý do: {r.rejectReason}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={requestStatusTone[r.status]}>{requestStatusLabel[r.status]}</StatusBadge>
                    {r.status === 'PENDING' && (
                      <Button variant="ghost" disabled={withdraw.isPending} onClick={() => withdraw.mutate(r.id)}>
                        Rút lại
                      </Button>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        </Panel>
      </QueryState>
      <Modal
        title="Huỷ dịch vụ"
        description={cancelling ? `Gửi yêu cầu huỷ “${cancelling.name}” tới quản lý?` : undefined}
        open={!!cancelling}
        onOpenChange={(o) => {
          if (!o && !cancelUse.isPending) {
            setCancelling(null)
            cancelUse.reset()
          }
        }}
      >
        <div className="grid gap-5">
          <div className="flex gap-3 rounded-lg bg-danger/10 p-4 text-sm">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-danger" />
            <p>Dịch vụ vẫn dùng và tính phí bình thường cho đến khi quản lý duyệt yêu cầu huỷ.</p>
          </div>
          <InlineError error={cancelUse.error} />
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              disabled={cancelUse.isPending}
              onClick={() => {
                setCancelling(null)
                cancelUse.reset()
              }}
            >
              Giữ dịch vụ
            </Button>
            <Button
              className="bg-danger text-white hover:bg-danger/90"
              loading={cancelUse.isPending}
              onClick={() => cancelling && cancelUse.mutate(cancelling.id)}
            >
              Gửi yêu cầu huỷ
            </Button>
          </div>
        </div>
      </Modal>
      {adding && contract && (
        <AddModal
          item={adding}
          contractId={contract.id}
          onClose={() => setAdding(null)}
          onDone={() => {
            setAdding(null)
            void refresh()
          }}
        />
      )}
    </TenantPage>
  )
}

function AddModal({
  item,
  contractId,
  onClose,
  onDone,
}: {
  item: CatalogItem
  contractId: string
  onClose: () => void
  onDone: () => void
}) {
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState('')
  const send = useMutation({
    mutationFn: () => serviceCatalogApi.createRequest({ contractId, slotServiceId: item.id, action: 'ADD', quantity, note }),
    onSuccess: onDone,
  })
  return (
    <Modal title={`Đăng ký ${item.name}`} description={`${formatVnd(item.unitPrice)} / tháng`} open onOpenChange={(o) => !o && onClose()}>
      <div className="grid gap-4">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Số lượng</span>
          <input type="number" min={1} max={10} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="input" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Ghi chú cho quản lý</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} className="input min-h-20" />
        </label>
        <p className="text-sm">
          Dự kiến: <span className="font-bold">{formatVnd(item.unitPrice * quantity)}</span> / tháng
        </p>
        <InlineError error={send.error} />
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={send.isPending}>
            Huỷ
          </Button>
          <Button loading={send.isPending} disabled={quantity < 1} onClick={() => send.mutate()}>
            Gửi yêu cầu
          </Button>
        </div>
      </div>
    </Modal>
  )
}
