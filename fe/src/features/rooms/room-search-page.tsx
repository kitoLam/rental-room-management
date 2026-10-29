import { useEffect, useId, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Field,
  InlineError,
  Modal,
  Page,
  Pagination,
  QueryState,
} from '@/components/common/page'
import { RoomCard } from './components/room-card'
import { areaOptions } from './data/filter-options'
import { catalogService, defaultFilters } from '@/services/guest-user'
import type { RoomFilters } from '@/interfaces/domain'
import { filterParams, parseFilters } from './search-filters'

const formatVndNumber = (num: number) => new Intl.NumberFormat('vi-VN').format(num)

function Filters({
  filters,
  apply,
}: {
  filters: RoomFilters
  apply: (filters: RoomFilters) => void
}) {
  const id = useId()
  const [error, setError] = useState('')
  const [minPrice, setMinPrice] = useState<number>(filters.minPrice ?? 500000)
  const [maxPrice, setMaxPrice] = useState<number>(filters.maxPrice ?? 20000000)
  const [minArea, setMinArea] = useState<number>(filters.minArea ?? 10)
  const [maxArea, setMaxArea] = useState<number>(filters.maxArea ?? 100)

  const types = useQuery({
    queryKey: ['room-types'],
    queryFn: catalogService.types,
  })

  const branches = useQuery({
    queryKey: ['public-branches'],
    queryFn: catalogService.branches,
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const params = new URLSearchParams()
    form.forEach((value, key) => {
      if (value) params.set(key, String(value))
    })
    params.set('q', filters.q)
    params.set('sort', filters.sort)
    params.set('minPrice', String(minPrice))
    params.set('maxPrice', String(maxPrice))
    params.set('minArea', String(minArea))
    params.set('maxArea', String(maxArea))

    const parsed = parseFilters(params)
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setError('')
    apply(parsed.data)
  }

  function handleReset() {
    setMinPrice(500000)
    setMaxPrice(20000000)
    setMinArea(10)
    setMaxArea(100)
    setError('')
    apply({ ...defaultFilters, q: filters.q })
  }

  return (
    <form onSubmit={submit} className="grid gap-5" key={JSON.stringify(filters)}>
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-base">Bộ lọc tìm kiếm</h2>
        <button
          type="button"
          className="min-h-11 text-sm text-primary underline hover:text-primary/80 transition-colors"
          onClick={handleReset}
        >
          Xóa bộ lọc
        </button>
      </div>

      <Field label="Vị trí / Chi nhánh" id={`${id}-branch`}>
        <select
          id={`${id}-branch`}
          name="branchId"
          className="input"
          defaultValue={filters.branchId || ''}
        >
          <option value="">Tất cả vị trí / chi nhánh</option>
          {branches.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} {b.address ? `(${b.address})` : ''}
            </option>
          ))}
        </select>
        {branches.error && <InlineError error={branches.error} />}
      </Field>

      <Field label="Khu vực" id={`${id}-area`}>
        <select
          id={`${id}-area`}
          name="area"
          className="input"
          defaultValue={filters.area}
        >
          <option value="">Tất cả khu vực</option>
          {areaOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Loại hình (Nhà riêng hay Căn hộ)" id={`${id}-mode`}>
        <select
          id={`${id}-mode`}
          className="input"
          name="mode"
          defaultValue={filters.mode}
        >
          <option value="ALL">Tất cả hình thức</option>
          <option value="ROOM">Nhà riêng / Căn hộ nguyên căn</option>
          <option value="SLOT">Phòng ở ghép / Theo chỗ (Slot)</option>
        </select>
      </Field>

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

      {/* Kéo giá tiền từ 500.000 - 20.000.000 VNĐ */}
      <fieldset className="rounded-lg border border-border/70 p-3.5 bg-surface/50 space-y-3">
        <legend className="px-1 text-sm font-bold text-foreground">
          Giá tiền (500.000 - 20.000.000 ₫)
        </legend>
        <div className="flex items-center justify-between text-xs font-semibold text-primary">
          <span>{formatVndNumber(minPrice)} ₫</span>
          <span className="text-muted-foreground">—</span>
          <span>{formatVndNumber(maxPrice)} ₫</span>
        </div>
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
              <span>Từ:</span>
              <span className="font-medium text-foreground">{formatVndNumber(minPrice)} ₫</span>
            </div>
            <input
              type="range"
              aria-label="Thanh trượt giá tối thiểu"
              min={500000}
              max={20000000}
              step={500000}
              value={minPrice}
              onChange={(e) => {
                const val = Number(e.target.value)
                setMinPrice(Math.min(val, maxPrice))
              }}
              className="w-full accent-primary cursor-pointer h-2 bg-muted rounded-lg"
            />
          </div>
          <div>
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
              <span>Đến:</span>
              <span className="font-medium text-foreground">{formatVndNumber(maxPrice)} ₫</span>
            </div>
            <input
              type="range"
              aria-label="Thanh trượt giá tối đa"
              min={500000}
              max={20000000}
              step={500000}
              value={maxPrice}
              onChange={(e) => {
                const val = Number(e.target.value)
                setMaxPrice(Math.max(val, minPrice))
              }}
              className="w-full accent-primary cursor-pointer h-2 bg-muted rounded-lg"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label className="text-[11px] text-muted-foreground">Nhập giá từ (₫)</label>
            <input
              type="number"
              aria-label="Giá tối thiểu"
              name="minPrice"
              className="input mt-1 text-xs"
              min={0}
              max={20000000}
              step={500000}
              value={minPrice}
              onChange={(e) => setMinPrice(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Nhập giá đến (₫)</label>
            <input
              type="number"
              aria-label="Giá tối đa"
              name="maxPrice"
              className="input mt-1 text-xs"
              min={0}
              max={20000000}
              step={500000}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
            />
          </div>
        </div>
      </fieldset>

      {/* Kéo diện tích từ 10m2 - 100m2 */}
      <fieldset className="rounded-lg border border-border/70 p-3.5 bg-surface/50 space-y-3">
        <legend className="px-1 text-sm font-bold text-foreground">
          Diện tích (10m² - 100m²)
        </legend>
        <div className="flex items-center justify-between text-xs font-semibold text-primary">
          <span>{minArea} m²</span>
          <span className="text-muted-foreground">—</span>
          <span>{maxArea} m²</span>
        </div>
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
              <span>Từ:</span>
              <span className="font-medium text-foreground">{minArea} m²</span>
            </div>
            <input
              type="range"
              aria-label="Thanh trượt diện tích tối thiểu"
              min={10}
              max={100}
              step={5}
              value={minArea}
              onChange={(e) => {
                const val = Number(e.target.value)
                setMinArea(Math.min(val, maxArea))
              }}
              className="w-full accent-primary cursor-pointer h-2 bg-muted rounded-lg"
            />
          </div>
          <div>
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
              <span>Đến:</span>
              <span className="font-medium text-foreground">{maxArea} m²</span>
            </div>
            <input
              type="range"
              aria-label="Thanh trượt diện tích tối đa"
              min={10}
              max={100}
              step={5}
              value={maxArea}
              onChange={(e) => {
                const val = Number(e.target.value)
                setMaxArea(Math.max(val, minArea))
              }}
              className="w-full accent-primary cursor-pointer h-2 bg-muted rounded-lg"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label className="text-[11px] text-muted-foreground">Từ (m²)</label>
            <input
              type="number"
              aria-label="Diện tích tối thiểu"
              name="minArea"
              className="input mt-1 text-xs"
              min={10}
              max={100}
              step={5}
              value={minArea}
              onChange={(e) => setMinArea(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Đến (m²)</label>
            <input
              type="number"
              aria-label="Diện tích tối đa"
              name="maxArea"
              className="input mt-1 text-xs"
              min={10}
              max={100}
              step={5}
              value={maxArea}
              onChange={(e) => setMaxArea(Number(e.target.value))}
            />
          </div>
        </div>
      </fieldset>

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
              {n} người trở lên
            </option>
          ))}
        </select>
      </Field>

      <label className="flex min-h-11 items-center gap-3 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          name="availableOnly"
          value="true"
          defaultChecked={filters.availableOnly}
          className="size-5 accent-primary rounded cursor-pointer"
        />
        <span>Chỉ phòng còn chỗ hôm nay</span>
      </label>

      <InlineError error={error ? new Error(error) : null} />

      <Button type="submit" className="w-full">
        <SlidersHorizontal />
        Áp dụng bộ lọc
      </Button>
    </form>
  )
}

