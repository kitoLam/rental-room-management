import { useEffect, useId, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Field,
  InlineError,
  Modal,
  Notice,
  Page,
  Pagination,
  QueryState,
} from '@/components/common/page'
import { RoomCard } from './components/room-card'
import { areaOptions } from './data/filter-options'
import { catalogService, defaultFilters } from '@/services/guest-user'
import { provider } from '@/services/config'
import type { RoomFilters } from '@/interfaces/domain'
import { filterParams, parseFilters } from './search-filters'

function Filters({
  filters,
  apply,
}: {
  filters: RoomFilters
  apply: (filters: RoomFilters) => void
}) {
  const id = useId()
  const [error, setError] = useState('')
  const real = provider('catalog') === 'real'
  const types = useQuery({
    queryKey: ['room-types'],
    queryFn: catalogService.types,
    enabled: !real,
  })
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const params = new URLSearchParams()
    form.forEach((value, key) => {
      if (value) params.set(key, String(value))
    })
    params.set('q', filters.q)
    if (filters.branchId) params.set('branchId', filters.branchId)
    params.set('sort', filters.sort)
    const parsed = parseFilters(params)
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setError('')
    apply(parsed.data)
  }
  return (
    <form onSubmit={submit} className="grid gap-5" key={JSON.stringify(filters)}>
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Bộ lọc</h2>
        <button
          type="button"
          className="min-h-11 text-sm text-primary underline"
          onClick={() => apply({ ...defaultFilters, q: filters.q })}
        >
          Xóa bộ lọc
        </button>
      </div>
      <Field label="Khu vực" id={`${id}-area`}>
        <select
          id={`${id}-area`}
          name="area"
          className="input"
          defaultValue={filters.area}
          disabled={real}
        >
          <option value="">Tất cả khu vực</option>
          {areaOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Hình thức thuê" id={`${id}-mode`}>
        <select
          id={`${id}-mode`}
          className="input"
          name="mode"
          defaultValue={filters.mode}
          disabled={real}
        >
          <option value="ALL">Tất cả hình thức</option>
          <option value="ROOM">Nguyên phòng</option>
          <option value="SLOT">Ở ghép / theo chỗ</option>
        </select>
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-bold">Giá tham khảo / tháng</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground">
            Từ (₫)
            <input
              aria-label="Giá tối thiểu"
              className="input mt-2"
              name="minPrice"
              type="number"
              min="0"
              step="50000"
              defaultValue={filters.minPrice}
              placeholder="0"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Đến (₫)
            <input
              aria-label="Giá tối đa"
              className="input mt-2"
              name="maxPrice"
              type="number"
              min="0"
              step="50000"
              defaultValue={filters.maxPrice}
              placeholder="Không giới hạn"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Theo phòng hoặc theo chỗ, tùy hình thức thuê.
        </p>
      </fieldset>
      {!real && (
        <Field label="Loại phòng" id={`${id}-type`}>
          <select
            id={`${id}-type`}
            className="input"
            name="roomTypeId"
            defaultValue={filters.roomTypeId}
          >
            <option value="">Tất cả loại phòng</option>
            {types.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {types.error && <InlineError error={types.error} />}
        </Field>
      )}
      <Field label="Sức chứa tối thiểu" id={`${id}-capacity`}>
        <select
          id={`${id}-capacity`}
          className="input"
          name="minCapacity"
          defaultValue={filters.minCapacity || ''}
        >
          <option value="">Không yêu cầu</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} người
            </option>
          ))}
        </select>
      </Field>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="availableOnly"
          value="true"
          defaultChecked={filters.availableOnly}
          disabled={real}
          className="size-5 accent-primary"
        />
        Chỉ phòng còn chỗ hôm nay
      </label>
      <InlineError error={error ? new Error(error) : null} />
      <Button type="submit">
        <SlidersHorizontal />
        Áp dụng bộ lọc
      </Button>
    </form>
  )
}
export default function RoomSearchPage() {
  const real = provider('catalog') === 'real'
  const [params, setParams] = useSearchParams()
  const parsed = parseFilters(params)
  const filters = parsed.success ? parsed.data : defaultFilters
  const [drawer, setDrawer] = useState(false)
  const [debounced, setDebounced] = useState(filters.q)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(filters.q), 350)
    return () => clearTimeout(timer)
  }, [filters.q])
  const result = useQuery({
    queryKey: ['rooms', 'search', { ...filters, q: debounced }, params.get('demo')],
    queryFn: () => catalogService.rooms({ ...filters, q: debounced }),
    enabled: parsed.success,
  })
  function apply(next: RoomFilters) {
    const query = filterParams(next)
    if (params.get('demo')) query.set('demo', params.get('demo')!)
    setParams(query)
    setDrawer(false)
  }
  return (
    <Page
      eyebrow="TÌM MỘT NƠI THUỘC VỀ BẠN"
      title="Không gian vừa vặn với cuộc sống."
      description="Chọn khu vực, mức giá và cách ở phù hợp. Lịch trống được kiểm tra lại theo ngày bạn muốn thuê."
    >
      <div role="search" className="mb-7 flex gap-3">
        <label className="relative min-w-0 flex-1">
          <Search className="absolute top-3.5 left-4 size-5 text-muted-foreground" />
          <span className="sr-only">Tìm địa chỉ, khu vực</span>
          <input
            className="input h-12 pl-12"
            placeholder="Tìm địa chỉ, khu vực…"
            value={filters.q}
            onChange={(e) => {
              const next = new URLSearchParams(params)
              next.set('q', e.target.value)
              next.delete('page')
              setParams(next, { replace: true })
            }}
          />
        </label>
        <Button variant="outline" className="h-12 lg:hidden" onClick={() => setDrawer(true)}>
          <SlidersHorizontal />
          Bộ lọc
        </Button>
      </div>
      {provider('catalog') === 'real' && (
        <div className="mb-6">
          <Notice>
            Bạn có thể tìm theo địa chỉ, giá, sức chứa và sắp xếp kết quả. Lọc theo hình thức thuê,
            khu vực và lịch trống hiện chưa khả dụng.
          </Notice>
        </div>
      )}
      {!parsed.success ? (
        <div className="grid gap-4">
          <InlineError
            error={
              new Error(
                'Bộ lọc trong liên kết chưa hợp lệ. Kiểm tra khoảng giá, hình thức thuê và số trang.',
              )
            }
          />
          <Button className="justify-self-start" onClick={() => setParams({})}>
            Đặt lại bộ lọc
          </Button>
        </div>
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="sticky top-24 hidden rounded-xl bg-surface p-5 ring-1 ring-border/70 lg:block">
            <Filters filters={filters} apply={apply} />
          </aside>
          <section aria-label="Kết quả tìm phòng" className="min-w-0">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {result.isPending
                  ? 'Đang tìm phòng…'
                  : `${result.data?.totalElements || 0} không gian phù hợp`}
              </p>
              <select
                aria-label="Sắp xếp"
                className="input w-auto max-w-full"
                value={filters.sort}
                onChange={(e) => apply({ ...filters, sort: e.target.value, page: 1 })}
              >
                <option value="recommended">Thứ tự mặc định</option>
                <option value="price-asc">Giá thấp đến cao</option>
                <option value="price-desc">Giá cao đến thấp</option>
                <option value="area-desc" disabled={real}>Diện tích lớn trước</option>
              </select>
            </div>
            {(filters.mode !== 'ALL' ||
              filters.area ||
              filters.minPrice !== undefined ||
              filters.maxPrice !== undefined) && (
              <div className="mb-5 flex flex-wrap gap-2">
                {filters.mode !== 'ALL' && (
                  <button
                    className="flex min-h-11 items-center gap-2 rounded-lg bg-primary-soft px-3 text-sm text-primary"
                    onClick={() => apply({ ...filters, mode: 'ALL', page: 1 })}
                  >
                    {filters.mode === 'ROOM' ? 'Nguyên phòng' : 'Ở ghép'}
                    <X size={14} />
                  </button>
                )}
                <button
                  className="min-h-11 text-sm text-muted-foreground underline"
                  onClick={() => apply(defaultFilters)}
                >
                  Xóa tất cả
                </button>
              </div>
            )}
            <QueryState
              pending={result.isPending}
              error={result.error}
              retry={result.refetch}
              empty={result.data?.content.length === 0}
              emptyMessage="Chưa tìm thấy phòng phù hợp. Thử thay đổi khu vực, khoảng giá hoặc hình thức thuê."
              emptyAction={
                <Button variant="outline" onClick={() => apply(defaultFilters)}>
                  Đặt lại bộ lọc
                </Button>
              }
            >
              {result.data && (
                <>
                  <ul className="grid gap-x-6 gap-y-9 sm:grid-cols-2 xl:grid-cols-3">
                    {result.data.content.map((room) => (
                      <li key={room.id}>
                        <RoomCard room={room} />
                      </li>
                    ))}
                  </ul>
                  <Pagination
                    page={filters.page}
                    totalPages={result.data.totalPages}
                    onPage={(page) => apply({ ...filters, page })}
                  />
                </>
              )}
            </QueryState>
          </section>
        </div>
      )}
      <Modal
        open={drawer}
        onOpenChange={setDrawer}
        title="Tìm đúng không gian"
        description="Lọc theo nhu cầu và ngân sách của bạn."
        drawer
      >
        <Filters filters={filters} apply={apply} />
      </Modal>
    </Page>
  )
}
