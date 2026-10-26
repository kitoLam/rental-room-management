import { routes } from '@/lib/routes'

/** Ghép bộ lọc thành URL trang tìm phòng, bỏ qua giá trị rỗng. */
export function buildSearchUrl(filters: Record<string, string>) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  const query = params.toString()
  return query ? `${routes.rooms}?${query}` : routes.rooms
}
