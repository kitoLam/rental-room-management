import { Modal } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import {
  assetInputSchema,
  roomServiceInputSchema,
  roomTypeInputSchema,
  serviceCatalogInputSchema,
} from '@/interfaces/manager'
import { dateOnly } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  ActionDialog,
  ManagerForm,
  ManagerLink,
  ManagerPage,
  ManagerStatus,
  Records,
  SearchBox,
  type FieldSpec,
} from './components'
import { useManagerAction, useManagerList } from './context'

type Kind = 'room-types' | 'services' | 'room-services' | 'furnitures'
const titles: Record<Kind, string> = {
  'room-types': 'Loại phòng',
  services: 'Danh mục dịch vụ',
  'room-services': 'Cấu hình dịch vụ phòng',
  furnitures: 'Cơ sở vật chất',
}
export function CatalogPage({ kind }: { kind: Kind }) {
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
                {(kind === 'room-types' || kind === 'furnitures' || kind === 'services') && (
                  <Button
                    variant="ghost"
                    className={kind === 'services' && !r.active ? 'text-primary' : 'text-danger'}
                    onClick={() => {
                      if (kind === 'services' && !r.active) {
                        mutation.mutate({
                          resource: kind,
                          id: String(r.id),
                          value: { active: true },
                          method: 'PATCH',
                        })
                      } else {
                        setDeleting(r.id)
                      }
                    }}
                  >
                    {kind === 'services' ? (r.active ? 'Ẩn' : 'Hiện') : 'Xóa'}
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
        title={
          kind === 'services'
            ? 'Ẩn dịch vụ này (ngừng cung cấp)?'
            : 'Xóa khi không còn hồ sơ tham chiếu?'
        }
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
