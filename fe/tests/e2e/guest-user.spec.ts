import { test, expect, type Page } from '@playwright/test'

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`
function day(offset: number) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
async function login(page: Page, destination = '/user/dashboard') {
  await page.goto(`/login?redirect=${encodeURIComponent(destination)}`)
  await page.getByRole('button', { name: 'Điền tài khoản demo' }).click()
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).toHaveURL(destination)
}
async function roomBooking(page: Page, index = 0) {
  await page.getByLabel('Ngày bắt đầu', { exact: true }).fill(day(3))
  await page.getByLabel('Ngày kết thúc', { exact: true }).fill(day(34))
  if (index === 2) await page.getByLabel('Chỗ ở', { exact: true }).selectOption(id(1022))
  await page.getByRole('checkbox').check()
  await expect(page.getByRole('button', { name: 'Gửi yêu cầu giữ chỗ' })).toBeEnabled()
  await page.getByRole('button', { name: 'Gửi yêu cầu giữ chỗ' }).click()
  await expect(page).toHaveURL(/\/user\/bookings\/[0-9a-f-]+$/)
}
test('homepage, hero search, FAQ and room gallery are functional', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Tìm phòng trọ vừa túi tiền' })).toBeVisible()
  await expect(page.locator('video')).toHaveAttribute('poster', /living-room/)
  await page.getByRole('combobox', { name: 'Hình thức', exact: true }).click()
  await page.getByRole('option', { name: 'Nguyên phòng' }).click()
  await page.getByRole('button', { name: 'Tìm phòng', exact: true }).click()
  await expect(page).toHaveURL(/mode=ROOM/)
  await expect(page.getByRole('article').first()).toBeVisible()
  await page.getByRole('article').first().getByRole('link').click()
  await expect(page.getByRole('heading', { name: 'Một chút về không gian' })).toBeVisible()
  await page.getByRole('button', { name: 'Mở thư viện ảnh' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Ảnh 2', exact: true }).click()
  await page.getByRole('button', { name: 'Đóng', exact: true }).click()
})
test('filters, price, URL state, browser history and pagination work', async ({
  page,
  isMobile,
}) => {
  await page.goto('/rooms')
  if (isMobile) await page.getByRole('button', { name: 'Bộ lọc', exact: true }).click()
  const filters = isMobile ? page.getByRole('dialog') : page.locator('aside')
  await filters.getByLabel('Hình thức thuê').selectOption('SLOT')
  await filters.getByLabel('Giá tối đa').fill('2000000')
  await filters.getByRole('button', { name: 'Áp dụng bộ lọc' }).click()
  await expect(page).toHaveURL(/mode=SLOT/)
  await expect(page).toHaveURL(/maxPrice=2000000/)
  await expect(page.getByRole('article').first()).toContainText('Ở ghép')
  await page.getByRole('combobox', { name: 'Sắp xếp' }).selectOption('price-desc')
  await expect(page).toHaveURL(/sort=price-desc/)
  await page.goBack()
  await expect(page.getByRole('combobox', { name: 'Sắp xếp' })).toHaveValue('recommended')
  await page.goForward()
  await expect(page.getByRole('combobox', { name: 'Sắp xếp' })).toHaveValue('price-desc')
  await page.getByRole('button', { name: 'Xóa tất cả', exact: true }).click()
  await page.getByRole('button', { name: 'Trang sau' }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.getByText('Trang 2 / 2')).toBeVisible()
})
test('guest action restores intended booking destination after login', async ({ page }) => {
  const destination = `/rooms/${id(100)}/bookings/new?startDate=${day(3)}&endDate=${day(34)}`
  await page.goto(destination)
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await page.getByRole('button', { name: 'Điền tài khoản demo' }).click()
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).toHaveURL(destination)
  await expect(page.getByLabel('Ngày bắt đầu', { exact: true })).toHaveValue(day(3))
  await expect(page.getByText('500.000 ₫', { exact: true })).toBeVisible()
})
test('appointment create, branch response, cancel and notification updates', async ({ page }) => {
  await login(page, `/rooms/${id(101)}/appointments/new`)
  await page.getByLabel('Ngày xem phòng').fill(day(3))
  await page.getByLabel('Lời nhắn (không bắt buộc)').fill('Mình muốn xem khu để xe.')
  await page.getByRole('button', { name: 'Gửi lịch hẹn' }).click()
  await expect(page).toHaveURL(/\/user\/appointments\/[0-9a-f-]+$/)
  await expect(page.getByText('Chờ xác nhận', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Mô phỏng chấp nhận' }).click()
  await expect(page.getByText('Đã xác nhận', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Hủy lịch hẹn', exact: true }).click()
  await page.getByRole('button', { name: 'Xác nhận hủy' }).click()
  await expect(page.getByText('Đã hủy', { exact: true }).first()).toBeVisible()
  await page.goto('/notifications')
  await expect(
    page.getByRole('heading', { name: 'Đã hủy lịch xem phòng', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Đọc tất cả', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Đánh dấu đã đọc' })).toHaveCount(0)
})
test('appointment reversed interval and scheduling conflicts are rejected', async ({ page }) => {
  await login(page, `/rooms/${id(100)}/appointments/new`)
  await page.getByLabel('Ngày xem phòng').fill(day(2))
  await page.getByLabel('Giờ kết thúc (VN)').fill('08:30')
  await page.getByRole('button', { name: 'Gửi lịch hẹn' }).click()
  await expect(page.getByText('Giờ kết thúc phải sau giờ bắt đầu.')).toBeVisible()
  await page.getByLabel('Giờ kết thúc (VN)').fill('09:30')
  await page.getByRole('button', { name: 'Gửi lịch hẹn' }).click()
  await expect(page.getByRole('alert')).toContainText('đã có lịch hẹn')
})
test('ROOM booking, pending payment and trusted verification', async ({ page }) => {
  await login(page, `/rooms/${id(109)}/bookings/new`)
  await roomBooking(page)
  await expect(page.getByText('Chờ thanh toán', { exact: true }).first()).toBeVisible()
  await page.getByRole('link', { name: 'Thanh toán giữ chỗ', exact: true }).click()
  await page.getByRole('button', { name: 'Bắt đầu thanh toán demo' }).click()
  await expect(
    page.getByText('Giao dịch đang chờ xác minh. Bạn không cần tự xác nhận đã nhận tiền.'),
  ).toBeVisible()
  await expect(page.getByText('Đã xác minh khoản giữ chỗ. Yêu cầu đã được xác nhận.')).toBeVisible({
    timeout: 16000,
  })
  await expect(page.getByText('Đã xác minh', { exact: true })).toBeVisible()
})
test('SLOT booking validates availability and uses branch hold amount', async ({ page }) => {
  await login(page, `/rooms/${id(102)}/bookings/new`)
  await expect(page.getByText('300.000 ₫', { exact: true })).toBeVisible()
  await roomBooking(page, 2)
  await expect(page.getByText(/TroPro Làng Đại học · Chỗ 3/)).toBeVisible()
})
test('late payment stays expired and requires review', async ({ page }) => {
  await login(page, `/rooms/${id(109)}/bookings/new`)
  await roomBooking(page)
  await page.getByRole('link', { name: 'Thanh toán giữ chỗ', exact: true }).click()
  await page.getByLabel('Tình huống mô phỏng').selectOption('late')
  await page.getByRole('button', { name: 'Bắt đầu thanh toán demo' }).click()
  await expect(page.getByText('Đã hết hạn', { exact: true })).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Cần đối soát', { exact: true })).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('Đã hết hạn', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Bắt đầu thanh toán demo' })).toBeDisabled()
})
test('register, token verification, password recovery and profile/logout', async ({
  page,
}, testInfo) => {
  const email = `qa-${testInfo.project.name}-${Date.now()}@tropro.demo`
  await page.goto('/register')
  await page.getByLabel('Họ và tên').fill('Trần Hoài Anh')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill('TroPro@123')
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('TroPro@123')
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click()
  await page.getByRole('link', { name: 'Mở thư xác minh email' }).click()
  await expect(page.getByRole('heading', { name: 'Email đã được xác minh.' })).toBeVisible()
  await page.getByRole('link', { name: 'Về đăng nhập' }).click()
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill('TroPro@123')
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).toHaveURL('/user/dashboard')
  await expect(page.getByText('Chưa có lịch xem sắp tới.', { exact: false })).toBeVisible()
  await page.goto('/profile')
  await page.getByLabel('Họ và tên').fill('Trần Hoài Anh QA')
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(page.getByText('Đã lưu thông tin cá nhân.')).toBeVisible()
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  await expect(page).toHaveURL('/')
  await page.goto('/user/dashboard')
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await page.goto('/forgot-password')
  await page.getByLabel('Email đăng ký').fill(email)
  await page.getByRole('button', { name: 'Gửi liên kết khôi phục' }).click()
  await page.getByRole('link', { name: 'Mở thư đặt lại mật khẩu' }).click()
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('TroPro@456')
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('TroPro@456')
  await page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).click()
  await expect(page).toHaveURL('/login?reset=success')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill('TroPro@456')
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).toHaveURL('/user/dashboard')
})
test('responsive navigation, branch, empty/error and invalid-link states', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.getByRole('button', { name: 'Mở menu' }).click()
  await page.getByRole('dialog').getByRole('link', { name: 'Tìm phòng', exact: true }).click()
  await expect(page).toHaveURL('/rooms')
  await expect(
    page.getByRole('heading', { name: 'Không gian vừa vặn với cuộc sống.' }),
  ).toBeVisible()
  await expect(page.getByRole('article').first()).toBeVisible()
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-search.png`,
    fullPage: true,
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.goto(`/branches/${id(10)}`)
  await expect(page.getByRole('heading', { name: 'TroPro Thủ Đức', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Nội quy chung' })).toBeVisible()
  await page.goto('/rooms?demo=empty')
  await expect(page.getByText('Chưa tìm thấy phòng phù hợp.', { exact: false })).toBeVisible()
  await page.goto('/rooms?demo=error')
  await expect(page.getByRole('alert').last()).toContainText('Máy chủ đang gặp sự cố')
  await page.goto('/rooms/not-a-uuid')
  await expect(page.getByText('Liên kết phòng không hợp lệ.', { exact: false })).toBeVisible()
  expect(errors).toEqual([])
})
