import { ChartBar } from '@/components/common/chart-bar'
import type { AdminOverview } from '@/interfaces/admin-overview'
import { roleNames as adminRoleNames } from './labels'
const colors = ['#0d7773', '#79aaa1', '#b8a27c', '#6a7d8c', '#b8b5ae']
const number = (value: number) => value.toLocaleString('vi-VN')

export function AccountRoleChart({ roles }: { roles: AdminOverview['roles'] }) {
  const total = roles.reduce((sum, item) => sum + item.count, 0)
  const circumference = 2 * Math.PI * 62
  return (
    <div className="mt-5 grid items-center gap-5 sm:grid-cols-[180px_minmax(0,1fr)]">
      <svg
        viewBox="0 0 180 180"
        className="mx-auto w-44"
        role="img"
        aria-label="Phân bố tài khoản theo vai trò"
      >
        <title>
          {roles
            .map((item) => `${adminRoleNames[item.role] || item.role}: ${item.count}`)
            .join(', ')}
        </title>
        <circle cx="90" cy="90" r="62" fill="none" stroke="var(--color-border)" strokeWidth="20" />
        {total > 0 &&
          roles.map((item, index) => {
            const previous = roles.slice(0, index).reduce((sum, role) => sum + role.count, 0)
            return (
              item.count > 0 && (
                <circle
                  key={item.role}
                  cx="90"
                  cy="90"
                  r="62"
                  fill="none"
                  stroke={colors[index % colors.length]}
                  strokeWidth="20"
                  strokeDasharray={`${(circumference * item.count) / total} ${circumference}`}
                  strokeDashoffset={(-circumference * previous) / total}
                  transform="rotate(-90 90 90)"
                />
              )
            )
          })}
        <text x="90" y="88" textAnchor="middle" fill="currentColor" fontSize="25" fontWeight="700">
          {number(total)}
        </text>
        <text x="90" y="109" textAnchor="middle" fill="currentColor" fontSize="11">
          tài khoản
        </text>
      </svg>
      <ul className="space-y-3" aria-label="Số tài khoản theo vai trò">
        {roles.map((item, index) => (
          <li key={item.role} className="flex items-center gap-3 text-sm">
            <svg className="size-3 shrink-0" aria-hidden="true">
              <rect width="12" height="12" rx="2" fill={colors[index % colors.length]} />
            </svg>
            <span className="flex-1">{adminRoleNames[item.role] || item.role}</span>
            <strong className="tabular-nums">{number(item.count)}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function RegistrationChart({
  months,
  year,
}: {
  months: AdminOverview['registrations']
  year: number
}) {
  const maximum = Math.max(1, ...months.map((item) => item.count))
  return (
    <>
      <div
        className="mt-6 grid grid-cols-12 gap-1 sm:gap-3"
        role="group"
        aria-label={`Tài khoản được tạo theo tháng năm ${year}`}
      >
        {months.map((item) => (
          <div
            key={item.month}
            className="min-w-0 text-center"
            tabIndex={0}
            aria-label={`Tháng ${item.month}: ${item.count} tài khoản`}
            title={`Tháng ${item.month}/${year}: ${number(item.count)} tài khoản`}
          >
            <span className="block truncate text-[10px] font-semibold tabular-nums sm:text-xs">
              {number(item.count)}
            </span>
            <div className="mt-2 flex h-32 items-end border-b border-border sm:h-40">
              <div
                className="w-full rounded-t-sm bg-primary/80"
                style={{ height: `${(item.count / maximum) * 100}%` }}
              />
            </div>
            <span className="mt-2 block text-[10px] text-muted-foreground sm:text-xs">
              T{item.month}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        {number(months.reduce((sum, item) => sum + item.count, 0))} tài khoản được tạo trong năm{' '}
        {year}, tính trên dữ liệu còn lưu.
      </p>
    </>
  )
}

export function StatusBreakdown({
  items,
  names,
}: {
  items: AdminOverview['rooms']
  names: Record<string, string>
}) {
  const total = items.reduce((sum, item) => sum + item.count, 0)
  return (
    <dl className="mt-4 space-y-3">
      {items.map((item) => (
        <div key={item.status}>
          <div className="flex justify-between gap-4 text-sm">
            <dt>{names[item.status] || 'Chưa xác định'}</dt>
            <dd className="font-semibold tabular-nums">{number(item.count)}</dd>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-sm bg-background" aria-hidden="true">
            <ChartBar className="bg-primary/65" value={item.count} max={total} />
          </div>
        </div>
      ))}
    </dl>
  )
}
