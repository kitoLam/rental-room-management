import { Modal, Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { warrantyInputSchema, type ManagerAsset } from '@/interfaces/manager'
import { dateOnly } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { managerApi } from '@/services/manager'
import { useState } from 'react'
import { useParams } from 'react-router'
import { ActionDialog, ManagerForm, ManagerLink, ManagerPage, ManagerStatus } from './components'
import { useManagerAction, useManagerList, useManagerQuery } from './context'

export function ManagerFurnitureDetail() {
  const { furnitureId = '' } = useParams(),
    query = useManagerQuery('furniture', (b) => managerApi.get(b, 'furnitures', furnitureId), [
      furnitureId,
    ]),
    reports = useManagerList('maintenance', { size: '100' }),
    [warranty, setWarranty] = useState<ManagerAsset['warranties'][number] | null | undefined>(
      undefined,
    ),
    [remove, setRemove] = useState<string | null>(null),
    mutation = useManagerAction(() => {
      setWarranty(undefined)
      setRemove(null)
    })
  return (
    <ManagerPage
      title="Tài sản & bảo hành"
      actions={<ManagerLink to="/manager/furnitures">Danh sách tài sản</ManagerLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <h2 className="mb-5 text-xl font-bold">
                {query.data.code} · {query.data.name}
              </h2>
              <Facts
                items={[
                  ['Sê-ri', query.data.serial || 'Chưa khai báo'],
                  ['Ngày mua', dateOnly(query.data.purchaseDate)],
                  ['Giá trị', formatVnd(query.data.value)],
                  ['Tình trạng', query.data.condition],
                  ['Vận hành', <ManagerStatus value={query.data.operationalStatus} />],
                ]}
              />
              <div className="mt-5">
                <ManagerLink to={`/manager/rooms/${query.data.roomId}`}>
                  Phòng sử dụng tài sản
                </ManagerLink>
              </div>
            </Panel>
            <Panel>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-bold">Bảo hành</h2>
                <Button variant="outline" onClick={() => setWarranty(null)}>
                  Thêm bảo hành
                </Button>
              </div>
              {query.data.warranties.length ? (
                query.data.warranties.map((w) => (
                  <div key={w.id} className="border-t border-border py-5">
                    <Facts
                      items={[
                        ['Nhà cung cấp', w.provider],
                        ['Mã bảo hành', w.reference],
                        ['Thời gian', `${dateOnly(w.startDate)} – ${dateOnly(w.endDate)}`],
                        ['Điều kiện', w.terms],
                      ]}
                    />
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => setWarranty(w)}>
                        Chỉnh sửa bảo hành
                      </Button>
                      <Button variant="ghost" onClick={() => setRemove(w.id)}>
                        Xóa bảo hành chưa hiệu lực
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Chưa có bảo hành.</p>
              )}
            </Panel>
            <Panel>
              <h2 className="mb-5 font-bold">Lịch sử sửa chữa</h2>
              <QueryState pending={reports.isPending} error={reports.error} retry={reports.refetch}>
                {reports.data?.content
                  .filter((r) => r.assetId === furnitureId)
                  .map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3"
                    >
                      <ManagerLink to={`/manager/maintenance/${r.id}`}>{r.title}</ManagerLink>
                      <ManagerStatus value={r.status} />
                    </div>
                  ))}
              </QueryState>
              <Notice>
                Tài sản có lịch sử xử lý được bảo vệ khỏi xóa. Ngừng sử dụng chỉ khi không còn sửa
                chữa đang mở.
              </Notice>
            </Panel>
          </>
        )}
      </QueryState>
      <Modal
        title={warranty ? 'Cập nhật bảo hành' : 'Thêm bảo hành'}
        open={warranty !== undefined}
        onOpenChange={(v) => {
          if (!v && !mutation.isPending) setWarranty(undefined)
        }}
      >
        {warranty !== undefined && (
          <ManagerForm
            schema={warrantyInputSchema}
            defaults={
              warranty
                ? { ...warranty }
                : {
                    provider: '',
                    reference: '',
                    startDate: new Date().toISOString().slice(0, 10),
                    endDate: '2027-12-31',
                    terms: '',
                  }
            }
            fields={[
              { name: 'provider', label: 'Nhà cung cấp' },
              { name: 'reference', label: 'Mã bảo hành' },
              { name: 'startDate', label: 'Bắt đầu', kind: 'date' },
              { name: 'endDate', label: 'Kết thúc', kind: 'date' },
              { name: 'terms', label: 'Điều kiện', kind: 'textarea' },
            ]}
            pending={mutation.isPending}
            error={mutation.error}
            onSubmit={(value) =>
              mutation.mutate({
                resource: 'furnitures',
                id: furnitureId,
                action: 'warranty-save',
                value: { ...value, ...(warranty ? { warrantyId: warranty.id } : {}) },
              })
            }
          />
        )}
      </Modal>
      <ActionDialog
        title="Xóa bảo hành chưa có hiệu lực?"
        open={!!remove}
        onOpenChange={() => setRemove(null)}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={() =>
          mutation.mutate({
            resource: 'furnitures',
            id: furnitureId,
            action: 'warranty-delete',
            value: { warrantyId: remove },
          })
        }
      />
    </ManagerPage>
  )
}
