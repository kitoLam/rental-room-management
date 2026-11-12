import { Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { conditionLabel, furnitureApi, roomLabel } from '@/services/furnitures'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'
import { ManagerLink, ManagerPage } from './components'
import { useManager } from './context'
import { FurnitureForm, furnitureGroupsKey } from './manager-furnitures-page'

export function ManagerFurnitureDetail() {
  const { furnitureName = '' } = useParams()
  const { branch } = useManager()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState('')
  const query = useQuery({
    queryKey: furnitureGroupsKey(branch.id),
    queryFn: () => furnitureApi.groups(branch.id),
  })
  // react-router already decodes the param.
  const group = query.data?.find((g) => g.name === furnitureName)
  return (
    <ManagerPage
      title="Chi tiết cơ sở vật chất"
      actions={
        <div className="flex gap-2">
          <ManagerLink to="/manager/furnitures">Danh sách</ManagerLink>
          {group && <Button onClick={() => setEditing(true)}>Chỉnh sửa</Button>}
        </div>
      }
    >
      {notice && <Notice tone="success">{notice}</Notice>}
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
        empty={!!query.data && !group}
        emptyMessage="Không tìm thấy cơ sở vật chất này trong chi nhánh."
        emptyAction={<ManagerLink to="/manager/furnitures">Về danh sách</ManagerLink>}
      >
        {group && (
          <>
            <Panel>
              <h2 className="mb-5 text-xl font-bold">{group.name}</h2>
              <Facts
                items={[
                  ['Tổng số lượng', String(group.totalQuantity)],
                  ['Số phòng đã gắn', String(group.rooms.length)],
                ]}
              />
            </Panel>
            <Panel>
              <h2 className="mb-4 font-bold">Phòng đã gắn</h2>
              <ul className="grid gap-1 text-sm">
                {group.rooms.map((r) => (
                  <li
                    key={r.furnitureId}
                    className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 py-2"
                  >
                    <ManagerLink to={`/manager/rooms/${r.roomId}`}>
                      {roomLabel({ roomNumber: r.roomNumber, roomTitle: r.roomTitle, id: r.roomId })}
                    </ManagerLink>
                    <span className="text-muted-foreground">
                      SL {r.quantity ?? 1} · {r.condition ? conditionLabel[r.condition] : '—'}
                      {r.reportCount > 0 && ` · ${r.reportCount} yêu cầu hỗ trợ`}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </>
        )}
      </QueryState>
      {editing && group && (
        <FurnitureForm
          branchId={branch.id}
          group={group}
          onClose={() => setEditing(false)}
          onSaved={(message) => {
            setEditing(false)
            setNotice(message)
            void queryClient.invalidateQueries({ queryKey: ['furniture-groups'] })
            void queryClient.invalidateQueries({ queryKey: ['rooms'] })
          }}
        />
      )}
    </ManagerPage>
  )
}
