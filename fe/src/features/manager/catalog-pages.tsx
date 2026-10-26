import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { Plus } from 'lucide-react'
import { Panel, QueryState, Modal, Notice } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { formatVnd } from '@/lib/format'
import { dateOnly } from '@/lib/activity'
import { managerApi } from '@/services/manager'
import {
  roomTypeInputSchema,
  serviceCatalogInputSchema,
  roomServiceInputSchema,
  assetInputSchema,
  warrantyInputSchema,
  type ManagerAsset,
} from '@/interfaces/manager'
import {
  ManagerPage,
  ManagerLink,
  ManagerStatus,
  Records,
  SearchBox,
  ManagerForm,
  ActionDialog,
  type FieldSpec,
} from './components'
import { useManagerList, useManagerQuery, useManagerAction } from './context'

type Kind = 'room-types' | 'services' | 'room-services' | 'furnitures'
const titles: Record<Kind, string> = {
  'room-types': 'Loại phòng',
  services: 'Danh mục dịch vụ',
  'room-services': 'Cấu hình dịch vụ phòng',
  furnitures: 'Cơ sở vật chất',
}
function CatalogPage({ kind }: { kind: Kind }) {
  const [params] = useSearchParams(),
    [q, setQ] = useState(''),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<Record<string, unknown> | null | undefined>(undefined),
    [deleting, setDeleting] = useState<string | null>(null),
    query = useManagerList(kind, { q, page: String(page - 1), roomId: params.get('roomId') || '' }),
    rooms = useManagerList('rooms', { size: '100' }),
    services = useManagerList('services', { size: '100' }),
    slots = useManagerList('slots', { size: '100' }),
    mutation = useManagerAction(() => {
      setSelected(undefined)
      setDeleting(null)
    })
  const roomOptions = rooms.data?.content.map((r) => ({
      value: r.id,
      label: `${r.code} · ${r.title}`,
    })),
    today = new Date().toISOString().slice(0, 10)
  const config = {
    'room-types': {
      schema: roomTypeInputSchema,
      defaults: { code: '', name: '', defaultCapacity: 2, description: '', active: true },
      fields: [
        { name: 'code', label: 'Mã loại phòng' },
        { name: 'name', label: 'Tên loại phòng' },
        { name: 'defaultCapacity', label: 'Sức chứa mặc định', kind: 'number', min: 1 },
        { name: 'description', label: 'Mô tả', kind: 'textarea' },
        { name: 'active', label: 'Đang sử dụng', kind: 'check' },
      ] as FieldSpec[],
    },
    services: {
      schema: serviceCatalogInputSchema,
      defaults: {
        code: '',
        name: '',
        unit: 'tháng',
        type: 'OTHER',
        billingMethod: 'FIXED',
        unitPrice: 0,
        mandatory: false,
        active: true,
      },
      fields: [
        { name: 'code', label: 'Mã dịch vụ' },
        { name: 'name', label: 'Tên dịch vụ' },
        { name: 'unit', label: 'Đơn vị' },
        {
          name: 'type',
          label: 'Loại dịch vụ',
          kind: 'select',
          options: [
            ['ELECTRICITY', 'Điện'],
            ['WATER', 'Nước'],
            ['INTERNET', 'Internet'],
            ['PARKING', 'Giữ xe'],
            ['CLEANING', 'Dọn vệ sinh'],
            ['SECURITY', 'An ninh'],
            ['OTHER', 'Khác'],
          ].map(([value, label]) => ({ value, label })),
        },
        {
          name: 'billingMethod',
          label: 'Cách tính phí',
          kind: 'select',
          options: [
            ['METERED', 'Theo công tơ'],
            ['PER_PERSON', 'Theo người'],
            ['PER_ROOM', 'Theo phòng'],
            ['FIXED', 'Cố định'],
            ['PER_USE', 'Theo lần sử dụng'],
          ].map(([value, label]) => ({ value, label })),
        },
        { name: 'unitPrice', label: 'Giá tham khảo (VND)', kind: 'number', min: 0 },
        { name: 'mandatory', label: 'Dịch vụ bắt buộc', kind: 'check' },
        { name: 'active', label: 'Đang cung cấp', kind: 'check' },
      ] as FieldSpec[],
    },
    'room-services': {
      schema: roomServiceInputSchema,
      defaults: {
        roomId: params.get('roomId') || '',
        serviceId: '',
        startDate: today,
        endDate: '2030-01-01',
        unitPrice: 0,
      },
      fields: [
        { name: 'roomId', label: 'Phòng', kind: 'select', options: roomOptions },
        {
          name: 'serviceId',
          label: 'Dịch vụ',
          kind: 'select',
          options: services.data?.content
            .filter((s) => s.active)
            .map((s) => ({ value: s.id, label: s.name })),
        },
        {
          name: 'startDate',
          label: 'Hiệu lực từ ngày',
          kind: 'date',
          hint: 'Với cấu hình đã có, nhập ngày bắt đầu giai đoạn giá mới.',
        },
        { name: 'endDate', label: 'Kết thúc (không gồm ngày này)', kind: 'date' },
        { name: 'unitPrice', label: 'Đơn giá áp dụng (VND)', kind: 'number', min: 0 },
      ] as FieldSpec[],
    },
    furnitures: {
      schema: assetInputSchema,
      defaults: {
        roomId: '',
        roomSlotId: null,
        code: '',
        name: '',
        category: 'Nội thất',
        serial: '',
        purchaseDate: today,
        value: 0,
        condition: 'Tốt',
        operationalStatus: 'ACTIVE',
      },
      fields: [
        { name: 'roomId', label: 'Phòng', kind: 'select', options: roomOptions },
        {
          name: 'roomSlotId',
          label: 'Chỗ cá nhân (nếu có)',
          kind: 'select',
          nullable: true,
          options: slots.data?.content.map((s) => ({
            value: s.id,
            label: `${rooms.data?.content.find((r) => r.id === s.roomId)?.code || ''} · ${s.name}`,
          })),
        },
        { name: 'code', label: 'Mã tài sản' },
        { name: 'name', label: 'Tên tài sản' },
        { name: 'category', label: 'Nhóm tài sản' },
        { name: 'serial', label: 'Số sê-ri' },
        { name: 'purchaseDate', label: 'Ngày mua', kind: 'date' },
        { name: 'value', label: 'Giá trị (VND)', kind: 'number', min: 0 },
        { name: 'condition', label: 'Tình trạng' },
        {
          name: 'operationalStatus',
          label: 'Vận hành',
          kind: 'select',
          options: [
            { value: 'ACTIVE', label: 'Đang sử dụng' },
            { value: 'MAINTENANCE', label: 'Bảo trì' },
            { value: 'INACTIVE', label: 'Ngừng sử dụng' },
          ],
        },
      ] as FieldSpec[],
    },
  }[kind]
  const rows = query.data
    ? {
        ...query.data,
        content: query.data.content.map(
          (r) => r as unknown as Record<string, unknown> & { id: string },
        ),
      }
    : undefined
  return (
    <ManagerPage
      title={titles[kind]}
      description={
        kind === 'room-services'
          ? 'Giá theo giai đoạn hiệu lực; giữ nguyên lịch sử đã chốt.'
          : undefined
      }
      actions={
        <Button onClick={() => setSelected(null)}>
          <Plus size={16} />
          {kind === 'room-services' ? 'Gán dịch vụ' : 'Thêm mới'}
        </Button>
      }
    >
      <SearchBox
        value={q}
        onChange={(v) => {
          setQ(v)
          setPage(1)
        }}
      />
      <Records
        query={{ ...query, data: rows }}
        page={page}
        onPage={setPage}
        columns={[
          {
            label: kind === 'room-services' ? 'Phòng / dịch vụ' : 'Mã / tên',
            render: (r) => (
              <div>
                {kind === 'furnitures' ? (
                  <ManagerLink to={`/manager/furnitures/${r.id}`}>
                    {String(r.code)} · {String(r.name)}
                  </ManagerLink>
                ) : (
                  <strong>
                    {kind === 'room-services'
                      ? `${r.roomName} · ${r.serviceName}`
                      : `${r.code} · ${r.name}`}
                  </strong>
                )}
                {kind === 'room-types' && (
                  <p className="text-xs text-muted-foreground">
                    Sức chứa mặc định {String(r.defaultCapacity)} người
                  </p>
                )}
                {kind === 'services' && (
                  <p className="text-xs text-muted-foreground">
                    {r.mandatory ? 'Bắt buộc' : 'Tùy chọn'} · {String(r.unit)}
                  </p>
                )}
              </div>
            ),
          },
          {
            label: 'Thông tin',
            render: (r) =>
              kind === 'room-services' ? (
                <p>
                  {dateOnly(String(r.startDate))} – {dateOnly(String(r.endDate))}
                  <br />
                  {formatVnd(Number(r.unitPrice))}
                </p>
              ) : kind === 'services' ? (
                formatVnd(Number(r.unitPrice))
              ) : kind === 'furnitures' ? (
                <p>
                  {String(r.condition)} · {formatVnd(Number(r.value))}
                </p>
              ) : (
                String(r.description || '—')
              ),
          },
          {
            label: 'Trạng thái',
            render: (r) => (
              <ManagerStatus
                value={String(
                  r.operationalStatus || r.status || (r.active ? 'ACTIVE' : 'INACTIVE'),
                )}
              />
            ),
          },
          {
            label: 'Thao tác',
            render: (r) => (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    setSelected(kind === 'room-services' ? { ...r, startDate: today } : r)
                  }
                >
                  {kind === 'room-services' ? 'Giai đoạn giá mới' : 'Chỉnh sửa'}
                </Button>
                {(kind === 'room-types' || kind === 'furnitures') && (
                  <Button variant="ghost" className="text-danger" onClick={() => setDeleting(r.id)}>
                    Xóa
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />
      <Modal
        title={
          selected
            ? `Chỉnh sửa ${titles[kind].toLowerCase()}`
            : `Thêm ${titles[kind].toLowerCase()}`
        }
        open={selected !== undefined}
        onOpenChange={(v) => {
          if (!v && !mutation.isPending) setSelected(undefined)
        }}
        drawer
      >
        {selected !== undefined && (
          <ManagerForm
            schema={config.schema}
            defaults={selected || config.defaults}
            fields={config.fields}
            onSubmit={(value) =>
              mutation.mutate({
                resource: kind,
                id: selected?.id as string | undefined,
                value,
                method: selected ? 'PATCH' : 'POST',
              })
            }
            pending={mutation.isPending}
            error={mutation.error}
          />
        )}
      </Modal>
      <ActionDialog
        title="Xóa khi không còn hồ sơ tham chiếu?"
        open={!!deleting}
        onOpenChange={() => setDeleting(null)}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={() =>
          mutation.mutate({ resource: kind, id: deleting, value: {}, method: 'DELETE' })
        }
      />
    </ManagerPage>
  )
}
export const ManagerRoomTypes = () => <CatalogPage kind="room-types" />
export const ManagerServices = () => <CatalogPage kind="services" />
export const ManagerRoomServices = () => <CatalogPage kind="room-services" />
export const ManagerFurnitures = () => <CatalogPage kind="furnitures" />
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
