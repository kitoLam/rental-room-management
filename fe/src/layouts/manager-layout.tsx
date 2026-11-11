import { useState } from 'react'
import {
  Outlet,
  NavLink,
  Link,
  Navigate,
  useNavigate,
  useLocation,
  useSearchParams,
} from 'react-router'
import { useQuery, useMutation, useIsMutating } from '@tanstack/react-query'
import {
  LayoutDashboard,
  House,
  Users,
  CalendarDays,
  Bookmark,
  FileText,
  Plug,
  Droplets,
  ReceiptText,
  Wallet,
  CircleDollarSign,
  Armchair,
  Wrench,
  ChartColumn,
} from 'lucide-react'
import { Container } from '@/components/common/container'
import { Button } from '@/components/ui/button'
import { InlineError, Notice, QueryState } from '@/components/common/page'
import { useSession } from '@/features/auth/session-store'
import { managerApi } from '@/services/manager'
import { provider } from '@/services/config'
import { queryClient } from '@/services/query-client'
import { useManagerSelection, managerLink } from '@/features/manager/context'
const groups = [
  { label: 'Tổng quan', items: [['dashboard', 'Tổng quan', LayoutDashboard]] },
  {
    label: 'Phòng & người thuê',
    items: [
      ['rooms', 'Phòng', House],
      ['room-types', 'Loại phòng', House],
      ['tenants', 'Người thuê', Users],
    ],
  },
  {
    label: 'Tiếp nhận & hợp đồng',
    items: [
      ['appointments', 'Lịch xem', CalendarDays],
      ['bookings', 'Giữ phòng', Bookmark],
      ['contracts', 'Hợp đồng', FileText],
    ],
  },
  {
    label: 'Dịch vụ & vận hành',
    items: [
      ['services', 'Dịch vụ', Plug],
      ['room-services', 'Dịch vụ phòng', Plug],
      ['service-requests', 'Yêu cầu dịch vụ', Plug],
      ['utility-charges', 'Điện nước', Droplets],
      ['maintenance', 'Yêu cầu hỗ trợ', Wrench],
    ],
  },
  {
    label: 'Tài chính',
    items: [
      ['invoices', 'Hóa đơn', ReceiptText],
      ['payments', 'Thanh toán', Wallet],
      ['debts', 'Công nợ', CircleDollarSign],
    ],
  },
  {
    label: 'Khác',
    items: [
      ['furnitures', 'Cơ sở vật chất', Armchair],
      ['reports', 'Báo cáo', ChartColumn],
    ],
  },
] as const
export function ManagerLayout() {
  const busy = useIsMutating() > 0
  const user = useSession((s) => s.user!),
    selected = useManagerSelection((s) => s.byUser[user.id]),
    select = useManagerSelection((s) => s.select),
    denied = useManagerSelection((s) => s.denied),
    deny = useManagerSelection((s) => s.deny)
  const [params] = useSearchParams(),
    navigate = useNavigate(),
    location = useLocation(),
    [demoMessage, setDemoMessage] = useState('')
  const owner = user.roles.includes('OWNER')
  const root = owner ? '/owner' : '/manager'
  const ownerOverview = owner && /^\/owner(?:\/dashboard)?\/?$/.test(location.pathname)
  const list = useQuery({
      queryKey: ['manager-branches', user.id, params.get('demo'), params.get('workspace')],
      queryFn: managerApi.branches,
      staleTime: 0,
      refetchInterval: 2000,
      retry: false,
    }),
    branches = list.data || [],
    requested = params.get('branchId'),
    branch = requested
      ? branches.find((b) => b.id === requested)
      : branches.find((b) => b.id === selected) ||
        branches.find((b) => b.status === 'ACTIVE') ||
        branches[0]
  const demo = useMutation({
    mutationFn: (scenario: 'reset' | 'revoke') =>
      managerApi.demo(scenario, branch?.id || requested || ''),
    onSuccess: (_, scenario) => {
      if (scenario === 'revoke' && branch) deny(`${user.id}:${branch.id}`)
      if (scenario === 'reset') {
        useManagerSelection.getState().clearDenied()
        navigate('/manager/dashboard')
      }
      queryClient.removeQueries({ queryKey: ['manager'] })
      void queryClient.invalidateQueries()
      setDemoMessage(
        scenario === 'reset'
          ? 'Đã khôi phục dữ liệu demo liên kết.'
          : 'Chủ sở hữu mô phỏng đã thu hồi phân công tại chi nhánh.',
      )
    },
  })
  const route =
    groups
      .reduce<string[]>((paths, g) => [...paths, ...g.items.map((item) => item[0])], [])
      .find((path) => location.pathname.startsWith(`${root}/${path}`)) || 'dashboard'
  const allowed = branch && !denied.includes(`${user.id}:${branch.id}`)
  if (owner && /^\/manager(?:\/|$)/.test(location.pathname)) {
    const ownerParams = new URLSearchParams(params)
    ownerParams.delete('workspace')
    const target = location.pathname.replace(/^\/manager(?=\/|$)/, '/owner')
    return <Navigate replace to={`${target}${ownerParams.size ? `?${ownerParams}` : ''}`} />
  }
  if (!owner && location.pathname.startsWith('/owner/')) {
    return (
      <Navigate
        replace
        to={location.pathname.replace(/^\/owner\//, '/manager/') + location.search}
      />
    )
  }
  return (
    <Container wide className="py-7 sm:py-10">
      <QueryState
        pending={list.isPending}
        error={list.error}
        retry={list.refetch}
        empty={list.data?.length === 0}
        emptyMessage={
          owner ? 'Bạn chưa có chi nhánh sở hữu.' : 'Bạn chưa có chi nhánh được phân công quản lý.'
        }
        emptyAction={
          <Button asChild>
            <Link to="/profile">Xem hồ sơ</Link>
          </Button>
        }
      >
        {!allowed && branches.length > 0 && (
          <Notice tone="warning">
            Bạn không còn quyền quản lý chi nhánh trong liên kết này.{' '}
            <Link className="underline" to={`${root}/dashboard`}>
              Chọn lại chi nhánh được phép
            </Link>
          </Notice>
        )}
        {allowed && (
          <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-[210px_minmax(0,1fr)]">
            <aside className="min-w-0">
              {user.roles.includes('ADMIN') && (
                <Link
                  className="mb-5 block min-h-11 text-sm font-bold text-primary"
                  to="/admin/dashboard"
                >
                  ← Quản trị hệ thống
                </Link>
              )}
              <div className="mb-5">
                <label
                  htmlFor="manager-branch"
                  className="mb-2 block text-xs font-bold text-muted-foreground"
                >
                  {owner ? 'CHI NHÁNH SỞ HỮU' : 'CHI NHÁNH ĐƯỢC PHÂN CÔNG'}
                </label>
                <select
                  id="manager-branch"
                  className="input w-full"
                  value={ownerOverview ? requested || '' : branch.id}
                  disabled={busy}
                  onChange={(e) => {
                    select(user.id, e.target.value)
                    navigate(managerLink(`/manager/${route}`, e.target.value))
                  }}
                >
                  {ownerOverview && <option value="">Tất cả chi nhánh</option>}
                  {branches.map((b) => (
                    <option value={b.id} key={b.id}>
                      {b.name}
                      {b.status === 'ACTIVE'
                        ? ''
                        : b.status === 'DRAFT'
                          ? ' · Nháp'
                          : ' · Ngừng hoạt động'}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {ownerOverview && !requested
                    ? 'Đang tổng hợp tất cả chi nhánh sở hữu.'
                    : branch.address}
                </p>
                {branch.managerName && !(ownerOverview && !requested) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Quản lý: {branch.managerName}
                  </p>
                )}
              </div>
              <nav aria-label="Điều hướng quản lý" className="hidden lg:grid">
                {groups.map((g) => (
                  <div key={g.label} className="mb-4">
                    <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      {g.label}
                    </p>
                    {g.items.map(([path, label, Icon]) => (
                      <NavLink
                        key={path}
                        to={managerLink(`/manager/${path}`, branch.id)}
                        className={({ isActive }) =>
                          `flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-primary-soft font-bold text-primary' : 'text-muted-foreground hover:bg-surface hover:text-foreground'}`
                        }
                      >
                        <Icon size={16} />
                        {label}
                      </NavLink>
                    ))}
                  </div>
                ))}
              </nav>
              <nav className="lg:hidden" aria-label="Quản lý trên di động">
                <select
                  className="input"
                  aria-label="Điều hướng quản lý"
                  value={route}
                  onChange={(e) => navigate(managerLink(`/manager/${e.target.value}`, branch.id))}
                >
                  {groups.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.items.map(([path, label]) => (
                        <option key={path} value={path}>
                          {label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </nav>
              <div className="mt-4 flex flex-wrap gap-4 lg:grid lg:gap-1">
                <Link
                  to="/profile"
                  className="inline-flex min-h-11 items-center text-xs text-muted-foreground"
                >
                  Hồ sơ
                </Link>
              </div>
            </aside>
            <div className="min-w-0">
              {demoMessage && (
                <div className="mb-5">
                  <Notice>{demoMessage}</Notice>
                </div>
              )}
              {branch.status !== 'ACTIVE' && (
                <Notice>Chi nhánh ngừng hoạt động. Chỉ xem hồ sơ lịch sử.</Notice>
              )}
              <Outlet
                key={`${user.id}-${branch.id}`}
                context={{ branch, branches, overviewBranchId: requested || undefined }}
              />
            </div>
          </div>
        )}
      </QueryState>
      {import.meta.env.DEV &&
        provider('manager') === 'mock' &&
        user.email === 'manager@tropro.demo' && (
          <details className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
            <summary className="min-h-11 cursor-pointer py-3">
              Công cụ kịch bản Manager demo
            </summary>
            <p className="mb-4 leading-6">
              Dữ liệu giả lập cho kiểm thử. Thu hồi phân công mô phỏng hành động của chủ sở hữu,
              không phải quyền của Manager.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                loading={demo.isPending}
                onClick={() => demo.mutate('reset')}
              >
                Khôi phục dữ liệu liên kết
              </Button>
              <Button
                variant="outline"
                disabled={!allowed || demo.isPending}
                onClick={() => demo.mutate('revoke')}
              >
                Mô phỏng chủ nhà thu hồi phân công
              </Button>
            </div>
            <InlineError error={demo.error} />
          </details>
        )}
    </Container>
  )
}
