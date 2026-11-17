import { InlineError, Modal, Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import {
  conditionLabel,
  conditions,
  furnitureApi,
  roomLabel,
  type FurnitureCondition,
  type FurnitureGroup,
  type FurnitureInput,
  type FurnitureRoom,
} from '@/services/furnitures'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { ManagerLink, ManagerPage } from './components'
import { useManager } from './context'

export const furnitureGroupsKey = (branchId: string) => ['furniture-groups', branchId]

export function ManagerFurnitures() {
  const { branch } = useManager()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<FurnitureGroup | 'new' | null>(null)
  const [deleting, setDeleting] = useState<FurnitureGroup | null>(null)
  const [notice, setNotice] = useState('')
  const list = useQuery({
    queryKey: furnitureGroupsKey(branch.id),
    queryFn: () => furnitureApi.groups(branch.id),
  })
  // Rooms change too (Room.amenities), so refresh room queries as well.
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['furniture-groups'] })
    void queryClient.invalidateQueries({ queryKey: ['rooms'] })
  }
  const remove = useMutation({
    mutationFn: (group: FurnitureGroup) => furnitureApi.remove(group),
    onSuccess: (_, group) => {
      setDeleting(null)
      setNotice(`Đã xóa “${group.name}” và gỡ khỏi ${group.rooms.length} phòng.`)
      refresh()
    },
  })

  return (
    <ManagerPage
      title="Cơ sở vật chất"
      description="Cơ sở vật chất của chi nhánh, nhóm theo tên. Tích chọn phòng để gắn; tên sẽ xuất hiện trong tiện nghi của phòng. Chỉ chủ trọ / quản lý chi nhánh được chỉnh."
      actions={
        <Button onClick={() => setEditing('new')}>
          <Plus size={16} />
          Thêm cơ sở vật chất
        </Button>
      }
    >
      {notice && <Notice tone="success">{notice}</Notice>}
      <Panel className="p-0 sm:p-0">
        <QueryState
          pending={list.isPending}
          error={list.error}
          retry={list.refetch}
          empty={list.data?.length === 0}
          emptyMessage="Chi nhánh chưa có cơ sở vật chất nào. Bấm “Thêm cơ sở vật chất” để tạo."
          emptyAction={<Button onClick={() => setEditing('new')}>Thêm cơ sở vật chất</Button>}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="px-5 py-3 font-bold">Tên</th>
                  <th className="px-3 py-3 font-bold">Tổng SL</th>
                  <th className="px-3 py-3 font-bold">Phòng đã gắn</th>
                  <th className="px-5 py-3 text-right font-bold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {list.data?.map((group) => (
                  <tr key={group.name} className="border-b border-border/60 align-top">
                    <td className="px-5 py-4">
                      <ManagerLink to={`/manager/furnitures/${encodeURIComponent(group.name)}`}>
                        {group.name}
                      </ManagerLink>
                    </td>
                    <td className="px-3 py-4">{group.totalQuantity}</td>
                    <td className="px-3 py-4">
                      <RoomChips rooms={group.rooms} />
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Sửa"
                        onClick={() => setEditing(group)}
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Xóa"
                        onClick={() => {
                          remove.reset()
                          setDeleting(group)
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
        <FurnitureForm
          branchId={branch.id}
          group={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null)
            setNotice(message)
            refresh()
          }}
        />
      )}
      <Modal
        title="Xóa cơ sở vật chất?"
        description={
          deleting
            ? `“${deleting.name}” sẽ bị gỡ khỏi ${deleting.rooms.length} phòng đang gắn. Các tiện nghi khác của phòng không đổi.`
            : undefined
        }
        open={!!deleting}
        onOpenChange={(o) => !o && !remove.isPending && setDeleting(null)}
      >
        <div className="grid gap-4">
          <InlineError error={remove.error} />
          <div className="flex justify-end gap-3">
            <Button variant="outline" disabled={remove.isPending} onClick={() => setDeleting(null)}>
              Giữ lại
            </Button>
            <Button
              loading={remove.isPending}
              className="bg-danger text-white"
              onClick={() => deleting && remove.mutate(deleting)}
            >
              Xóa
            </Button>
          </div>
        </div>
      </Modal>
    </ManagerPage>
  )
}

