import { test, expect, type Page } from '@playwright/test'
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const path = (route: string, branch = 10) => `${route}?branchId=${id(branch)}`
const note = 'Đã đối chiếu đầy đủ hồ sơ và thỏa thuận.'
const month = (offset = 1) => {
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + offset)
  return d.toISOString().slice(0, 10)
}
async function login(
  page: Page,
  destination = path('/manager/dashboard'),
  email = 'manager@tropro.demo',
  switching = false,
) {
  if (switching) {
    await page.goto('/profile')
    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
    await expect(page).toHaveURL('/')
  }
  await page.goto(`/login?redirect=${encodeURIComponent(destination)}`)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill('TroPro@123')
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).toHaveURL(destination)
  await expect(page.getByLabel('Đang tải', { exact: true })).toHaveCount(0)
}
async function api(
  page: Page,
  route: string,
  method = 'GET',
  body?: unknown,
  email = 'manager@tropro.demo',
) {
  return page.evaluate(
    async ({ route, method, body, email }) => {
      const state = JSON.parse(sessionStorage.getItem('tropro-demo-v2')!),
        user = state.users.find((u: { email: string }) => u.email === email),
        original = state.users.find(
          (u: { id: string; email: string }) => u.id === state.refreshUserId,
        )
      let token = Object.entries(state.sessions).find(([, v]) => v === user?.id)?.[0]
      if (!token) {
        const login = await fetch('/__mock/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: 'TroPro@123' }),
        })
        token = (await login.json()).data.accessToken
        if (original && original.email !== email)
          await fetch('/__mock/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: original.email, password: 'TroPro@123' }),
          })
      }
      const response = await fetch(`/__mock${route}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      return { status: response.status, body: await response.json() }
    },
    { route, method, body, email },
  )
}
async function confirm(page: Page) {
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Lý do / ghi chú').fill(note)
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(dialog).toHaveCount(0)
}
test('assigned branches, scoped switching, refresh and foreign deep links', async ({ page }) => {
  await login(page)
  await expect(page.getByLabel('CHI NHÁNH ĐƯỢC PHÂN CÔNG')).toHaveValue(id(10))
  expect(await page.getByLabel('CHI NHÁNH ĐƯỢC PHÂN CÔNG').locator('option').count()).toBe(2)
  await page.getByLabel('CHI NHÁNH ĐƯỢC PHÂN CÔNG').selectOption(id(12))
  await expect(page).toHaveURL(path('/manager/dashboard', 12))
  await page.goto('/manager/tenants')
  await expect(page.getByLabel('CHI NHÁNH ĐƯỢC PHÂN CÔNG')).toHaveValue(id(12))
  await expect(page.getByRole('link', { name: 'Lê Phương Vy', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('link', { name: 'Lê Phương Vy', exact: true })).toBeVisible()
  expect((await api(page, `/api/manager/branches/${id(11)}/rooms`)).status).toBe(403)
  await page.goto(path('/manager/rooms', 11))
  await expect(
    page.getByText('Bạn không còn quyền quản lý chi nhánh trong liên kết này.', { exact: false }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Phòng & chỗ ở' })).toHaveCount(0)
})
test('revocation hides private content, reset restores assignment without logout', async ({
  page,
}) => {
  await login(page, path('/manager/rooms'))
  await expect(page.getByRole('heading', { name: 'Phòng & chỗ ở' })).toBeVisible()
  expect(
    (
      await api(page, '/api/manager/demo/scenario', 'POST', {
        scenario: 'revoke',
        branchId: id(10),
      })
    ).status,
  ).toBe(200)
  await expect(page.getByRole('heading', { name: 'Phòng & chỗ ở' })).toHaveCount(0)
  await expect(
    page.getByText('Bạn không còn quyền quản lý chi nhánh trong liên kết này.', { exact: false }),
  ).toBeVisible()
  await page.getByText('Công cụ kịch bản Manager demo', { exact: true }).click()
  await page.getByRole('button', { name: 'Khôi phục dữ liệu liên kết' }).click()
  await expect(page.getByRole('heading', { name: 'Một ngày vận hành rõ ràng.' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Một ngày vận hành rõ ràng.' })).toBeVisible()
})
test('room create preview, private public boundary, edit and duplicate validation', async ({
  page,
}) => {
  await login(page, path('/manager/rooms/new'))
  await page.getByLabel('Mã phòng', { exact: true }).fill('TD-QA-NEW')
  await page.getByLabel('Tên phòng', { exact: true }).fill('Phòng kiểm thử có cửa sổ')
  await page.getByLabel('Loại phòng', { exact: true }).selectOption(id(30))
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Phòng kiểm thử có cửa sổ')
  await page.getByRole('button', { name: 'Lưu phòng', exact: true }).click()
  await expect(page).toHaveURL(/\/manager\/rooms\/[0-9a-f-]+\?branchId=/)
  const roomId = new URL(page.url()).pathname.split('/').at(-1)!
  expect((await api(page, `/api/v1/public/rooms/${roomId}`)).status).toBe(404)
  await page.getByRole('link', { name: 'Chỉnh sửa', exact: true }).click()
  await page.getByLabel('Tên phòng', { exact: true }).fill('Phòng đã cập nhật')
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click()
  await page.getByRole('button', { name: 'Lưu phòng', exact: true }).click()
  await expect(page.getByRole('heading', { name: /TD-QA-NEW · Phòng đã cập nhật/ })).toBeVisible()
  await page.goto(path('/manager/rooms/new'))
  await page.getByLabel('Mã phòng', { exact: true }).fill('TD-QA-NEW')
  await page.getByLabel('Tên phòng', { exact: true }).fill('Phòng trùng mã')
  await page.getByLabel('Loại phòng', { exact: true }).selectOption(id(30))
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click()
  await page.getByRole('button', { name: 'Lưu phòng', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Mã phòng đã tồn tại')
})
test('USER appointment arrives and Manager decision updates USER status', async ({ page }) => {
  await login(page)
  const a = await api(
    page,
    '/api/appointments',
    'POST',
    {
      roomId: id(109),
      startAt: `${month()}T10:00:00+07:00`,
      endAt: `${month()}T10:30:00+07:00`,
      note: 'Muốn xem phòng có cửa sổ.',
    },
    'an@tropro.demo',
  )
  expect(a.status).toBe(201)
  await page.goto(path(`/manager/appointments/${a.body.data.id}`))
  await page.getByRole('button', { name: 'Xác nhận lịch', exact: true }).click()
  await confirm(page)
  await expect(page.getByText('Đã xác nhận', { exact: true }).first()).toBeVisible()
  const user = await api(
    page,
    `/api/appointments/${a.body.data.id}`,
    'GET',
    undefined,
    'an@tropro.demo',
  )
  expect(user.body.data.status).toBe('CONFIRMED')
})
test('booking conversion, personal prepaid sandbox and contract activation across role UIs', async ({
  page,
}) => {
  test.setTimeout(90000)
  await login(page, path(`/manager/bookings/${id(305)}`, 12))
  await page.getByRole('button', { name: 'Tạo hợp đồng từ giữ phòng' }).click()
  await page.getByLabel('Mã hợp đồng', { exact: true }).fill('TP-QA-CONVERT')
  await page.getByLabel('Điều khoản đã thỏa thuận').fill(note)
  await page.getByLabel('Giá thuê hàng tháng (VND)').fill('1900000')
  await page.getByLabel('Giá thuê kỳ đầu (VND)').fill('1900000')
  await page.getByLabel('Giá thuê kỳ cuối (VND)').fill('1900000')
  await page.getByRole('button', { name: 'Xác nhận tạo hợp đồng nháp' }).click()
  await expect(page).toHaveURL(/\/manager\/contracts\/[0-9a-f-]+\?branchId=/)
  const contractId = new URL(page.url()).pathname.split('/').at(-1)!,
    ts = await api(page, `/api/manager/branches/${id(12)}/tenants?contractId=${contractId}`),
    t = ts.body.data.content[0]
  expect(t.status).toBe('DRAFT')
  await login(
    page,
    `/tenant/contracts/${contractId}/my-terms?tenancyId=${t.id}`,
    'an@tropro.demo',
    true,
  )
  const prepay = page.getByRole('button', { name: 'Thanh toán mô phỏng', exact: true })
  await prepay.first().click()
  await page.getByRole('button', { name: 'Xác nhận giao dịch sandbox' }).click()
  await expect(prepay.first()).toBeDisabled()
  await prepay.nth(1).click()
  await page.getByRole('button', { name: 'Xác nhận giao dịch sandbox' }).click()
  await expect
    .poll(
      async () => {
        const r = await api(
          page,
          `/api/tenant/tenancies/${t.id}/payments`,
          'GET',
          undefined,
          'an@tropro.demo',
        )
        return r.body.data.filter((p: { status: string }) => p.status === 'VERIFIED').length
      },
      { timeout: 20000 },
    )
    .toBe(2)
  await login(page, path(`/manager/contracts/${contractId}`, 12), 'manager@tropro.demo', true)
  await page.getByRole('button', { name: 'Kích hoạt hợp đồng', exact: true }).click()
  await confirm(page)
  await expect(page.getByText('Đang hiệu lực', { exact: true }).first()).toBeVisible()
  expect(
    (await api(page, `/api/manager/branches/${id(12)}/tenants?contractId=${contractId}`)).body.data
      .content[0].status,
  ).toBe('ACTIVE')
})
test('Tenant service request waits for Manager approval and returns the shared result', async ({
  page,
}) => {
  await login(page, path('/manager/service-requests'))
  const request = await api(
    page,
    `/api/tenant/tenancies/${id(5100)}/services`,
    'POST',
    {
      serviceId: id(5602),
      startDate: new Date().toISOString().slice(0, 10),
      endDate: month(2),
      note: 'Đăng ký đường truyền riêng.',
    },
    'tenant@tropro.demo',
  )
  expect(request.status).toBe(201)
  await expect(
    page.getByText('Internet riêng', { exact: true }).filter({ visible: true }),
  ).toBeVisible()
  const row = page.locator('tr,article').filter({ hasText: 'Internet riêng' })
  await row.getByRole('button', { name: 'Xem yêu cầu' }).click()
  await page.getByRole('button', { name: 'Chấp thuận', exact: true }).click()
  await confirm(page)
  const result = await api(
    page,
    `/api/tenant/tenancies/${id(5100)}/services`,
    'GET',
    undefined,
    'tenant@tropro.demo',
  )
  expect(result.body.data.find((s: { id: string }) => s.id === id(5602)).status).toBe('APPROVED')
})
test('segmented utility preview, draft edit, finalization and exact Tenant shares', async ({
  page,
}) => {
  await login(page, path('/manager/utility-charges/new', 12))
  await page.getByLabel('Phòng', { exact: true }).selectOption(id(102))
  await page.getByLabel('Dịch vụ', { exact: true }).selectOption(id(7620))
  await page.getByLabel('Kỳ tính phí (ngày đầu tháng)').fill(month())
  await page.getByLabel('Từ ngày', { exact: true }).fill(month())
  await page.getByLabel('Đến ngày', { exact: true }).fill(month(2))
  await page.getByLabel('Chỉ số cuối (bỏ trống nếu không đo)').fill('100')
  await page.getByLabel('Đơn giá (VND)', { exact: true }).fill('3500')
  const meters = await api(
    page,
    `/api/manager/branches/${id(12)}/meters?roomId=${id(102)}&size=100`,
  )
  await page
    .getByLabel('Công tơ (bỏ trống nếu không đo)')
    .selectOption(
      meters.body.data.content.find(
        (m: { serviceId: string; label: string }) =>
          m.serviceId === id(7620) && m.label.endsWith('Công tơ chính'),
      ).id,
    )
  await page.getByRole('button', { name: 'Kiểm tra & xem trước' }).click()
  await expect(page.getByRole('dialog')).toContainText('350.000 ₫')
  await page.getByRole('button', { name: 'Lưu khoản phí nháp' }).click()
  await expect(page.getByRole('heading', { name: 'Chi tiết khoản phí' })).toBeVisible()
  const chargeId = new URL(page.url()).pathname.split('/').at(-1)!
  await page.getByRole('link', { name: 'Sửa các đoạn nháp' }).click()
  await page.getByLabel('Chỉ số cuối (bỏ trống nếu không đo)').fill('101')
  await page.getByRole('button', { name: 'Kiểm tra & xem trước' }).click()
  await page.getByRole('button', { name: 'Lưu khoản phí nháp' }).click()
  await page.getByRole('button', { name: 'Chốt phí & phân bổ' }).click()
  await confirm(page)
  await expect(page.getByText('Đã chốt', { exact: true }).first()).toBeVisible()
  const first = await api(
      page,
      `/api/tenant/tenancies/${id(5101)}/utilities`,
      'GET',
      undefined,
      'tenant@tropro.demo',
    ),
    second = await api(
      page,
      `/api/tenant/tenancies/${id(5103)}/utilities`,
      'GET',
      undefined,
      'roommate@tropro.demo',
    )
  expect(
    first.body.data.find((c: { id: string }) => c.id === chargeId).myAmount +
      second.body.data.find((c: { id: string }) => c.id === chargeId).myAmount,
  ).toBe(353500)
})
test('invoice preview, draft edit, issue and correct Tenant access', async ({ page }) => {
  await login(page, path('/manager/invoices/new', 12))
  await page.getByLabel('Người chịu nghĩa vụ', { exact: true }).selectOption(id(5101))
  await page.getByLabel('Kỳ hóa đơn', { exact: true }).fill(month().slice(0, 7))
  await page.getByRole('button', { name: 'Xem trước hóa đơn' }).click()
  await page.getByRole('button', { name: 'Lưu hóa đơn nháp' }).click()
  await expect(page.getByRole('heading', { name: 'Chi tiết hóa đơn' })).toBeVisible()
  const invoiceId = new URL(page.url()).pathname.split('/').at(-1)!
  await page.getByRole('link', { name: 'Sửa nháp', exact: true }).click()
  await page.getByLabel('Hạn thanh toán', { exact: true }).fill(month(2))
  await page.getByRole('button', { name: 'Xem trước hóa đơn' }).click()
  await page.getByRole('button', { name: 'Lưu hóa đơn nháp' }).click()
  await page.getByRole('button', { name: 'Phát hành hóa đơn' }).click()
  await confirm(page)
  await expect(page.getByText('Đã phát hành', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sửa nháp', exact: true })).toHaveCount(0)
  expect(
    (
      await api(
        page,
        `/api/tenant/tenancies/${id(5101)}/invoices/${invoiceId}`,
        'GET',
        undefined,
        'tenant@tropro.demo',
      )
    ).body.data.documentStatus,
  ).toBe('ISSUED')
  expect(
    (
      await api(
        page,
        `/api/tenant/tenancies/${id(5103)}/invoices/${invoiceId}`,
        'GET',
        undefined,
        'roommate@tropro.demo',
      )
    ).status,
  ).toBe(404)
})
test('manual reconciliation verifies only the matched partial receipt', async ({ page }) => {
  await login(page, path(`/manager/payments/${id(7900)}`, 12))
  const before = (await api(page, `/api/manager/branches/${id(12)}/invoices/${id(5301)}`)).body.data
    .outstanding
  await page.getByRole('button', { name: 'Đối chiếu & xác minh' }).click()
  await page.getByLabel('Tham chiếu trên biên nhận').fill('TP-QR-DEMO-01')
  await page.getByLabel('Số tiền trên biên nhận (VND)').fill('50000')
  await page.getByLabel('Mã giao dịch nhà cung cấp', { exact: true }).fill('BANK-DEMO-0001')
  await confirm(page)
  await expect(page.getByText('Đã xác minh', { exact: true }).first()).toBeVisible()
  expect(
    (await api(page, `/api/manager/branches/${id(12)}/invoices/${id(5301)}`)).body.data.outstanding,
  ).toBe(before - 50000)
  await expect(page.getByRole('button', { name: 'Đối chiếu & xác minh' })).toHaveCount(0)
})
test('maintenance records, cost approval and Tenant timeline stay linked', async ({ page }) => {
  await login(page)
  const r = await api(
    page,
    `/api/tenant/tenancies/${id(5100)}/maintenance`,
    'POST',
    {
      assetId: id(6100),
      category: 'FURNITURE',
      title: 'Máy lạnh có tiếng ồn',
      description: 'Thiết bị phát tiếng ồn lớn khi hoạt động.',
      priority: 'NORMAL',
      attachments: [],
    },
    'tenant@tropro.demo',
  )
  expect(r.status).toBe(201)
  await page.goto(path(`/manager/maintenance/${r.body.data.id}`))
  await page.getByRole('button', { name: 'Tiếp nhận', exact: true }).click()
  await page.getByLabel('Người được phân công').fill('Kỹ thuật Minh')
  await confirm(page)
  await page.getByRole('button', { name: 'Bắt đầu xử lý', exact: true }).click()
  await confirm(page)
  await page.getByRole('button', { name: 'Thêm nhật ký', exact: true }).click()
  await page.getByLabel('Công việc đã thực hiện').fill('Thay linh kiện bị hỏng do sử dụng.')
  await page.getByLabel('Chi phí (VND)', { exact: true }).fill('200000')
  await page.getByLabel('Bên chịu chi phí').selectOption('TENANT')
  await page.getByRole('dialog').getByRole('button', { name: 'Lưu thông tin', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Duyệt trách nhiệm chi phí' }).click()
  await confirm(page)
  await page.getByRole('button', { name: 'Hoàn tất sửa chữa', exact: true }).click()
  await confirm(page)
  const detail = await api(
    page,
    `/api/tenant/tenancies/${id(5100)}/maintenance/${r.body.data.id}`,
    'GET',
    undefined,
    'tenant@tropro.demo',
  )
  expect(detail.body.data.status).toBe('COMPLETED')
  expect(detail.body.data.records.length).toBe(6)
})
test('private Zalo settings and shared notification references use the authorized branch', async ({
  page,
}) => {
  await login(page, path('/manager/settings/zalo'))
  await page.getByLabel('Liên kết nhóm Zalo', { exact: true }).fill('https://zalo.me/g/manager-qa')
  await page.getByRole('button', { name: 'Lưu thông tin', exact: true }).click()
  await expect(page.getByText('Đã lưu thông tin nhóm Zalo.')).toBeVisible()
  expect(
    (
      await api(
        page,
        `/api/tenant/tenancies/${id(5100)}/room`,
        'GET',
        undefined,
        'tenant@tropro.demo',
      )
    ).body.data.zaloUrl,
  ).toBe('https://zalo.me/g/manager-qa')
  expect(
    (
      await api(
        page,
        `/api/tenant/tenancies/${id(5101)}/room`,
        'GET',
        undefined,
        'tenant@tropro.demo',
      )
    ).body.data.zaloUrl,
  ).toBeNull()
  await page.goto('/notifications')
  const payment = page.locator('li').filter({ hasText: 'Thanh toán cần theo dõi' }).first()
  await payment.getByRole('button', { name: 'Xem chi tiết', exact: true }).click()
  await expect(page).toHaveURL(/\/manager\/payments\/.+branchId=/)
})
test('all Manager groups render on desktop/mobile without overflow or runtime errors', async ({
  page,
}, info) => {
  test.setTimeout(120000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await login(page)
  const pages = [
    ['dashboard', 'Một ngày vận hành rõ ràng.'],
    ['rooms', 'Phòng & chỗ ở'],
    ['rooms/new', 'Tạo phòng'],
    ['room-types', 'Loại phòng'],
    ['tenants', 'Người thuê'],
    ['appointments', 'Lịch xem phòng'],
    ['bookings', 'Giữ phòng'],
    ['contracts', 'Hợp đồng thuê'],
    ['contracts/new', 'Tạo hợp đồng thuê'],
    ['services', 'Danh mục dịch vụ'],
    ['room-services', 'Cấu hình dịch vụ phòng'],
    ['service-requests', 'Yêu cầu dịch vụ'],
    ['utility-charges', 'Điện nước & chi phí'],
    ['utility-charges/new', 'Tạo khoản phí theo đoạn'],
    ['cost-allocations', 'Xét phân bổ chi phí'],
    ['invoices', 'Hóa đơn'],
    ['invoices/new', 'Lập hóa đơn cá nhân'],
    ['payments', 'Thanh toán & đối soát'],
    ['debts', 'Công nợ cá nhân'],
    ['furnitures', 'Cơ sở vật chất'],
    ['maintenance', 'Sửa chữa & bảo trì'],
    ['reports', 'Báo cáo chi nhánh'],
    ['settings/zalo', 'Nhóm Zalo chi nhánh'],
  ]
  for (const [route, title] of pages) {
    await page.goto(path(`/manager/${route}`))
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await expect(page.getByLabel('Đang tải', { exact: true })).toHaveCount(0)
    expect(
      await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
        forms: [...document.querySelectorAll('form')].every(
          (f) => f.scrollWidth <= f.clientWidth + 1,
        ),
      })),
    ).toMatchObject({ forms: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      info.project.use.viewport!.width,
    )
    if (['dashboard', 'rooms', 'utility-charges/new', 'invoices', 'maintenance'].includes(route))
      await page.screenshot({
        path: `test-results/manager-${info.project.name}-${route.replaceAll('/', '-')}.png`,
        fullPage: true,
      })
  }
  if (info.project.name === 'mobile') {
    await page
      .getByRole('combobox', { name: 'Điều hướng quản lý', exact: true })
      .selectOption('payments')
    await expect(page.getByRole('heading', { name: 'Thanh toán & đối soát' })).toBeVisible()
  }
  expect(errors).toEqual([])
})
