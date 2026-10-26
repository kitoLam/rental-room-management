import { catalogService, defaultFilters } from '@/services/guest-user'
import { provider } from '@/services/config'
export async function getFeaturedRooms() {
  return (
    await catalogService.rooms({ ...defaultFilters, availableOnly: provider('catalog') === 'mock' })
  ).content
}