export function RoomChips({ rooms }: { rooms: FurnitureRoom[] }) {
  if (rooms.length === 0) return <span className="text-muted-foreground">Chưa gắn phòng nào</span>
  return (
    <ul className="flex flex-wrap gap-1.5">
      {rooms.map((r) => (
        <li
          key={r.furnitureId}
          className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium"
        >
          {r.roomNumber || roomLabel({ roomTitle: r.roomTitle, id: r.roomId })}
        </li>
      ))}
    </ul>
  )
}

export function FurnitureForm({
  branchId,
  group,
  onClose,
  onSaved,
}: {
  branchId: string
  group: FurnitureGroup | null
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [roomIds, setRoomIds] = useState<string[]>(group?.rooms.map((r) => r.roomId) ?? [])
  const rooms = useQuery({
    queryKey: ['rooms', 'furniture-form', branchId],
    queryFn: () => furnitureApi.rooms(branchId),
  })
  const save = useMutation({
    mutationFn: (value: FurnitureInput) =>
      group ? furnitureApi.update(group, value) : furnitureApi.create(value),
    onSuccess: (saved) =>
      onSaved(
        group ? `Đã cập nhật “${saved.name}”.` : `Đã tạo cơ sở vật chất “${saved.name}”.`,
      ),
  })
  const toggle = (id: string, checked: boolean) =>
    setRoomIds((ids) => (checked ? [...ids, id] : ids.filter((v) => v !== id)))
  const allIds = rooms.data?.map((r) => r.id) ?? []
  const first = group?.rooms[0]
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    save.mutate({
      branchId,
      name: String(form.get('name') || '').trim(),
      quantity: Number(form.get('quantity') || 1),
      condition: form.get('condition') as FurnitureCondition,
      roomIds,
    })
  }
  return (
    <Modal
      title={group ? 'Sửa cơ sở vật chất' : 'Thêm cơ sở vật chất'}
      description={group ? 'Số lượng và tình trạng áp dụng cho mọi phòng đã chọn.' : undefined}
      open
      onOpenChange={(o) => !o && !save.isPending && onClose()}
    >
      <form onSubmit={submit} className="grid gap-4">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Tên cơ sở vật chất</span>
          <input
            name="name"
            required
            maxLength={80}
            defaultValue={group?.name}
            placeholder="Máy lạnh"
            className="input"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Số lượng mỗi phòng</span>
            <input
              name="quantity"
              type="number"
              min={1}
              required
              defaultValue={first?.quantity ?? 1}
              className="input"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Tình trạng</span>
            <select name="condition" defaultValue={first?.condition ?? 'GOOD'} className="input">
              {conditions.map((c) => (
                <option key={c} value={c}>
                  {conditionLabel[c]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="grid gap-2 rounded-lg border border-border/70 p-4">
          <legend className="px-1 text-sm font-bold">Phòng áp dụng</legend>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Đã chọn {roomIds.length} phòng</span>
            {allIds.length > 0 && (
              <button
                type="button"
                className="text-primary underline"
                onClick={() => setRoomIds(roomIds.length === allIds.length ? [] : allIds)}
              >
                {roomIds.length === allIds.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </button>
            )}
          </div>
          <InlineError error={rooms.error} />
          {rooms.isPending && <p className="text-sm text-muted-foreground">Đang tải phòng...</p>}
          {rooms.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">Chi nhánh chưa có phòng nào.</p>
          )}
          <ul className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
            {rooms.data?.map((r) => (
              <li key={r.id}>
                <label className="flex min-h-11 items-center gap-3 rounded-lg border border-border/60 px-3 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={roomIds.includes(r.id)}
                    onChange={(e) => toggle(r.id, e.target.checked)}
                  />
                  <span className="min-w-0 flex-1 truncate">{roomLabel(r)}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <InlineError error={save.error} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
            Hủy
          </Button>
          <Button type="submit" loading={save.isPending} disabled={roomIds.length === 0}>
            Lưu
          </Button>
        </div>
      </form>
    </Modal>
  )
}
