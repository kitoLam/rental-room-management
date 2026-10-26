import { test, expect, type Page } from '@playwright/test'
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const note = 'Đã đối chiếu đầy đủ hồ sơ và chứng cứ.'
const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jvZkAAAAASUVORK5CYII=',
  'base64',
)
const month = () => new Date().toISOString().slice(0, 7)
async function login(
  page: Page,
  destination = '/owner/dashboard',
  email = 'owner@tropro.demo',
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
async function api(page: Page, path: string, method = 'GET', body?: unknown, email?: string) {
  return page.evaluate(
    async ({ path, method, body, email }) => {
      const state = JSON.parse(sessionStorage.getItem('tropro-demo-v2')!),
        original = state.users.find((u: { id: string }) => u.id === state.refreshUserId),
        actor = email ? state.users.find((u: { email: string }) => u.email === email) : original
      let token = Object.entries(state.sessions).find(([, uid]) => uid === actor?.id)?.[0]
      if (!token) {
        const r = await fetch('/__mock/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: 'TroPro@123' }),
        })
        token = (await r.json()).data.accessToken
        if (original?.email !== email)
          await fetch('/__mock/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: original.email, password: 'TroPro@123' }),
          })
      }
      const r = await fetch(`/__mock${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      return { status: r.status, body: await r.json() }
    },
    { path, method, body, email },
  )
}
async function confirm(page: Page, remaining = 0) {
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Lý do / ghi chú').fill(note)
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(dialog).toHaveCount(remaining)
}
test('Owner defaults to all owned Branches, scopes queries and rejects foreign deep links', async ({
  page,
}) => {
  await login(page)
  await expect(page.getByLabel('PHẠM VI CHI NHÁNH')).toHaveValue('')
  expect(await page.getByLabel('PHẠM VI CHI NHÁNH').locator('option').count()).toBe(3)
  await page.getByLabel('PHẠM VI CHI NHÁNH').selectOption(id(12))
  await expect(page).toHaveURL(`/owner/dashboard?branchId=${id(12)}`)
  const summary = await api(page, `/api/owner/summary?branchId=${id(12)}&month=${month()}`)
  expect(summary.body.data.rows.map((r: { id: string }) => r.id)).toEqual([id(12)])
  expect((await api(page, `/api/owner/branches/${id(11)}`)).status).toBe(403)
  await page.goto(`/owner/finance?branchId=${id(11)}`)
  await expect(page.getByText('Bạn không có quyền với chi nhánh trong liên kết này.')).toBeVisible()
  await page.getByRole('button', { name: 'Về tất cả chi nhánh' }).click()
  await expect(page.getByRole('heading', { name: 'Tài chính', exact: true })).toBeVisible()
})
test('User onboarding sends metadata and cannot self approve or enter privileged workspace', async ({
  page,
}) => {
  await login(page, '/owner/onboarding', 'an@tropro.demo')
  await page
    .getByLabel('Tài liệu xác minh', { exact: true })
    .setInputFiles({ name: 'ho-so-demo.png', mimeType: 'image/png', buffer: image })
  await page.getByLabel('Số điện thoại', { exact: true }).fill('0901234567')
  await page.getByRole('button', { name: 'Kiểm tra hồ sơ' }).click()
  await page.getByRole('button', { name: 'Gửi xác minh', exact: true }).click()
  await expect(page.getByText('Đã gửi hồ sơ.', { exact: false })).toBeVisible()
  await page.getByRole('link', { name: 'Theo dõi xét duyệt' }).click()
  await expect(page.getByRole('heading', { name: 'Đang chờ xét duyệt' })).toBeVisible()
  expect((await api(page, '/api/owner/branches')).status).toBe(403)
  expect(
    (await api(page, '/api/owner/verification/approve', 'POST', { status: 'APPROVED' })).status,
  ).toBe(403)
  const stored = await page.evaluate(() => sessionStorage.getItem('tropro-manager-v1')!)
  expect(stored).not.toContain('data:image/png;base64')
  await page.goto('/owner/dashboard')
  await expect(page.getByText('Cần hoàn tất xác minh và được cấp quyền chủ trọ.')).toBeVisible()
})
test('create Draft, publish effective policy, assign Manager and activate through forms', async ({
  page,
}) => {
  test.setTimeout(90000)
  await login(page, '/owner/branches/new')
  await page.getByLabel('Mã chi nhánh', { exact: true }).fill('TP-E2E')
  await page.getByLabel('Tên chi nhánh', { exact: true }).fill('TroPro Linh Trung mới')
  await page.getByLabel('Địa chỉ', { exact: true }).fill('15 Đường số 2, Linh Trung')
  await page.getByRole('button', { name: 'Kiểm tra thay đổi' }).click()
  await page.getByRole('button', { name: 'Xác nhận lưu' }).click()
  await expect(page).toHaveURL(/\/owner\/branches\/[0-9a-f-]{36}$/)
  const branch = page.url().split('/').at(-1)!
  await expect(
    page.getByRole('heading', { name: 'TroPro Linh Trung mới', exact: true }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Chính sách và lịch sử phiên bản' }).click()
  await page.getByRole('button', { name: 'Tạo phiên bản', exact: true }).click()
  await page
    .getByLabel('Hiệu lực từ (ISO, gồm múi giờ)', { exact: true })
    .fill(new Date(Date.now() - 1000).toISOString())
  await page
    .getByLabel('Điều khoản hủy', { exact: true })
    .fill('Liên hệ chi nhánh để được xem xét hủy giữ phòng.')
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click()
  await page.getByRole('button', { name: 'Lưu phiên bản', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Phiên bản 1', exact: true })).toBeVisible()
  await page.goto(`/owner/branches/${branch}/edit`)
  await page.getByLabel('Quản lý chính', { exact: true }).selectOption(id(7000))
  await page.getByLabel('Trạng thái', { exact: true }).selectOption('ACTIVE')
  await page.getByRole('button', { name: 'Kiểm tra thay đổi' }).click()
  await page.getByRole('button', { name: 'Xác nhận lưu' }).click()
  await expect(page).toHaveURL(`/owner/branches/${branch}`)
  expect((await api(page, `/api/owner/branches/${branch}`)).body.data.status).toBe('ACTIVE')
  expect(
    (
      await api(page, '/api/manager/branches', 'GET', undefined, 'manager@tropro.demo')
    ).body.data.some((b: { id: string }) => b.id === branch),
  ).toBe(true)
})
test('Owner invitation requires User acceptance; reassignment revokes old Manager immediately', async ({
  page,
}) => {
  test.setTimeout(90000)
  await login(page, '/owner/managers/invite')
  await page.getByLabel('Họ tên người nhận').fill('Nguyễn Minh An')
  await page.getByLabel('Email người nhận').fill('an@tropro.demo')
  await page.getByRole('button', { name: 'Gửi lời mời', exact: true }).click()
  await expect(page).toHaveURL('/owner/managers')
  expect(
    (await api(page, `/api/manager/branches/${id(10)}/rooms`, 'GET', undefined, 'an@tropro.demo'))
      .status,
  ).toBe(403)
  await login(page, '/manager-invitations', 'an@tropro.demo', true)
  await page.getByRole('button', { name: 'Xác nhận tham gia' }).click()
  await expect(
    page.getByText('Đã xác nhận bằng tài khoản của bạn.', { exact: false }),
  ).toBeVisible()
  await login(page, `/owner/manager-assignments?branchId=${id(10)}`, 'owner@tropro.demo', true)
  await page.getByLabel('Quản lý chính', { exact: true }).selectOption(id(1))
  await page.getByRole('button', { name: 'Kiểm tra phân công' }).click()
  await confirm(page)
  expect(
    (
      await api(
        page,
        `/api/manager/branches/${id(10)}/rooms`,
        'GET',
        undefined,
        'manager@tropro.demo',
      )
    ).status,
  ).toBe(403)
  expect(
    (await api(page, `/api/manager/branches/${id(10)}/rooms`, 'GET', undefined, 'an@tropro.demo'))
      .status,
  ).toBe(200)
})
test('Owner operates shared Manager modules with explicit owned scope and path back', async ({
  page,
}) => {
  await login(page, `/owner/branches/${id(10)}`)
  await page
    .getByRole('link', { name: 'Vận hành chi nhánh', exact: true })
    .filter({ visible: true })
    .click()
  await expect(page).toHaveURL(`/manager/dashboard?branchId=${id(10)}&workspace=owner`)
  await expect(page.getByLabel('CHI NHÁNH SỞ HỮU')).toHaveValue(id(10))
  await expect(page.getByRole('link', { name: '← Không gian chủ trọ' })).toBeVisible()
  await page.goto(`/manager/rooms?branchId=${id(10)}&workspace=owner`)
  await expect(page.getByRole('heading', { name: 'Phòng & chỗ ở', exact: true })).toBeVisible()
  await page.goto(`/manager/rooms?branchId=${id(11)}&workspace=owner`)
  await expect(
    page.getByText('Bạn không còn quyền quản lý chi nhánh trong liên kết này.', { exact: false }),
  ).toBeVisible()
})
test('Manager adjustment request reaches Owner queue and decision preserves issued Invoice', async ({
  page,
}) => {
  test.setTimeout(90000)
  await login(page, `/manager/invoices/${id(5300)}?branchId=${id(10)}`, 'manager@tropro.demo')
  const before = (await api(page, `/api/manager/branches/${id(10)}/invoices/${id(5300)}`)).body.data
  await page.getByRole('button', { name: 'Yêu cầu điều chỉnh', exact: true }).click()
  await page.getByLabel('Tổng nghĩa vụ đề xuất (VND)').fill(String(before.totalAmount - 50000))
  await page.getByLabel('Lý do điều chỉnh').fill(note)
  await page.getByRole('button', { name: 'Gửi yêu cầu duyệt' }).click()
  await expect(page.getByText('Đã gửi yêu cầu.', { exact: false })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng', exact: true }).click()
  await login(page, '/owner/approvals/invoices', 'owner@tropro.demo', true)
  await page
    .getByRole('button', { name: /Hóa đơn kỳ/ })
    .filter({ visible: true })
    .click()
  await page.getByRole('button', { name: 'Chấp thuận đề xuất' }).click()
  await confirm(page, 1)
  await expect(page.getByText('Đã ghi nhận quyết định.')).toBeVisible()
  const after = (await api(page, `/api/manager/branches/${id(10)}/invoices/${id(5300)}`)).body.data
  expect(after.totalAmount).toBe(before.totalAmount)
  expect(after.items).toEqual(before.items)
  const approvals = (await api(page, '/api/owner/approvals')).body.data.content
  expect(approvals[0].status).toBe('APPROVED')
  expect(approvals[0].executionStatus).toBe('NOT_APPLIED')
})
test('Owner QR reaches Tenant, manual evidence is reviewed by Manager and actual receipts update', async ({
  page,
}) => {
  test.setTimeout(120000)
  await login(page, `/owner/branches/${id(10)}/payments/settings`)
  await page
    .getByLabel('Tải ảnh minh chứng')
    .setInputFiles({ name: 'qr-demo.png', mimeType: 'image/png', buffer: image })
  await page.getByRole('button', { name: 'Lưu QR', exact: true }).click()
  await expect(page.getByText('Đã lưu QR chi nhánh.')).toBeVisible()
  const before = (await api(page, `/api/owner/summary?month=${month()}`)).body.data.totals.receipts
  await login(
    page,
    `/tenant/invoices/${id(5300)}?tenancyId=${id(5100)}`,
    'tenant@tropro.demo',
    true,
  )
  await expect(page.getByRole('img', { name: 'QR thủ công của chi nhánh' })).toBeVisible()
  await page.getByRole('button', { name: 'Gửi chứng cứ chuyển khoản', exact: true }).click()
  await page.getByLabel('Số tiền đã chuyển (VND)').fill('10000')
  await page.getByLabel('Mã biên nhận giao dịch').fill('OWNER-E2E-BANK-100')
  await page
    .getByLabel('Tải ảnh minh chứng')
    .setInputFiles({ name: 'receipt-demo.png', mimeType: 'image/png', buffer: image })
  await page.getByRole('button', { name: 'Gửi để đối soát' }).click()
  await expect(page.getByText('Đã ghi nhận giao dịch chờ đối soát.')).toBeVisible()
  const payments = (await api(page, `/api/tenant/tenancies/${id(5100)}/payments`)).body.data,
    payment = payments.find((p: { method: string }) => p.method === 'TRANSFER')
  expect(payment.status).toBe('PENDING')
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng', exact: true }).click()
  await login(
    page,
    `/manager/payments/${payment.id}?branchId=${id(10)}`,
    'manager@tropro.demo',
    true,
  )
  await page.getByRole('button', { name: 'Đối chiếu & xác minh' }).click()
  await page.getByLabel('Tham chiếu trên biên nhận').fill(payment.reference)
  await page.getByLabel('Số tiền trên biên nhận (VND)').fill('10000')
  await page.getByRole('dialog').getByLabel('Mã giao dịch nhà cung cấp').fill('OWNER-E2E-BANK-100')
  await confirm(page)
  await login(page, '/owner/finance', 'owner@tropro.demo', true)
  expect((await api(page, `/api/owner/summary?month=${month()}`)).body.data.totals.receipts).toBe(
    before + 10000,
  )
})
test('Owner B and ordinary USER cannot read Owner A resources', async ({ page }) => {
  await login(page, '/owner/dashboard', 'owner-other@tropro.demo')
  expect(
    (await api(page, '/api/owner/branches')).body.data.content.map((b: { id: string }) => b.id),
  ).toEqual([id(11)])
  expect((await api(page, `/api/owner/payments?branchId=${id(10)}`)).status).toBe(403)
  expect((await api(page, `/api/owner/managers/${id(7000)}`)).status).toBe(404)
  await login(page, '/owner/dashboard', 'an@tropro.demo', true)
  await expect(page.getByText('Cần hoàn tất xác minh và được cấp quyền chủ trọ.')).toBeVisible()
})
test('policy version mutation preserves existing Booking and reflects applicable public policy', async ({
  page,
}) => {
  await login(page, `/owner/branches/${id(10)}/policies`)
  const before = (await api(page, '/api/manager/branches/' + id(10) + '/bookings')).body.data
    .content
  await page.getByRole('button', { name: 'Tạo phiên bản', exact: true }).click()
  await page
    .getByLabel('Hiệu lực từ (ISO, gồm múi giờ)')
    .fill(new Date(Date.now() - 1000).toISOString())
  await page.getByLabel('Tiền giữ phòng (VND)').fill('777777')
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click()
  await page.getByRole('button', { name: 'Lưu phiên bản', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(
    (await api(page, `/api/v1/public/branches/${id(10)}/policy`)).body.data.bookingHoldAmount,
  ).toBe(777777)
  expect(
    (await api(page, '/api/manager/branches/' + id(10) + '/bookings')).body.data.content.map(
      (b: { policySnapshot: unknown }) => b.policySnapshot,
    ),
  ).toEqual(before.map((b: { policySnapshot: unknown }) => b.policySnapshot))
})
test('Owner error, empty and session-switch states do not expose stale private data', async ({
  page,
}) => {
  await login(page, '/owner/dashboard')
  await page.goto('/owner/payments?demo=error')
  await expect(page.getByRole('alert')).toContainText('Máy chủ đang gặp sự cố.')
  await page.goto('/owner/approvals/invoices?demo=empty')
  await expect(page.getByText('Chưa có yêu cầu điều chỉnh phù hợp.')).toBeVisible()
  await login(page, '/owner/dashboard', 'owner-other@tropro.demo', true)
  const summary = (await api(page, `/api/owner/summary?month=${month()}`)).body.data
  expect(summary.rows.every((r: { id: string }) => r.id === id(11))).toBe(true)
})
test('all Owner screens are responsive, navigable and free of page errors', async ({
  page,
}, info) => {
  test.setTimeout(120000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await login(page)
  const routes = [
    'dashboard',
    'branches',
    'branches/new',
    `branches/${id(10)}`,
    `branches/${id(10)}/edit`,
    `branches/${id(10)}/policies`,
    `branches/${id(10)}/payments/settings`,
    'managers',
    'managers/invite',
    `managers/${id(7000)}`,
    'manager-assignments',
    'finance',
    'approvals/invoices',
    'payments',
    'reports',
    'activity',
    'verification',
    'onboarding',
  ]
  for (const route of routes) {
    await page.goto('/owner/' + route)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByLabel('Đang tải', { exact: true })).toHaveCount(0)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      route,
    ).toBe(true)
    if (
      (route === 'dashboard' && info.project.name === 'desktop') ||
      (route === 'finance' && info.project.name === 'mobile')
    ) {
      await page.screenshot({
        path: `../docs/frontend/owner-screenshots/${route}-${info.project.name}.png`,
        fullPage: true,
      })
      if (info.project.name === 'mobile')
        await page.screenshot({
          path: '../docs/frontend/owner-screenshots/finance-mobile-viewport.png',
          fullPage: false,
        })
    }
  }
  expect(errors).toEqual([])
})
