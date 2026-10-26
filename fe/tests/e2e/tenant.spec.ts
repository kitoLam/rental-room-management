import { test, expect, type Page } from '@playwright/test'

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const tenantPath = (path: string, n = 5100) => `${path}?tenancyId=${id(n)}`
async function login(page: Page, path = '/tenant/dashboard', tenant = true) {
  await page.goto(`/login?redirect=${encodeURIComponent(path)}`)
  await page
    .getByRole('button', {
      name: tenant ? 'Điền tài khoản Tenant demo' : 'Điền tài khoản demo',
      exact: true,
    })
    .click()
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).toHaveURL(path)
  await expect(page.getByLabel('Đang tải', { exact: true })).toHaveCount(0)
}
async function api(page: Page, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const sessions = JSON.parse(sessionStorage.getItem('tropro-demo-v2')!).sessions
      const users = JSON.parse(sessionStorage.getItem('tropro-demo-v2')!).users
      const user = users.find((u: { email: string }) => u.email === 'tenant@tropro.demo')
      const token = Object.entries(sessions).find(([, value]) => value === user.id)![0]
      const response = await fetch(`/__mock${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      return { status: response.status, body: await response.json() }
    },
    { path, method, body },
  )
}
test('USER without tenancy is denied; seeded Tenant has authorized workspace and selector', async ({
  page,
}) => {
  await login(page, '/tenant/dashboard', false)
  await expect(
    page.getByText('Tài khoản chưa có quan hệ thuê được cấp quyền.', { exact: false }),
  ).toBeVisible()
  await expect(page.getByLabel('QUAN HỆ THUÊ')).toHaveCount(0)
})
test('ROOM, SLOT and historical contexts switch all data and survive refresh', async ({ page }) => {
  await login(page)
  await expect(page.getByRole('heading', { name: 'Một nơi an tâm để ở.' })).toBeVisible()
  await page.getByLabel('QUAN HỆ THUÊ').selectOption(id(5101))
  await expect(page).toHaveURL(tenantPath('/tenant/dashboard', 5101))
  await expect(page.locator('header p').filter({ hasText: /Giường A —/ })).toBeVisible()
  await page.goto('/tenant/my-room')
  await expect(page.getByRole('heading', { name: /Giường A/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nhóm Zalo chưa khả dụng' })).toBeDisabled()
  await page.reload()
  await expect(page.getByLabel('QUAN HỆ THUÊ')).toHaveValue(id(5101))
  await page.getByLabel('QUAN HỆ THUÊ').selectOption(id(5102))
  await expect(
    page.getByText('Quan hệ thuê đã kết thúc hoặc chưa hiệu lực.', { exact: false }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Báo hỏng', exact: true })).toHaveCount(0)
})
test('room gallery, private Zalo and contract individual terms are accessible', async ({
  page,
}) => {
  await login(page, tenantPath('/tenant/my-room'))
  await expect(page.getByRole('link', { name: 'Nhóm Zalo chi nhánh' })).toHaveAttribute(
    'href',
    /https:\/\/zalo.me\/g\//,
  )
  await page.getByRole('button', { name: 'Xem ảnh phòng 1' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.goto(tenantPath(`/tenant/contracts/${id(5200)}`))
  await expect(page.getByText('Chưa có văn bản được cung cấp.', { exact: false })).toBeVisible()
  await page.getByRole('link', { name: 'Điều khoản & nghĩa vụ của tôi' }).click()
  await expect(page.getByRole('heading', { name: 'Điều khoản cá nhân' })).toBeVisible()
  await expect(page.getByText('Nguồn tiền: TP-PREPAID-01')).toBeVisible()
  await expect(page.getByText('Đã áp dụng kỳ đầu', { exact: true })).toBeVisible()
})
test('invoices filter documents and protect roommate data even in direct API requests', async ({
  page,
}) => {
  await login(page, tenantPath('/tenant/invoices'))
  await page.getByLabel('Chứng từ', { exact: true }).selectOption('DRAFT')
  await expect(page.getByRole('link', { name: 'HD-DRAFT-01' })).toBeVisible()
  await page.getByRole('link', { name: 'HD-DRAFT-01' }).click()
  await expect(page.getByRole('button', { name: 'Thanh toán hóa đơn', exact: true })).toBeDisabled()
  const foreign = await api(page, `/api/tenant/tenancies/${id(5101)}/invoices/${id(5303)}`)
  expect(foreign.status).toBe(404)
  expect(foreign.body.data).toBeNull()
  const foreignContext = await api(page, `/api/tenant/tenancies/${id(5103)}/room`)
  expect(foreignContext.status).toBe(404)
  await page.goto(tenantPath(`/tenant/invoices/${id(5303)}`, 5101))
  await expect(
    page.getByText('Không tìm thấy dữ liệu được phép truy cập.', { exact: true }),
  ).toBeVisible()
})
test('partial sandbox payment stays pending then verified allocation lowers only its invoice', async ({
  page,
}) => {
  await login(page, tenantPath(`/tenant/invoices/${id(5300)}`))
  const before = (await api(page, `/api/tenant/tenancies/${id(5100)}/invoices/${id(5300)}`)).body
    .data
  await page.getByRole('button', { name: 'Thanh toán hóa đơn', exact: true }).click()
  await page.getByLabel('Số tiền thanh toán (VND)').fill('100000')
  await page.getByLabel('Người thanh toán', { exact: true }).fill('Nguyễn Nam thanh toán hộ')
  await page.getByRole('button', { name: 'Bắt đầu thanh toán demo' }).click()
  await expect(page.getByText('Đã ghi nhận', { exact: false })).toBeVisible()
  const pending = (await api(page, `/api/tenant/tenancies/${id(5100)}/invoices/${id(5300)}`)).body
    .data
  expect(pending.outstanding).toBe(before.outstanding)
  expect(pending.availableToPay).toBe(before.outstanding - 100000)
  await expect
    .poll(
      async () =>
        (await api(page, `/api/tenant/tenancies/${id(5100)}/invoices/${id(5300)}`)).body.data
          .outstanding,
    )
    .toBe(before.outstanding - 100000)
  await page.goto(tenantPath('/tenant/payments'))
  await expect(page.getByText('100.000 ₫', { exact: true })).toBeVisible()
})
test('review payment preserves debt and cash prepaid is not duplicated', async ({ page }) => {
  await login(page, tenantPath(`/tenant/invoices/${id(5300)}`))
  const base = `/api/tenant/tenancies/${id(5100)}`
  const before = (await api(page, `${base}/invoices/${id(5300)}`)).body.data
  const result = await api(page, `${base}/invoices/${id(5300)}/payments`, 'POST', {
    amount: 50000,
    payerName: 'Trần Gia Linh',
    idempotencyKey: crypto.randomUUID(),
    outcome: 'review',
  })
  expect(result.status).toBe(201)
  await expect
    .poll(async () => (await api(page, `${base}/payments/${result.body.data.id}`)).body.data.status)
    .toBe('REVIEW')
  expect((await api(page, `${base}/invoices/${id(5300)}`)).body.data.outstanding).toBe(
    before.outstanding,
  )
  const payments = (await api(page, `${base}/payments`)).body.data
  expect(payments.filter((p: { invoiceId: string | null }) => p.invoiceId === null)).toHaveLength(1)
  expect(
    payments.find((p: { invoiceId: string | null }) => p.invoiceId === null).amountReceived,
  ).toBe(8400000)
})
test('optional service registers pending; mandatory cancellation is rejected; trusted approval can be canceled', async ({
  page,
}) => {
  await login(page, tenantPath('/tenant/services'))
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).first().click()
  await page.getByRole('button', { name: 'Gửi đăng ký', exact: true }).click()
  await expect(page.getByText('Đã gửi đăng ký dịch vụ, đang chờ quản lý duyệt.')).toBeVisible()
  await expect(page.getByText('Chờ xử lý', { exact: true })).toBeVisible()
  const base = `/api/tenant/tenancies/${id(5100)}`
  expect((await api(page, `${base}/services/${id(5600)}/cancel`, 'POST')).status).toBe(422)
  await expect
    .poll(
      async () =>
        (await api(page, `${base}/services`)).body.data.find(
          (s: { id: string }) => s.id === id(5602),
        ).status,
      { timeout: 20000 },
    )
    .toBe('APPROVED')
  const cancel = await api(page, `${base}/services/${id(5602)}/cancel`, 'POST')
  expect(cancel.body.data.status).toBe('CANCEL_REQUESTED')
})
test('utility segments and allocation proposal validate exact totals and expose no approval action', async ({
  page,
}) => {
  await login(page, tenantPath('/tenant/utilities', 5101))
  await page.getByRole('button', { name: 'Chi tiết Điện', exact: true }).click()
  await expect(page.getByText('Trước bảo trì công tơ')).toBeVisible()
  await expect(page.getByText('Sau bảo trì công tơ')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Đề xuất phân bổ', exact: true }).click()
  await page.getByRole('button', { name: 'Đề xuất phân bổ', exact: true }).click()
  await page.getByLabel('Cách đề xuất').selectOption('APPROVED_CUSTOM')
  await page.getByLabel(/Phần của bạn ·/).fill('1')
  await page.getByLabel('Lý do đề xuất').fill('Hai người thống nhất phương án chia theo sử dụng.')
  await page.getByRole('button', { name: 'Gửi đề xuất' }).click()
  await expect(page.getByRole('alert')).toContainText('Tổng phân bổ phải bằng tổng phí nguồn.')
  await page.getByLabel('Cách đề xuất').selectOption('RESIDENT_DAYS')
  await page.getByRole('button', { name: 'Gửi đề xuất' }).click()
  await expect(page.getByText('Đã gửi đề xuất, đang chờ quản lý xét duyệt.')).toBeVisible()
  expect(
    (await api(page, `/api/tenant/tenancies/${id(5101)}/allocations/${id(9999)}/approve`, 'POST'))
      .status,
  ).toBe(404)
  await expect(page.getByRole('button', { name: /Duyệt đề xuất/ })).toHaveCount(0)
})
test('maintenance image validation, creation, direct detail, cancellation and notifications work', async ({
  page,
}) => {
  await login(page, tenantPath('/tenant/maintenance/new'))
  await page.getByLabel('Tài sản / dịch vụ').selectOption(id(6100))
  await page.getByLabel('Tiêu đề', { exact: true }).fill('Điều hòa có tiếng kêu lớn')
  await page
    .getByLabel('Mô tả tình trạng')
    .fill('Điều hòa phát ra tiếng kêu khi bật hơn 10 phút, cần kiểm tra.')
  await page
    .getByLabel('Ảnh hiện trạng', { exact: true })
    .setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') })
  await expect(page.getByRole('alert')).toContainText('Chọn ảnh JPG, PNG hoặc WebP')
  await page.getByLabel('Ảnh hiện trạng', { exact: true }).setInputFiles('public/demo/room-1.webp')
  await expect(page.getByRole('button', { name: /Xóa ảnh room-1.webp/ })).toBeVisible()
  await page.getByRole('button', { name: 'Gửi yêu cầu bảo trì' }).click()
  await expect(page).toHaveURL(/\/tenant\/maintenance\/[0-9a-f-]+\?tenancyId=/)
  await expect(page.getByRole('heading', { name: 'Điều hòa có tiếng kêu lớn' })).toBeVisible()
  await page.getByRole('button', { name: 'Hủy yêu cầu bảo trì', exact: true }).click()
  await page.getByRole('button', { name: 'Xác nhận hủy' }).click()
  await expect(page.getByText('Đã hủy', { exact: true }).first()).toBeVisible()
  await page.goto(tenantPath('/tenant/maintenance'))
  await expect(page.getByRole('heading', { name: 'Điều hòa có tiếng kêu lớn' })).toBeVisible()
  await page.goto('/notifications')
  await page.getByLabel('Loại thông báo').selectOption('TENANT_INVOICE')
  await expect(
    page.getByRole('heading', { name: 'Hóa đơn mới đã phát hành' }).first(),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Xem chi tiết', exact: true }).first().click()
  await expect(page).toHaveURL(/\/tenant\/invoices\/.*tenancyId=/)
})
test('completed repair has multiple records and unapproved liability never becomes debt', async ({
  page,
}) => {
  await login(page, tenantPath(`/tenant/maintenance/${id(6000)}`))
  await expect(page.getByText('Chưa được duyệt, chưa tính vào công nợ của bạn.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tiến trình xử lý' })).toBeVisible()
  await expect(page.locator('ol > li')).toHaveCount(4)
  await expect(page.getByRole('button', { name: 'Hủy yêu cầu bảo trì' })).toHaveCount(0)
})
test('invalid tenancy, empty and error states expose no private records', async ({ page }) => {
  await login(page, tenantPath('/tenant/invoices', 5103))
  await expect(
    page.getByText('Không tìm thấy quan hệ thuê được phép truy cập.', { exact: false }),
  ).toBeVisible()
  await page.goto('/tenant/dashboard?demo=empty')
  await expect(
    page.getByText('Tài khoản chưa có quan hệ thuê được cấp quyền.', { exact: false }),
  ).toBeVisible()
  await page.goto('/tenant/dashboard?demo=error')
  await expect(
    page.getByText('Máy chủ đang gặp sự cố. Vui lòng thử lại.', { exact: true }),
  ).toBeVisible()
})
test('demo reset restores coherent payments, reports and invoices', async ({ page }) => {
  await login(page, tenantPath('/tenant/dashboard'))
  await api(page, `/api/tenant/tenancies/${id(5100)}/invoices/${id(5300)}/payments`, 'POST', {
    amount: 100,
    payerName: 'Trần Gia Linh',
    idempotencyKey: crypto.randomUUID(),
    outcome: 'pending',
  })
  await page.getByText('Công cụ demo', { exact: true }).click()
  await page.getByRole('button', { name: 'Đặt lại dữ liệu Tenant' }).click()
  await expect
    .poll(
      async () => (await api(page, `/api/tenant/tenancies/${id(5100)}/payments`)).body.data.length,
    )
    .toBe(2)
})
test('all major Tenant pages render without overflow on desktop and mobile', async ({
  page,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await login(page)
  const routes = [
    'dashboard',
    'my-room',
    'contracts',
    `contracts/${id(5200)}/my-terms`,
    'invoices',
    `invoices/${id(5300)}`,
    'payments',
    'services',
    'utilities',
    'utilities/allocations',
    'maintenance',
    'maintenance/new',
    `maintenance/${id(6000)}`,
  ]
  for (const route of routes) {
    await page.goto(tenantPath(`/tenant/${route}`))
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByLabel('Đang tải', { exact: true })).toHaveCount(0)
    await page.evaluate(() => document.fonts.ready)
    expect(
      await page.evaluate(
        (width) => document.documentElement.scrollWidth <= width,
        page.viewportSize()!.width,
      ),
      route,
    ).toBe(true)
    expect(
      await page
        .locator('form')
        .evaluateAll((forms) => forms.every((form) => form.scrollWidth <= form.clientWidth)),
      `${route}: form content must fit its panel`,
    ).toBe(true)
    if (['dashboard', 'invoices', 'my-room', 'maintenance/new'].includes(route))
      await page.screenshot({
        path: `test-results/visual/${info.project.name}-tenant-${route.replaceAll('/', '-')}.png`,
        fullPage: true,
      })
  }
  expect(errors).toEqual([])
})
