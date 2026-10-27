import { z } from 'zod'
import { databaseIdSchema, type RoomFilters } from '@/interfaces/domain'
const number = z.coerce.number().nonnegative().finite()
const filtersSchema = z
  .object({
    q: z.string().max(255),
    area: z.string(),
    mode: z.enum(['ALL', 'ROOM', 'SLOT']),
    minPrice: number.optional(),
    maxPrice: number.optional(),
    roomTypeId: z.union([z.literal(''), databaseIdSchema]),
    minCapacity: z.coerce.number().int().min(1).max(100).optional(),
    availableOnly: z.boolean(),
    sort: z.enum(['recommended', 'price-asc', 'price-desc', 'area-desc']),
    page: z.coerce.number().int().min(1).max(10000),
    branchId: databaseIdSchema.optional(),
  })
  .refine((v) => v.minPrice === undefined || v.maxPrice === undefined || v.minPrice <= v.maxPrice, {
    message: 'Giá tối đa phải lớn hơn hoặc bằng giá tối thiểu.',
    path: ['maxPrice'],
  })
export function parseFilters(params: URLSearchParams) {
  const preset = params.get('price')?.split('-')
  return filtersSchema.safeParse({
    q: params.get('q') || '',
    area: params.get('area') || '',
    mode: params.get('mode') || 'ALL',
    minPrice: params.get('minPrice') || preset?.[0] || undefined,
    maxPrice: params.get('maxPrice') || preset?.[1] || undefined,
    minCapacity: params.get('minCapacity') || undefined,
    roomTypeId: params.get('roomTypeId') || '',
    availableOnly: params.get('availableOnly') === 'true',
    sort: params.get('sort') || 'recommended',
    page: params.get('page') || 1,
    branchId: params.get('branchId') || undefined,
  })
}
export function filterParams(filters: RoomFilters) {
  const result = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== '' &&
      value !== false &&
      !(key === 'mode' && value === 'ALL') &&
      !(key === 'page' && value === 1) &&
      !(key === 'sort' && value === 'recommended')
    )
      result.set(key, String(value))
  })
  return result
}