export default function RoomSearchPage() {
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
      wide
      eyebrow="TÌM MỘT NƠI THUỘC VỀ BẠN"
      title="Không gian vừa vặn với cuộc sống."
      description="Chọn khu vực, mức giá, diện tích và cách ở phù hợp. Tìm nhanh theo tên phòng, mã số phòng, chủ nhà hoặc địa chỉ."
    >
      <div role="search" className="mb-7 flex gap-3">
        <label className="relative min-w-0 flex-1">
          <Search className="absolute top-3.5 left-4 size-5 text-muted-foreground" />
          <span className="sr-only">Tìm theo tên phòng, mã phòng, chủ nhà, địa chỉ</span>
          <input
            className="input h-12 pl-12"
            placeholder="Tìm theo tên phòng, mã số phòng, chủ nhà, địa chỉ…"
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

      {!parsed.success ? (
        <div className="grid gap-4">
          <InlineError
            error={
              new Error(
                'Bộ lọc trong liên kết chưa hợp lệ. Vui lòng kiểm tra khoảng giá, diện tích và số trang.',
              )
            }
          />
          <Button className="justify-self-start" onClick={() => setParams({})}>
            Đặt lại bộ lọc
          </Button>
        </div>
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
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
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:inline">Sắp xếp theo:</span>
                <select
                  aria-label="Sắp xếp"
                  className="input w-auto max-w-full"
                  value={filters.sort}
                  onChange={(e) => apply({ ...filters, sort: e.target.value, page: 1 })}
                >
                  <option value="recommended">Thứ tự mặc định</option>
                  <option value="price-asc">Giá thấp đến cao</option>
                  <option value="price-desc">Giá cao đến thấp</option>
                  <option value="area-desc">Diện tích lớn nhất</option>
                  <option value="area-asc">Diện tích nhỏ nhất</option>
                  <option value="newest">Mới nhất</option>
                </select>
              </div>
            </div>

            {/* Chips lọc đang áp dụng */}
            {(filters.mode !== 'ALL' ||
              filters.area ||
              filters.branchId ||
              filters.roomTypeId ||
              filters.minPrice !== undefined ||
              filters.maxPrice !== undefined ||
              filters.minArea !== undefined ||
              filters.maxArea !== undefined) && (
              <div className="mb-5 flex flex-wrap gap-2 items-center">
                {filters.mode !== 'ALL' && (
                  <button
                    className="flex min-h-8 items-center gap-1.5 rounded-lg bg-primary-soft px-3 text-xs text-primary font-medium"
                    onClick={() => apply({ ...filters, mode: 'ALL', page: 1 })}
                  >
                    {filters.mode === 'ROOM' ? 'Căn hộ / Nhà riêng' : 'Ở ghép'}
                    <X size={12} />
                  </button>
                )}
                {(filters.minPrice !== undefined || filters.maxPrice !== undefined) && (
                  <button
                    className="flex min-h-8 items-center gap-1.5 rounded-lg bg-primary-soft px-3 text-xs text-primary font-medium"
                    onClick={() =>
                      apply({ ...filters, minPrice: undefined, maxPrice: undefined, page: 1 })
                    }
                  >
                    Giá: {formatVndNumber(filters.minPrice ?? 500000)}₫ — {formatVndNumber(filters.maxPrice ?? 20000000)}₫
                    <X size={12} />
                  </button>
                )}
                {(filters.minArea !== undefined || filters.maxArea !== undefined) && (
                  <button
                    className="flex min-h-8 items-center gap-1.5 rounded-lg bg-primary-soft px-3 text-xs text-primary font-medium"
                    onClick={() =>
                      apply({ ...filters, minArea: undefined, maxArea: undefined, page: 1 })
                    }
                  >
                    Diện tích: {filters.minArea ?? 10}m² — {filters.maxArea ?? 100}m²
                    <X size={12} />
                  </button>
                )}
                {filters.area && (
                  <button
                    className="flex min-h-8 items-center gap-1.5 rounded-lg bg-primary-soft px-3 text-xs text-primary font-medium"
                    onClick={() => apply({ ...filters, area: '', page: 1 })}
                  >
                    Khu vực: {areaOptions.find((a) => a.value === filters.area)?.label || filters.area}
                    <X size={12} />
                  </button>
                )}
                <button
                  className="min-h-8 text-xs text-muted-foreground underline hover:text-foreground transition-colors ml-2"
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
              emptyMessage="Chưa tìm thấy phòng phù hợp. Thử thay đổi từ khóa, khoảng giá, diện tích hoặc hình thức thuê."
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
        description="Lọc theo nhu cầu, khoảng giá và diện tích của bạn."
        drawer
      >
        <Filters filters={filters} apply={apply} />
      </Modal>
    </Page>
  )
}
