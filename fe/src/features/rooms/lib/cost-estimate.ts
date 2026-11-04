export type CostEstimateInput = {
  rent: number
  rentalMode: 'ROOM' | 'SLOT'
  people: number
  vehicles: number
  electricity: number
  water: number
  electricityRate: number
  waterRate: number
  parkingRate: number
}

/** Số lượng dịch vụ tùy chọn đang tích, theo id dịch vụ. Dịch vụ bắt buộc không nằm ở đây. */
export type ServiceSelection = Record<string, number>

/** Chi phí tháng của dịch vụ đã chọn; dịch vụ tính theo chỉ số (điện, nước) đã có ở phần ước tính riêng. */
export function selectedServiceCosts(
  services: { id: string; name: string; unit?: string; price: number; mandatory: boolean; calculationType: string; quantityRule?: string }[],
  selection: ServiceSelection,
  slotCount = 1,
) {
  return services
    .filter((s) => s.unit?.trim().toLocaleLowerCase('vi-VN') !== 'lần'
      && s.calculationType !== 'METERED' && (s.mandatory || (selection[s.id] ?? 0) > 0))
    .map((s) => {
      const quantity = s.quantityRule === 'PER_SLOT' ? slotCount
        : s.quantityRule === 'FIXED_ONE' ? 1
          : s.mandatory ? 1 : selection[s.id]
      return { label: s.name, cost: s.price * (quantity || 0) }
    })
}

export function estimateMonthlyCost(input: CostEstimateInput) {
  const rent = input.rent * (input.rentalMode === 'SLOT' ? input.people : 1)
  const electricity = input.electricity * input.electricityRate
  const water = input.water * input.waterRate
  const parking = input.vehicles * input.parkingRate
  const total = rent + electricity + water + parking
  return { rent, electricity, water, parking, total, perPerson: total / input.people }
}
