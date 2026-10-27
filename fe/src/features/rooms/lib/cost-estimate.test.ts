import { expect, it } from 'vitest'
import { estimateMonthlyCost } from './cost-estimate'

const input = {
  rent: 5000000,
  rentalMode: 'ROOM' as const,
  people: 2,
  vehicles: 2,
  electricity: 150,
  water: 6.5,
  electricityRate: 3500,
  waterRate: 15000,
  parkingRate: 100000,
}

it('adds shared utilities and parking, then splits the whole-room total equally', () => {
  expect(estimateMonthlyCost(input)).toEqual({
    rent: 5000000,
    electricity: 525000,
    water: 97500,
    parking: 200000,
    total: 5822500,
    perPerson: 2911250,
  })
})

it('multiplies per-slot rent by occupants before splitting shared expenses', () => {
  const result = estimateMonthlyCost({ ...input, rentalMode: 'SLOT', rent: 1500000 })
  expect(result.rent).toBe(3000000)
  expect(result.total).toBe(3822500)
  expect(result.perPerson).toBe(1911250)
})

it('allows zero usage and included services', () => {
  const result = estimateMonthlyCost({ ...input, electricityRate: 0, water: 0, vehicles: 0 })
  expect(result.total).toBe(5000000)
})
