import { test, expect, type Page, type TestInfo } from '@playwright/test'
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`
async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready)
  await page.locator('img').evaluateAll((images) => {
    images.forEach((image) => {
      image.loading = 'eager'
    })
  })
  await expect
    .poll(() =>
      page
        .locator('img')
        .evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)),
    )
    .toBe(true)
  await page
    .locator('img')
    .evaluateAll((images) => Promise.all(images.map((image) => image.decode())))
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({
    path: `test-results/visual/${info.project.name}-${name}.png`,
    fullPage: true,
  })
}
test('visual review: home, search, detail, login, dashboard and booking', async ({
  page,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Phòng đang cho thuê' })).toBeVisible()
  await expect(page.getByRole('article').first()).toBeVisible()
  await capture(page, info, 'home')
  await page.goto('/rooms')
  await expect(page.getByRole('article').first()).toBeVisible()
  await capture(page, info, 'search')
  await page.goto(`/rooms/${id(100)}`)
  await expect(page.getByRole('button', { name: 'Mở thư viện ảnh' })).toBeVisible()
  await expect(page.getByText('Đang kiểm tra lịch trống…')).toHaveCount(0)
  await capture(page, info, 'room')
  await page.goto('/login')
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await capture(page, info, 'login')
  await page.getByRole('button', { name: 'Điền tài khoản demo' }).click()
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).toHaveURL('/user/dashboard')
  await expect(page.getByRole('link', { name: 'Chi tiết' }).first()).toBeVisible()
  await capture(page, info, 'dashboard')
  await page.goto(`/rooms/${id(102)}/bookings/new`)
  await expect(page.getByLabel('Chỗ ở', { exact: true })).toBeVisible()
  await capture(page, info, 'booking')
  expect(errors).toEqual([])
})
test('loading states, invalid filters, unavailable rooms and keyboard menu', async ({ page }) => {
  await page.goto('/rooms?demo=loading')
  await expect(page.getByLabel('Đang tải', { exact: true })).toBeVisible()
  await expect(page.getByRole('article').first()).toBeVisible({ timeout: 12000 })
  await page.goto('/rooms?minPrice=900&maxPrice=100')
  await expect(page.getByRole('alert')).toContainText('Bộ lọc trong liên kết chưa hợp lệ')
  await page.getByRole('button', { name: 'Đặt lại bộ lọc' }).click()
  await expect(page).toHaveURL('/rooms')
  await page.getByRole('button', { name: 'Mở menu' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Tab')
  expect(await page.getByRole('dialog').evaluate((el) => el.contains(document.activeElement))).toBe(
    true,
  )
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.goto(`/rooms/${id(110)}`)
  await expect(page.getByRole('button', { name: 'Yêu cầu giữ chỗ', exact: true })).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Tạm ngừng nhận lịch xem', exact: true }),
  ).toBeDisabled()
})
test('overlapping booking and reversed date ranges cannot be submitted', async ({ page }) => {
  await page.goto(`/login?redirect=${encodeURIComponent(`/rooms/${id(104)}/bookings/new`)}`)
  await page.getByRole('button', { name: 'Điền tài khoản demo' }).click()
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).toHaveURL(`/rooms/${id(104)}/bookings/new`)
  await expect(
    page.getByText('Phòng hoặc chỗ ở đã có lịch thuê/giữ chỗ trong khoảng ngày này.'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Gửi yêu cầu giữ chỗ' })).toBeDisabled()
  await page.getByLabel('Ngày kết thúc', { exact: true }).fill('2020-01-01')
  await expect(page.getByRole('alert')).toContainText('Ngày kết thúc phải sau ngày bắt đầu')
  await expect(page.getByRole('button', { name: 'Gửi yêu cầu giữ chỗ' })).toBeDisabled()
})
