import { InlineError, Modal, Panel, QueryState } from '@/components/common/page'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { formatVnd } from '@/lib/format'
import {
  catalogKinds,
  serviceCatalogApi,
  type CatalogInput,
  type CatalogItem,
  type CatalogKind,
} from '@/services/service-catalog'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { ManagerPage } from './components'
import { useManager } from './context'

const descriptions: Record<CatalogKind, string> = {
  room: 'Dịch vụ đi kèm phòng (Wi-Fi, rác, thang máy...). Chọn dịch vụ cho từng phòng trong trang sửa phòng. Chỉ quản lý được chỉnh.',
  slot: 'Dịch vụ người thuê tự chọn thêm (gửi xe, giặt sấy...). Người thuê gửi yêu cầu đăng ký / huỷ trong không gian thuê.',
}

const calcLabel = { PER_ROOM: 'Theo phòng', PER_PERSON: 'Theo người' } as const

function CatalogPage({ kind }: { kind: CatalogKind }) {
  const { branch } = useManager()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<CatalogItem | 'new' | null>(null)
  const list = useQuery({
    queryKey: ['service-catalog', kind, branch.id],
    queryFn: () => serviceCatalogApi.list(kind, branch.id),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['service-catalog', kind] })
  const remove = useMutation({ mutationFn: (id: string) => serviceCatalogApi.remove(kind, id), onSuccess: refresh })

  return (
    <ManagerPage
      title={catalogKinds[kind].label}
      description={descriptions[kind]}
      actions={
        <Button onClick={() => setEditing('new')}>
          <Plus size={16} />
          Thêm dịch vụ
        </Button>
      }
    >
      <InlineError error={remove.error} />
      <Panel className="p-0 sm:p-0">
        <QueryState
          pending={list.isPending}
          error={list.error}
          retry={list.refetch}
          empty={list.data?.length === 0}
          emptyMessage="Chi nhánh chưa có dịch vụ nào. Bấm “Thêm dịch vụ” để tạo."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-bold">Dịch vụ</th>
                  <th className="px-3 py-3 font-bold">Đơn giá</th>
                  {kind === 'room' && <th className="px-3 py-3 font-bold">Cách tính</th>}
                  <th className="px-3 py-3 font-bold">Trạng thái</th>
                  <th className="px-5 py-3 text-right font-bold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {list.data?.map((item) => (
                  <tr key={item.id} className="border-b border-border/60 align-top">
                    <td className="px-5 py-4">
                      <p className="font-bold">{item.name}</p>
                      {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      {formatVnd(item.unitPrice)} <span className="text-muted-foreground">/ {item.unit}</span>
                    </td>
                    {kind === 'room' && (
                      <td className="px-3 py-4">{item.calculationType ? calcLabel[item.calculationType] : '—'}</td>
                    )}
                    <td className="px-3 py-4">
                      <StatusBadge tone={item.status === 'ACTIVE' ? 'success' : 'neutral'}>
                        {item.status === 'ACTIVE' ? 'Đang áp dụng' : 'Ngừng'}
                      </StatusBadge>
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" aria-label="Sửa" onClick={() => setEditing(item)}>
                        <Pencil size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Xoá"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (window.confirm(`Xoá dịch vụ “${item.name}”?`)) remove.mutate(item.id)
                        }}
                      >
                        <Trash2 size={16} className="text-danger" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </QueryState>
      </Panel>
      {editing && (
        <CatalogForm
          kind={kind}
          branchId={branch.id}
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void refresh()
          }}
        />
      )}
    </ManagerPage>
  )
}

function CatalogForm({
  kind,
  branchId,
  item,
  onClose,
  onSaved,
}: {
  kind: CatalogKind
  branchId: string
  item: CatalogItem | null
  onClose: () => void
  onSaved: () => void
}) {
  const save = useMutation({
    mutationFn: (value: CatalogInput) =>
      item ? serviceCatalogApi.update(kind, item.id, value) : serviceCatalogApi.create(kind, { ...value, branchId }),
    onSuccess: onSaved,
  })
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    save.mutate({
      name: String(form.get('name') || '').trim(),
      unit: String(form.get('unit') || '').trim(),
      unitPrice: Number(form.get('unitPrice') || 0),
      description: String(form.get('description') || '').trim(),
      ...(kind === 'room' ? { calculationType: form.get('calculationType') as 'PER_ROOM' | 'PER_PERSON' } : {}),
      ...(item ? { status: form.get('status') as 'ACTIVE' | 'INACTIVE' } : {}),
    })
  }
  return (
    <Modal title={item ? 'Sửa dịch vụ' : 'Thêm dịch vụ'} description={catalogKinds[kind].label} open onOpenChange={(o) => !o && onClose()}>
      <form onSubmit={submit} className="grid gap-4">
        <Field label="Tên dịch vụ">
          <input name="name" required maxLength={100} defaultValue={item?.name} className="input" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Đơn giá (VND)">
            <input name="unitPrice" type="number" min={0} step={1000} required defaultValue={item?.unitPrice ?? 0} className="input" />
          </Field>
          <Field label="Đơn vị tính">
            <input
              name="unit"
              required
              maxLength={30}
              placeholder={kind === 'room' ? 'phòng/tháng' : 'xe/tháng'}
              defaultValue={item?.unit}
              className="input"
            />
          </Field>
        </div>
        {kind === 'room' && (
          <Field label="Cách tính">
            <select name="calculationType" defaultValue={item?.calculationType || 'PER_ROOM'} className="input">
              <option value="PER_ROOM">Theo phòng (chia đều cho người ở)</option>
              <option value="PER_PERSON">Theo người</option>
            </select>
          </Field>
        )}
        {item && (
          <Field label="Trạng thái">
            <select name="status" defaultValue={item.status} className="input">
              <option value="ACTIVE">Đang áp dụng</option>
              <option value="INACTIVE">Ngừng</option>
            </select>
          </Field>
        )}
        <Field label="Mô tả">
          <textarea name="description" maxLength={500} rows={3} defaultValue={item?.description || ''} className="input min-h-20" />
        </Field>
        <InlineError error={save.error} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
            Huỷ
          </Button>
          <Button type="submit" loading={save.isPending}>
            Lưu
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  )
}

export const ManagerRoomServiceCatalog = () => <CatalogPage kind="room" />
export const ManagerSlotServiceCatalog = () => <CatalogPage kind="slot" />
