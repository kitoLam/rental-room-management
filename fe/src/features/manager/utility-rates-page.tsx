import { useId, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Field, InlineError, Notice, Page, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { databaseIdSchema, type UtilityRates } from '@/interfaces/domain'
import { useSession } from '@/features/auth/session-store'
import { utilityRatesService } from '@/services/utility-rates'
import { formatVnd } from '@/lib/format'

const fields = [
  { key: 'electricityRate' as const, label: 'Đơn giá điện (₫ / kWh)' },
  { key: 'waterRate' as const, label: 'Đơn giá nước (₫ / m³)' },
  { key: 'parkingRate' as const, label: 'Phí gửi xe (₫ / xe / tháng)' },
]

function RatesForm({
  title,
  description,
  rates,
  save,
  saved,
}: {
  title: string
  description: string
  rates: UtilityRates
  save: (rates: UtilityRates) => Promise<unknown>
  saved: () => Promise<void>
}) {
  const id = useId()
  const [values, setValues] = useState(
    () =>
      Object.fromEntries(fields.map(({ key }) => [key, rates[key]?.toString() ?? ''])) as Record<
        keyof UtilityRates,
        string
      >,
  )
  const [error, setError] = useState<Error | null>(null)
  const mutation = useMutation({ mutationFn: save, onSuccess: saved })
  function submit(event: FormEvent) {
    event.preventDefault()
    const input = Object.fromEntries(
      fields.map(({ key }) => [key, values[key].trim() === '' ? null : Number(values[key])]),
    ) as UtilityRates
    if (
      Object.values(input).some(
        (value) =>
          value !== null && (!Number.isSafeInteger(value) || value < 0 || value > 999999999999),
      )
    ) {
      setError(new Error('Đơn giá phải là số nguyên không âm, tối đa 12 chữ số.'))
      return
    }
    setError(null)
    mutation.mutate(input)
  }
  return (
    <Panel>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      <form className="mt-5 grid gap-4" onSubmit={submit}>
        {fields.map(({ key, label }) => (
          <Field key={key} id={`${id}-${key}`} label={label}>
            <input
              id={`${id}-${key}`}
              type="number"
              className="input"
              min="0"
              max="999999999999"
              step="1"
              placeholder="Chưa cấu hình"
              value={values[key]}
              disabled={mutation.isPending}
              onChange={(event) =>
                setValues((current) => ({ ...current, [key]: event.target.value }))
              }
            />
          </Field>
        ))}
        <InlineError error={error || mutation.error} />
        {mutation.isSuccess && (
          <p role="status" className="text-sm text-primary">
            Đã lưu đơn giá.
          </p>
        )}
        <Button type="submit" loading={mutation.isPending}>
          Lưu {title.toLowerCase()}
        </Button>
      </form>
    </Panel>
  )
}

export default function UtilityRatesPage() {
  const { roomId = '' } = useParams()
  const user = useSession((state) => state.user)
  const [savedMessage, setSavedMessage] = useState('')
  const client = useQueryClient()
  const permitted = !!user?.roles.some((role) => role === 'OWNER' || role === 'MANAGER')
  const validId = databaseIdSchema.safeParse(roomId).success
  const config = useQuery({
    queryKey: ['utility-rates', roomId],
    queryFn: () => utilityRatesService.configuration(roomId),
    enabled: permitted && validId,
    retry: false,
  })
  async function saved() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['utility-rates'] }),
      client.invalidateQueries({ queryKey: ['rooms'] }),
    ])
    setSavedMessage('Đã lưu đơn giá. Trang chi tiết phòng sẽ sử dụng đơn giá mới.')
  }
  if (!validId)
    return (
      <Page title="Liên kết phòng không hợp lệ" back="/rooms">
        <Notice>Chọn lại phòng từ danh sách.</Notice>
      </Page>
    )
  return (
    <Page
      title="Cấu hình đơn giá điện, nước và gửi xe"
      back={`/rooms/${roomId}`}
      narrow
      description="Đơn giá được công khai trong phần dự tính chi phí. Tenant chỉ nhập mức sử dụng, không sửa được đơn giá."
    >
      {!permitted ? (
        <Notice>
          <Link
            className="underline"
            to={`/login?redirect=${encodeURIComponent(`/rooms/${roomId}/utility-rates`)}`}
          >
            Đăng nhập bằng Owner/Manager có quyền quản lý phòng này.
          </Link>
        </Notice>
      ) : (
        <QueryState pending={config.isPending} error={config.error} retry={config.refetch}>
          {config.data && (
            <div className="grid gap-6">
              <p className="text-sm font-semibold">
                {config.data.roomNumber} · {config.data.branchName}
              </p>
              {savedMessage && <Notice tone="success">{savedMessage}</Notice>}
              <RatesForm
                key={`branch-${JSON.stringify(config.data.branchRates)}`}
                title="Đơn giá chi nhánh"
                description="Áp dụng cho các phòng chưa có đơn giá riêng. Để trống nghĩa là chưa cấu hình; nhập 0 nếu miễn phí."
                rates={config.data.branchRates}
                save={(rates) => utilityRatesService.updateBranch(config.data.branchId, rates)}
                saved={saved}
              />
              <RatesForm
                key={`room-${JSON.stringify(config.data.configuredRates)}`}
                title="Đơn giá riêng của phòng"
                description="Để trống từng ô để dùng đơn giá của chi nhánh. Nhập 0 để miễn phí riêng cho phòng này."
                rates={config.data.configuredRates}
                save={(rates) => utilityRatesService.updateRoom(roomId, rates)}
                saved={saved}
              />
              <Panel>
                <h2 className="font-bold">Đơn giá đang áp dụng cho phòng</h2>
                <dl className="mt-4 space-y-3">
                  {fields.map(({ key, label }) => (
                    <div key={key} className="flex flex-wrap justify-between gap-2 text-sm">
                      <dt>{label}</dt>
                      <dd className="font-semibold">
                        {config.data.effectiveRates[key] == null
                          ? 'Chưa cấu hình'
                          : formatVnd(config.data.effectiveRates[key])}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Panel>
            </div>
          )}
        </QueryState>
      )}
    </Page>
  )
}
