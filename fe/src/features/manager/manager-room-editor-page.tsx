import { InlineError, Modal, Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { roomInputSchema } from '@/interfaces/manager'
import { formatVnd } from '@/lib/format'
import { provider } from '@/services/config'
import { managerApi } from '@/services/manager'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ImagePicker, ManagerForm, ManagerLink, ManagerPage, type FieldSpec } from './components'
import {
  managerLink,
  useManager,
  useManagerAction,
  useManagerList,
  useManagerQuery,
} from './context'

export function ManagerRoomEditor() {
  const { roomId } = useParams(),
    { branch } = useManager(),
    navigate = useNavigate(),
    types = useManagerList('room-types', { size: '100' }),
    query = useManagerQuery(
      'room-editor',
      (b) => (roomId ? managerApi.get(b, 'rooms', roomId) : Promise.resolve(null)),
      [roomId],
    ),
    [images, setImages] = useState<string[] | null>(null),
    [preview, setPreview] = useState<Record<string, unknown> | null>(null),
    mutation = useManagerAction((result) => {
      setPreview(null)
      navigate(managerLink(`/manager/rooms/${result?.id || roomId}`, branch.id))
    })
  const fields: FieldSpec[] = [
    { name: 'code', label: 'Mã phòng' },
    ...(provider('manager') === 'mock' ? [{ name: 'title', label: 'Tên phòng' }] : []),
    {
      name: 'roomTypeId',
      label: 'Loại phòng',
      kind: 'select',
      options: types.data?.content
        .filter((t) => t.active)
        .map((t) => ({ value: t.id, label: t.name })),
    },
    {
      name: 'rentalMode',
      label: 'Hình thức thuê',
      kind: 'select',
      options: [
        { value: 'ROOM', label: 'Nguyên phòng' },
        { value: 'SLOT', label: 'Thuê chỗ' },
      ],
    },
    { name: 'capacity', label: 'Sức chứa (người)', kind: 'number', min: 1 },
    { name: 'sizeM2', label: 'Diện tích (m²)', kind: 'number', min: 1, step: 0.1, nullable: true },
    { name: 'floor', label: 'Tầng', kind: 'number', min: 0, nullable: true },
    { name: 'price', label: 'Giá tham khảo (VND)', kind: 'number', min: 0 },
    { name: 'description', label: 'Mô tả', kind: 'textarea' },
    { name: 'amenities', label: 'Tiện nghi', kind: 'list', hint: 'Mỗi dòng một tiện nghi.' },
    {
      name: 'operationalStatus',
      label: 'Vận hành',
      kind: 'select',
      options: [
        { value: 'ACTIVE', label: 'Hoạt động' },
        { value: 'MAINTENANCE', label: 'Bảo trì' },
        { value: 'INACTIVE', label: 'Ngừng hoạt động' },
      ],
    },
    { name: 'isPublic', label: 'Công khai trên trang tìm phòng', kind: 'check' },
  ]
  return (
    <ManagerPage
      title={roomId ? 'Chỉnh sửa phòng' : 'Tạo phòng'}
      actions={
        <ManagerLink to={roomId ? `/manager/rooms/${roomId}` : '/manager/rooms'}>
          Quay lại
        </ManagerLink>
      }
    >
      <QueryState
        pending={query.isPending || types.isPending}
        error={query.error || types.error}
        retry={() => {
          void query.refetch()
          void types.refetch()
        }}
      >
        <Panel>
          <ManagerForm
            schema={
              provider('manager') === 'real'
                ? roomInputSchema.omit({ images: true, title: true })
                : roomInputSchema.omit({ images: true })
            }
            defaults={
              query.data
                ? { ...query.data }
                : {
                    code: '',
                    title: '',
                    roomTypeId: '',
                    rentalMode: 'ROOM',
                    capacity: 2,
                    sizeM2: 25,
                    floor: 1,
                    price: 3000000,
                    description: '',
                    amenities: [],
                    operationalStatus: 'ACTIVE',
                    isPublic: false,
                  }
            }
            fields={fields}
            onSubmit={(value) =>
              setPreview({
                ...value,
                title:
                  value.title ||
                  `${types.data?.content.find((t) => t.id === value.roomTypeId)?.name || 'Phòng'} ${value.code}`,
                images: images || query.data?.images || [],
              })
            }
            pending={mutation.isPending}
            error={mutation.error}
            submitLabel="Xem trước"
          >
            <ImagePicker
              value={images || query.data?.images || []}
              onChange={setImages}
              disabled={mutation.isPending}
            />
          </ManagerForm>
        </Panel>
      </QueryState>
      <Modal
        title="Xem trước thông tin phòng"
        open={!!preview}
        onOpenChange={(v) => {
          if (!mutation.isPending && !v) setPreview(null)
        }}
      >
        {preview && (
          <div className="grid gap-5">
            <h2 className="text-xl font-bold">{String(preview.title)}</h2>
            <Facts
              items={[
                ['Chi nhánh', branch.name],
                ['Mã phòng', String(preview.code)],
                ['Hình thức', preview.rentalMode === 'SLOT' ? 'Thuê chỗ' : 'Nguyên phòng'],
                ['Giá tham khảo', formatVnd(Number(preview.price))],
              ]}
            />
            <Notice>Giá tham khảo không thay thế giá thuê đã thỏa thuận trong hợp đồng.</Notice>
            <InlineError error={mutation.error} />
            <Button
              loading={mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  resource: 'rooms',
                  id: roomId,
                  value: preview,
                  method: roomId ? 'PATCH' : 'POST',
                })
              }
            >
              Lưu phòng
            </Button>
          </div>
        )}
      </Modal>
    </ManagerPage>
  )
}
