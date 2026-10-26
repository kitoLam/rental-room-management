import { test, expect, type Page } from '@playwright/test'
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const note = 'Đã đối chiếu đầy đủ thông tin và tài liệu mẫu.'
const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jvZkAAAAASUVORK5CYII=',
  'base64',
)
async function login(
  page: Page,
  destination = '/admin/dashboard',
  email = 'admin@tropro.demo',
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
        const response = await fetch('/__mock/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: 'TroPro@123' }),
        })
        token = (await response.json()).data.accessToken
        if (original?.email !== email)
          await fetch('/__mock/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: original.email, password: 'TroPro@123' }),
          })
      }
      const response = await fetch(`/__mock${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      return { status: response.status, body: await response.json() }
    },
    { path, method, body, email },
  )
}
async function filters(page: Page, work: () => Promise<void>) {
  const trigger = page.getByRole('button', { name: 'Bộ lọc', exact: true })
  if (await trigger.isVisible()) {
    await trigger.click()
    await work()
    await page.getByRole('button', { name: 'Xem kết quả', exact: true }).click()
  } else await work()
}
async function confirmReview(page: Page) {
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Lý do / ghi chú').fill(note)
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(dialog).toHaveCount(0)
}
test('Admin routes require authentication and deny all other core roles', async ({ page }) => {
  test.setTimeout(90000)
  await page.goto('/admin/users')
  await expect(page).toHaveURL(/\/login\?redirect=/)
  for (const email of [
    'an@tropro.demo',
    'tenant@tropro.demo',
    'manager@tropro.demo',
    'owner@tropro.demo',
  ]) {
    await login(page, '/admin/dashboard', email, email !== 'an@tropro.demo')
    await expect(
      page.getByText('Bạn không có quyền quản trị hệ thống.', { exact: false }),
    ).toBeVisible()
    expect((await api(page, '/api/users')).status).toBe(403)
  }
  await login(page, '/admin/dashboard', 'admin@tropro.demo', true)
  await page.getByLabel('KHÔNG GIAN LÀM VIỆC').selectOption('/user/dashboard')
  await expect(page).toHaveURL('/user/dashboard')
  await page.goto('/admin/users')
  await expect(page.getByRole('heading', { name: 'Người dùng', exact: true })).toBeVisible()
})
test('users pagination, global mock filters and mobile filter drawer work', async ({ page }) => {
  await login(page, '/admin/users')
  const all = (await api(page, '/api/users?size=100')).body.data
  expect(all.totalElements).toBeGreaterThan(8)
  await page.getByRole('button', { name: 'Trang sau' }).click()
  await expect(page).toHaveURL(/page=2/)
  await filters(page, async () => {
    await page.getByRole('combobox', { name: 'Số dòng mỗi trang' }).selectOption('20')
    await page.getByRole('combobox', { name: 'Lọc vai trò' }).selectOption('ADMIN')
  })
  await expect(page).toHaveURL(/role=ADMIN/)
  await expect(
    page.getByRole('link', { name: 'Nguyễn Thảo Vy', exact: true }).filter({ visible: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Trần Đức Khang', exact: true }).filter({ visible: true }),
  ).toBeVisible()
  await page.getByRole('textbox', { name: 'Tìm kiếm', exact: true }).fill('Thảo Vy')
  await expect(
    page.getByRole('link', { name: 'Trần Đức Khang', exact: true }).filter({ visible: true }),
  ).toHaveCount(0)
})
test('create phone-only INVITED account validates identity and exposes no password or hard delete', async ({
  page,
}) => {
  await login(page, '/admin/users/new')
  await page.getByRole('button', { name: 'Tạo tài khoản được mời' }).click()
  await expect(page.getByRole('alert').first()).toBeVisible()
  await page.getByLabel('Họ và tên', { exact: true }).fill('Nguyễn Thanh Trúc')
  await page.getByLabel('Điện thoại quốc tế').fill('+84912345000')
  await page.getByRole('button', { name: 'Tạo tài khoản được mời' }).click()
  await expect(page).toHaveURL(/\/admin\/users\/[0-9a-f-]{36}$/)
  await expect(page.getByText('Đã mời', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ngừng kích hoạt', exact: true })).toBeDisabled()
  expect(
    (
      await api(page, `/api/users/${page.url().split('/').at(-1)}/active-status`, 'PATCH', {
        active: true,
      })
    ).status,
  ).toBe(409)
  await expect(page.getByRole('button', { name: /Xóa|Mật khẩu|Cấp quyền/ })).toHaveCount(0)
  await page.goto('/admin/users/new')
  await page.getByLabel('Họ và tên', { exact: true }).fill('Trùng liên hệ')
  await page.getByLabel('Điện thoại quốc tế').fill('+84912345000')
  await page.getByRole('button', { name: 'Tạo tài khoản được mời' }).click()
  await expect(page.getByRole('alert')).toContainText('đã được sử dụng')
})
test('disable and valid activation update canonical account while revoked tokens stay invalid', async ({
  page,
}) => {
  await login(page, `/admin/users/${id(7000)}`)
  await api(page, '/api/me', 'GET', undefined, 'manager@tropro.demo')
  const oldToken = await page.evaluate(
    (uid) =>
      Object.entries(JSON.parse(sessionStorage.getItem('tropro-demo-v2')!).sessions).find(
        ([, v]) => v === uid,
      )?.[0],
    id(7000),
  )
  await page.getByRole('button', { name: 'Ngừng kích hoạt', exact: true }).click()
  await page.getByLabel('Ghi chú (không bắt buộc)').fill(note)
  await page.getByRole('button', { name: 'Xác nhận thay đổi' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Ngừng kích hoạt', { exact: true }).first()).toBeVisible()
  const status = await page.evaluate(
    async ({ token, branch }) =>
      (
        await fetch(`/__mock/api/manager/branches/${branch}/rooms`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ).status,
    { token: oldToken, branch: id(10) },
  )
  expect(status).toBe(401)
  await page.getByRole('button', { name: 'Kích hoạt lại', exact: true }).click()
  await page.getByRole('button', { name: 'Xác nhận thay đổi' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ngừng kích hoạt', exact: true })).toBeEnabled()
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
  ).toBe(200)
})
test('self-disable is protected and role overview is read-only', async ({ page }) => {
  await login(page, `/admin/users/${id(8000)}`)
  await expect(page.getByRole('button', { name: 'Ngừng kích hoạt', exact: true })).toBeDisabled()
  expect(
    (await api(page, `/api/users/${id(8000)}/active-status`, 'PATCH', { active: false })).status,
  ).toBe(403)
  await page.goto('/admin/roles')
  await expect(page.getByRole('button', { name: /Xem phạm vi/ })).toHaveCount(5)
  await page.getByRole('button', { name: 'Xem phạm vi quản trị viên' }).click()
  await expect(page.getByRole('dialog')).toContainText('không tự có quyền vận hành tài chính')
  await expect(page.getByRole('button', { name: /Cấp vai trò|Thu hồi vai trò/ })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
test('USER onboarding → ADMIN restricted review → canonical OWNER creates owned Branch', async ({
  page,
}) => {
  test.setTimeout(120000)
  await login(page, '/owner/onboarding', 'an@tropro.demo')
  await page
    .getByLabel('Tài liệu xác minh', { exact: true })
    .setInputFiles({ name: 'ho-so-mau.png', mimeType: 'image/png', buffer: image })
  await page.getByLabel('Số điện thoại', { exact: true }).fill('+84901234567')
  await page.getByRole('button', { name: 'Kiểm tra hồ sơ' }).click()
  await page.getByRole('button', { name: 'Gửi xác minh', exact: true }).click()
  await expect(page.getByText('Đã gửi hồ sơ.', { exact: false })).toBeVisible()
  await login(page, '/admin/owner-verifications', 'admin@tropro.demo', true)
  await page
    .getByRole('link', { name: 'Nguyễn Minh An', exact: true })
    .filter({ visible: true })
    .click()
  const docs = page.getByRole('button', { name: 'Xem tài liệu được phép' })
  await docs.click()
  await expect(
    page.getByRole('img', { name: 'Tài liệu xác minh giả lập dành cho quản trị viên' }),
  ).toBeVisible()
  await expect
    .poll(() =>
      page
        .getByRole('img', { name: 'Tài liệu xác minh giả lập dành cho quản trị viên' })
        .evaluate((el) => (el as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0)
  await page.keyboard.press('Escape')
  await expect(docs).toBeFocused()
  await page.getByRole('button', { name: 'Phê duyệt hồ sơ', exact: true }).click()
  await confirmReview(page)
  await expect(page.getByText('Đã ghi nhận kết quả xét duyệt.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Phê duyệt hồ sơ', exact: true })).toHaveCount(0)
  await login(page, '/owner/verification', 'an@tropro.demo', true)
  await expect(page.getByRole('heading', { name: 'Hồ sơ đã được duyệt' })).toBeVisible()
  await page.getByRole('link', { name: 'Vào không gian chủ trọ' }).click()
  await expect(page).toHaveURL('/owner/dashboard')
  await page.goto('/owner/branches/new')
  await page.getByLabel('Mã chi nhánh', { exact: true }).fill('ADMIN-JOURNEY')
  await page.getByLabel('Tên chi nhánh', { exact: true }).fill('TroPro chủ trọ mới')
  await page.getByLabel('Địa chỉ', { exact: true }).fill('15 Đường số 2, Linh Trung')
  await page.getByRole('button', { name: 'Kiểm tra thay đổi' }).click()
  await page.getByRole('button', { name: 'Xác nhận lưu' }).click()
  await expect(page).toHaveURL(/\/owner\/branches\/[0-9a-f-]{36}$/)
  const branch = page.url().split('/').at(-1)!
  await login(page, '/admin/branches', 'admin@tropro.demo', true)
  await page.getByRole('textbox', { name: 'Tìm kiếm', exact: true }).fill('ADMIN-JOURNEY')
  await page
    .getByRole('button', { name: 'TroPro chủ trọ mới', exact: false })
    .filter({ visible: true })
    .click()
  await expect(page.getByRole('dialog')).toContainText('ADMIN-JOURNEY')
  expect((await api(page, `/api/owner/branches/${branch}`, 'PATCH', {})).status).toBe(403)
})
test('rejection reason reaches applicant, resubmission is new review and stale decisions fail', async ({
  page,
}) => {
  test.setTimeout(90000)
  await login(page, `/admin/owner-verifications/${id(8002)}`)
  const old = (await api(page, `/api/admin/owner-verifications/${id(8002)}`)).body.data.version
  await page.getByRole('button', { name: 'Từ chối hồ sơ', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
  await confirmReview(page)
  await login(page, '/owner/verification', 'applicant@tropro.demo', true)
  await expect(page.getByRole('heading', { name: 'Cần bổ sung hồ sơ' })).toBeVisible()
  await expect(page.getByText(note, { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Bổ sung và gửi lại' }).click()
  await page
    .getByLabel('Tài liệu xác minh', { exact: true })
    .setInputFiles({ name: 'bo-sung.png', mimeType: 'image/png', buffer: image })
  await page.getByRole('button', { name: 'Kiểm tra hồ sơ' }).click()
  await page.getByRole('button', { name: 'Gửi xác minh', exact: true }).click()
  await expect(page.getByText('Đã gửi hồ sơ.', { exact: false })).toBeVisible()
  await login(page, `/admin/owner-verifications/${id(8002)}`, 'admin@tropro.demo', true)
  expect(
    (
      await api(page, `/api/admin/owner-verifications/${id(8002)}/decision`, 'POST', {
        decision: 'APPROVED',
        reason: note,
        version: old,
      })
    ).status,
  ).toBe(409)
  await page.getByRole('button', { name: 'Phê duyệt hồ sơ', exact: true }).click()
  await confirmReview(page)
})
test('open stale review dialog rejects a competing Admin decision safely', async ({ page }) => {
  await login(page, `/admin/owner-verifications/${id(8002)}`)
  const version = (await api(page, `/api/admin/owner-verifications/${id(8002)}`)).body.data.version
  await page.getByRole('button', { name: 'Phê duyệt hồ sơ', exact: true }).click()
  expect(
    (
      await api(
        page,
        `/api/admin/owner-verifications/${id(8002)}/decision`,
        'POST',
        { decision: 'REJECTED', reason: note, version },
        'admin-reviewer@tropro.demo',
      )
    ).status,
  ).toBe(200)
  await page.getByRole('dialog').getByLabel('Lý do / ghi chú').fill(note)
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'đã thay đổi hoặc đã được xét duyệt',
  )
  const result = (await api(page, `/api/admin/owner-verifications/${id(8002)}`)).body.data
  expect(result.verification.status).toBe('REJECTED')
  expect(result.history).toHaveLength(1)
})
test('read-only directories and safe assignment audit do not expose financial operations', async ({
  page,
}) => {
  await login(page, '/admin/branches')
  const invitation = (
    await api(
      page,
      '/api/owner/invitations',
      'POST',
      { fullName: 'Nguyễn Minh An', email: 'an@tropro.demo', phone: '', branchIds: [], note },
      'owner@tropro.demo',
    )
  ).body.data
  await api(page, `/api/owner/my-invitations/${invitation.id}/accept`, 'POST', {}, 'an@tropro.demo')
  const branch = (
    await api(page, `/api/owner/branches/${id(10)}`, 'GET', undefined, 'owner@tropro.demo')
  ).body.data
  await api(
    page,
    `/api/owner/branches/${branch.id}/assignment`,
    'PUT',
    { managerId: id(1), version: branch.version, reason: note },
    'owner@tropro.demo',
  )
  await page.goto('/admin/activity?type=MANAGER_ASSIGNMENT')
  await page
    .getByRole('link', { name: 'Phân công quản lý', exact: true })
    .filter({ visible: true })
    .click()
  await expect(page.getByRole('heading', { name: 'Chi tiết sự kiện' })).toBeVisible()
  await expect(page.getByText('Phạm Thanh Hà', { exact: true })).toBeVisible()
  const audit = (await api(page, '/api/admin/activity?type=MANAGER_ASSIGNMENT')).body.data
    .content[0]
  expect(Object.keys(audit.detail)).toEqual(['branchName'])
  expect((await api(page, `/api/admin/activity/${audit.id}`, 'DELETE')).status).toBe(404)
  expect((await api(page, `/api/manager/branches/${id(10)}/invoices`)).status).toBe(403)
  await page.goto('/admin/owners')
  await expect(
    page.getByRole('link', { name: 'Phạm Thanh Hà', exact: true }).filter({ visible: true }),
  ).toBeVisible()
  await page.goto('/admin/branches')
  await expect(
    page.getByRole('button', { name: /Sửa chi nhánh|Phát hành|Xác minh thanh toán/ }),
  ).toHaveCount(0)
})
test('shared notifications, error states, logout and session switching keep Admin data private', async ({
  page,
}) => {
  test.setTimeout(90000)
  await login(page, '/notifications')
  await page.getByRole('button', { name: 'Đọc tất cả', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Đánh dấu đã đọc' })).toHaveCount(0)
  await page.goto('/admin/users?demo=error')
  await expect(page.getByRole('alert')).toContainText('Máy chủ đang gặp sự cố.')
  await page.goto('/admin/users?demo=empty')
  await expect(page.getByText('Chưa có người dùng phù hợp.')).toBeVisible()
  await login(page, '/admin/users', 'an@tropro.demo', true)
  await expect(
    page.getByText('Bạn không có quyền quản trị hệ thống.', { exact: false }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Nguyễn Thảo Vy', exact: true })).toHaveCount(0)
  expect((await api(page, '/api/admin/activity')).status).toBe(403)
})
test('controlled demo reset restores shared account and verification data', async ({ page }) => {
  await login(page, '/admin/dashboard')
  await api(page, `/api/users/${id(8001)}/active-status`, 'PATCH', { active: false })
  await page.getByText('Công cụ dữ liệu demo', { exact: true }).click()
  await page.getByRole('button', { name: 'Khôi phục dữ liệu demo', exact: true }).click()
  await confirmReview(page)
  expect((await api(page, `/api/users/${id(8001)}`)).body.data.status).toBe('ACTIVE')
  expect(
    (await api(page, `/api/admin/owner-verifications/${id(8002)}`)).body.data.verification.status,
  ).toBe('PENDING')
})
test('Admin screens render on desktop/tablet/mobile without overflow, runtime errors or unsafe controls', async ({
  page,
}, info) => {
  test.setTimeout(120000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await login(page)
  await api(page, '/api/users', 'POST', {
    fullName: 'Hồ sơ kiểm tra audit',
    email: 'audit-qa@example.test',
    phone: '',
    dateOfBirth: '',
    gender: '',
  })
  const event = (await api(page, '/api/admin/activity')).body.data.content[0].id
  for (const route of [
    'dashboard',
    'users',
    'users/new',
    `users/${id(7000)}`,
    'roles',
    'owner-verifications',
    `owner-verifications/${id(8002)}`,
    'owners',
    'branches',
    'activity',
    `activity/${event}`,
  ]) {
    await page.goto('/admin/' + route)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByLabel('Đang tải', { exact: true })).toHaveCount(0)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      route,
    ).toBe(true)
    if (
      (route === 'dashboard' && info.project.name === 'desktop') ||
      (route === `owner-verifications/${id(8002)}` && info.project.name === 'mobile') ||
      (route === 'users' && info.project.name === 'mobile')
    )
      await page.screenshot({
        path: `../docs/frontend/admin-screenshots/${route.startsWith('owner-verifications/') ? 'verification' : route}-${info.project.name}.png`,
        fullPage: true,
        scale: 'css',
      })
  }
  if (info.project.name === 'desktop') {
    await page.setViewportSize({ width: 820, height: 1180 })
    await page.goto('/admin/users')
    await expect(page.getByRole('heading', { name: 'Người dùng', exact: true })).toBeVisible()
    await expect(page.getByLabel('Đang tải', { exact: true })).toHaveCount(0)
    await expect(
      page
        .getByRole('link', { name: 'Hồ sơ kiểm tra audit', exact: true })
        .filter({ visible: true }),
    ).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )
    await page.screenshot({
      path: '../docs/frontend/admin-screenshots/users-tablet.png',
      fullPage: false,
      scale: 'css',
    })
  }
  expect(errors).toEqual([])
})
