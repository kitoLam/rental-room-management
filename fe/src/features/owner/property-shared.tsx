import { Field, InlineError, Notice, Panel } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import {
  ownerProperties,
  propertyInputSchema,
  propertyRoomInputSchema,
  propertyTypes,
  type OwnerProperty,
  type PropertyInput,
  type PropertyRoomInput,
} from '@/services/owner-properties'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'

export function BackToBranches() {
  return (
    <Button asChild variant="outline">
      <Link to="/owner/branches">Danh sách chi nhánh</Link>
    </Button>
  )
}
export function PropertyForm({ branch }: { branch?: OwnerProperty }) {
  const navigate = useNavigate(),
    cache = useQueryClient()
  const [error, setError] = useState<Error | null>(null)
  const mutation = useMutation({
    mutationFn: (input: PropertyInput) => ownerProperties.save(input, branch?.id),
    onSuccess: async (saved) => {
      await cache.invalidateQueries({ queryKey: ['owner-branches'] })
      await cache.invalidateQueries({ queryKey: ['owner-properties'] })
      await cache.invalidateQueries({ queryKey: ['owner-property'] })
      navigate(`/owner/branches/${saved.id}`)
    },
  })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const parsed = propertyInputSchema.safeParse({
      ...Object.fromEntries(form),
      declaredRoomCount: Number(form.get('declaredRoomCount')),
    })
    if (!parsed.success) {
      setError(new Error(parsed.error.issues[0].message))
      return
    }
    setError(null)
    mutation.mutate(parsed.data)
  }
  return (
    <Panel>
      <form onSubmit={submit} className="grid gap-6">
        <div className="rounded-xl bg-primary-soft p-4 text-sm leading-6">
          Bước 1: Đăng ký chi nhánh → Bước 2: Thêm từng phòng. Mỗi phòng luôn thuộc một chi nhánh đã
          đăng ký.
        </div>
        <Field id="property-name" label="Tên chi nhánh">
          <input
            id="property-name"
            name="name"
            required
            maxLength={255}
            className="input"
            placeholder="Ví dụ: Căn hộ An Bình"
            defaultValue={branch?.name}
          />
        </Field>
        <Field id="property-address" label="Địa chỉ đầy đủ">
          <input
            id="property-address"
            name="address"
            required
            maxLength={2000}
            className="input"
            placeholder="Số nhà, đường, phường/xã, tỉnh/thành phố"
            defaultValue={branch?.address}
          />
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field id="property-type" label="Loại hình">
            <select
              id="property-type"
              name="propertyType"
              className="input"
              defaultValue={branch?.propertyType || 'APARTMENT'}
            >
              {Object.entries(propertyTypes).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id="property-count"
            label="Tổng số phòng"
            hint="Số phòng thực tế có thể đăng ký trong chi nhánh."
          >
            <input
              id="property-count"
              name="declaredRoomCount"
              required
              type="number"
              min={Math.max(1, branch?.roomCount || 0)}
              max={10000}
              step={1}
              className="input"
              defaultValue={branch?.declaredRoomCount ?? undefined}
            />
          </Field>
        </div>
        <Field id="property-description" label="Mô tả (không bắt buộc)">
          <textarea
            id="property-description"
            name="description"
            rows={4}
            maxLength={4000}
            className="input"
            defaultValue={branch?.description || ''}
          />
        </Field>
        <InlineError error={error || mutation.error} />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={mutation.isPending}>
            {branch ? 'Lưu chi nhánh' : 'Đăng ký và thêm phòng'}
          </Button>
          <BackToBranches />
        </div>
      </form>
    </Panel>
  )
}
export function RoomRegistrationForm({ branch }: { branch: OwnerProperty }) {
  const cache = useQueryClient(),
    navigate = useNavigate()
  const [error, setError] = useState<Error | null>(null)
  const mutation = useMutation({
    mutationFn: (input: PropertyRoomInput) => ownerProperties.createRoom(branch.id, input),
    onSuccess: async () => {
      await Promise.all(
        [
          ['owner-branches'],
          ['owner-properties'],
          ['owner-property'],
          ['owner-property-rooms'],
          ['rooms'],
          ['admin'],
        ].map((queryKey) => cache.invalidateQueries({ queryKey })),
      )
      navigate(`/owner/branches/${branch.id}`)
    },
  })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const parsed = propertyRoomInputSchema.safeParse({
      ...Object.fromEntries(form),
      capacity: Number(form.get('capacity')),
      referencePrice: Number(form.get('referencePrice')),
      areaSqm: form.get('areaSqm') ? Number(form.get('areaSqm')) : null,
      floorNumber: form.get('floorNumber') ? Number(form.get('floorNumber')) : null,
      isPublic: form.get('isPublic') === 'on',
    })
    if (!parsed.success) {
      setError(new Error(parsed.error.issues[0].message))
      return
    }
    setError(null)
    mutation.mutate(parsed.data)
  }
  return (
    <Panel>
      <form className="grid gap-6" onSubmit={submit}>
        <Notice>
          Đăng ký phòng thuộc <strong>{branch.name}</strong>. Còn{' '}
          {(branch.declaredRoomCount || 0) - branch.roomCount} phòng có thể thêm.
        </Notice>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field id="room-code" label="Mã phòng">
            <input
              id="room-code"
              name="code"
              className="input"
              required
              maxLength={50}
              pattern="[A-Za-z0-9_-]+"
              placeholder="Ví dụ: P101"
            />
          </Field>
          <Field id="room-type" label="Tên loại phòng">
            <input
              id="room-type"
              name="roomTypeName"
              className="input"
              required
              maxLength={100}
              placeholder="Ví dụ: Studio có ban công"
            />
          </Field>
          <Field id="room-mode" label="Hình thức thuê">
            <select id="room-mode" name="rentalMode" className="input">
              <option value="ROOM">Nguyên phòng</option>
              <option value="SLOT">Theo chỗ / ở ghép</option>
            </select>
          </Field>
          <Field id="room-capacity" label="Sức chứa tối đa">
            <input
              id="room-capacity"
              name="capacity"
              className="input"
              type="number"
              min={1}
              max={100}
              step={1}
              required
            />
          </Field>
          <Field id="room-area" label="Diện tích (m²)">
            <input
              id="room-area"
              name="areaSqm"
              className="input"
              type="number"
              min={0.01}
              max={10000}
              step={0.01}
            />
          </Field>
          <Field id="room-floor" label="Tầng">
            <input
              id="room-floor"
              name="floorNumber"
              className="input"
              type="number"
              min={0}
              max={200}
              step={1}
            />
          </Field>
        </div>
        <Field
          id="room-price"
          label="Giá thuê tham khảo / tháng (₫)"
          hint="Giá cho cả phòng hoặc cho một chỗ, theo hình thức thuê đã chọn."
        >
          <input
            id="room-price"
            name="referencePrice"
            className="input"
            required
            type="number"
            min={0}
            max={1000000000000}
            step={1}
          />
        </Field>
        <Field id="room-description" label="Mô tả phòng">
          <textarea
            id="room-description"
            name="description"
            className="input"
            rows={4}
            maxLength={4000}
          />
        </Field>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="isPublic" className="size-5 accent-primary" />
          Hiển thị phòng trên trang tìm phòng
        </label>
        <InlineError error={error || mutation.error} />
        <div className="flex gap-3">
          <Button type="submit" loading={mutation.isPending}>
            Đăng ký phòng
          </Button>
          <Button asChild variant="outline">
            <Link to={`/owner/branches/${branch.id}`}>Hủy</Link>
          </Button>
        </div>
      </form>
    </Panel>
  )
}
