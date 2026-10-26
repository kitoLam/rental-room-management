import { afterEach, describe, expect, it, vi } from 'vitest'
import { utilitiesService } from './utilities'
import { managerApi } from './manager'

// These are serialization tests for pending adapters. Their production availability is
// tested independently in real-api.test.ts; this does not enable any application route.
vi.mock('./real-api', () => ({ realApiIssue: () => null }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('Student 4: Utilities and Notification API integration', () => {
  const branchId = '123e4567-e89b-12d3-a456-426614174001'
  const serviceId = '223e4567-e89b-12d3-a456-426614174002'
  const roomId = '323e4567-e89b-12d3-a456-426614174003'
  const chargeId = '423e4567-e89b-12d3-a456-426614174004'
  const userId = '723e4567-e89b-12d3-a456-426614174007'

  it('lists services catalog with proper endpoint and schema parsing', async () => {
    vi.stubEnv('VITE_UTILITIES_PROVIDER', 'real')
    const mockResponse = {
      code: 0,
      data: {
        content: [
          {
            id: serviceId,
            branchId,
            code: 'SRV-ELEC',
            name: 'Điện sinh hoạt',
            unit: 'kWh',
            serviceType: 'ELECTRICITY',
            billingMethod: 'METERED',
            referencePrice: 3500,
            mandatory: true,
            active: true,
          },
        ],
        number: 1,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      },
    }

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await utilitiesService.catalog.list(branchId, { type: 'ELECTRICITY' })
    expect(result.content).toHaveLength(1)
    expect(result.content[0].name).toBe('Điện sinh hoạt')
    expect(result.content[0].serviceType).toBe('ELECTRICITY')
    expect(fetchMock.mock.calls[0][0]).toContain(`/api/branches/${branchId}/services?type=ELECTRICITY`)
  })

  it('creates a service catalog entry', async () => {
    vi.stubEnv('VITE_UTILITIES_PROVIDER', 'real')
    const mockCreated = {
      code: 0,
      data: {
        id: serviceId,
        branchId,
        code: 'SRV-WATER',
        name: 'Nước máy',
        unit: 'm3',
        serviceType: 'WATER',
        billingMethod: 'METERED',
        referencePrice: 20000,
        mandatory: true,
        active: true,
      },
    }

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockCreated), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const created = await utilitiesService.catalog.create(branchId, {
      code: 'SRV-WATER',
      name: 'Nước máy',
      unit: 'm3',
      serviceType: 'WATER',
      billingMethod: 'METERED',
      referencePrice: 20000,
      mandatory: true,
    })

    expect(created.id).toBe(serviceId)
    expect(created.serviceType).toBe('WATER')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('records a meter charge segment and calculates totals', async () => {
    vi.stubEnv('VITE_UTILITIES_PROVIDER', 'real')
    const mockCharge = {
      code: 0,
      data: {
        id: chargeId,
        roomServiceId: serviceId,
        roomId,
        serviceName: 'Điện sinh hoạt',
        billingMonth: '2026-10-01',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        segmentNumber: 1,
        meterReference: 'CT-P101',
        segmentReason: 'NORMAL',
        startReading: 100,
        endReading: 150,
        quantity: 50,
        unitPrice: 3500,
        totalAmount: 175000,
        calculationSnapshot: null,
        evidenceRefs: null,
        status: 'DRAFT',
      },
    }

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockCharge), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const charge = await utilitiesService.charges.create({
      roomServiceId: serviceId,
      billingMonth: '2026-10-01',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      segmentNumber: 1,
      meterReference: 'CT-P101',
      segmentReason: 'NORMAL',
      startReading: 100,
      endReading: 150,
      quantity: 50,
      unitPrice: 3500,
    })

    expect(charge.id).toBe(chargeId)
    expect(charge.totalAmount).toBe(175000)
    expect(charge.status).toBe('DRAFT')
  })

  it('finalizes a batch of charges for invoicing', async () => {
    vi.stubEnv('VITE_UTILITIES_PROVIDER', 'real')
    const mockFinalized = {
      code: 0,
      data: [
        {
          id: chargeId,
          roomServiceId: serviceId,
          roomId,
          serviceName: 'Điện sinh hoạt',
          billingMonth: '2026-10-01',
          startDate: '2026-09-01',
          endDate: '2026-09-30',
          segmentNumber: 1,
          segmentReason: 'NORMAL',
          unitPrice: 3500,
          totalAmount: 175000,
          status: 'FINALIZED',
        },
      ],
    }

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockFinalized), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const list = await utilitiesService.charges.finalize([chargeId])
    expect(list).toHaveLength(1)
    expect(list[0].status).toBe('FINALIZED')
  })

  it('dispatches single and bulk notifications', async () => {
    vi.stubEnv('VITE_NOTIFICATIONS_PROVIDER', 'real')
    const singleNotification = {
      code: 0,
      data: {
        id: '823e4567-e89b-12d3-a456-426614174008',
        recipientUserId: userId,
        type: 'UTILITY_BILL',
        title: 'Thông báo tiền điện',
        message: 'Chỉ số điện tháng 10 đã được ghi nhận: 50 kWh',
        referenceType: 'CHARGE',
        referenceId: chargeId,
        read: false,
        readAt: null,
        createdAt: '2026-10-10T10:00:00Z',
        channel: 'IN_APP',
        deliveryStatus: 'SENT',
      },
    }

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(singleNotification), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const notif = await utilitiesService.notifications.send({
      recipientUserId: userId,
      type: 'UTILITY_BILL',
      title: 'Thông báo tiền điện',
      message: 'Chỉ số điện tháng 10 đã được ghi nhận: 50 kWh',
      referenceType: 'CHARGE',
      referenceId: chargeId,
    })

    expect(notif.id).toBe('823e4567-e89b-12d3-a456-426614174008')
    expect(notif.title).toBe('Thông báo tiền điện')
    expect(fetchMock.mock.calls[0][0]).toContain('/api/notifications/send')
  })

  it('seamlessly integrates real utilities with managerApi adapter', async () => {
    vi.stubEnv('VITE_UTILITIES_PROVIDER', 'real')
    const mockList = {
      code: 0,
      data: {
        content: [
          {
            id: serviceId,
            branchId,
            code: 'SRV-WIFI',
            name: 'Internet FPT',
            unit: 'phòng',
            serviceType: 'INTERNET',
            billingMethod: 'PER_ROOM',
            referencePrice: 100000,
            mandatory: false,
            active: true,
          },
        ],
        number: 1,
        size: 8,
        totalElements: 1,
        totalPages: 1,
      },
    }

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockList), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const page = await managerApi.list(branchId, 'services', { page: '0', size: '8' })
    expect(page.content).toHaveLength(1)
    expect(page.content[0].name).toBe('Internet FPT')
    expect(page.content[0].unitPrice).toBe(100000)
    expect(page.content[0].type).toBe('INTERNET')
  })
})
