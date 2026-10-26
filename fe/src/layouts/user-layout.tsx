import { NavLink, Outlet } from 'react-router'
import { CalendarDays, House, KeyRound, UserRound } from 'lucide-react'
import { Container } from '@/components/common/container'
import { cn } from '@/lib/utils'
export function UserLayout() {
  return (
    <>
      <div className="border-b border-border bg-surface">
        <Container>
          <nav aria-label="Không gian cá nhân" className="flex gap-1 overflow-x-auto py-2 sm:gap-5">
            {[
              { to: '/user/dashboard', label: 'Tổng quan', icon: House },
              { to: '/user/appointments', label: 'Lịch xem phòng', icon: CalendarDays },
              { to: '/user/bookings', label: 'Giữ chỗ', icon: KeyRound },
              { to: '/profile', label: 'Hồ sơ', icon: UserRound },
            ].map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm',
                    isActive
                      ? 'bg-primary-soft font-bold text-primary'
                      : 'text-muted-foreground hover:text-primary',
                  )
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>
        </Container>
      </div>
      <Outlet />
    </>
  )
}
