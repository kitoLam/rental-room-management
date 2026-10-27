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

export function estimateMonthlyCost(input: CostEstimateInput) {
  const rent = input.rent * (input.rentalMode === 'SLOT' ? input.people : 1)
  const electricity = input.electricity * input.electricityRate
  const water = input.water * input.waterRate
  const parking = input.vehicles * input.parkingRate
  const total = rent + electricity + water + parking
  return { rent, electricity, water, parking, total, perPerson: total / input.people }
}
