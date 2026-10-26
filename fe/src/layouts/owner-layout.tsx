import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useIsMutating, useQuery } from '@tanstack/react-query'
import { Building2, ArrowUpRight } from 'lucide-react'
import { Container } from '@/components/common/container'
import { Notice, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-store'
import { useOwnerSelection, operationsLink } from '@/features/owner/context'
import { ownerApi } from '@/services/owner'
import { queryClient } from '@/services/query-client'
const groups: [string, [string, string][]][] = [
  ['Tổng quan', [['dashboard', 'Tổng quan']]],
  ['Tài sản', [['branches', 'Chi nhánh']]],
  [
    'Nhân sự',
    [
      ['managers', 'Quản lý'],
      ['manager-assignments', 'Phân công'],
    ],
  ],
  [
    'Tài chính',
    [
      ['finance', 'Tài chính'],
      ['payments', 'Giao dịch'],
      ['approvals/invoices', 'Duyệt điều chỉnh'],
    ],
  ],
  [
    'Báo cáo',
    [
      ['reports', 'Báo cáo'],
      ['activity', 'Hoạt động'],
    ],
  ],
]
export function OwnerLayout() {
  const user = useSession((s) => s.user!),
    location = useLocation(),
    navigate = useNavigate(),
    [params, setParams] = useSearchParams(),
    busy = useIsMutating() > 0
  const selected = useOwnerSelection((s) => s.selected[user.id] || ''),
    select = useOwnerSelection((s) => s.select)
  const verification = useQuery({
    queryKey: ['owner-verification', user.id],
    queryFn: ownerApi.verification,
    refetchInterval: 3000,
    retry: false,
  })
  const gatePage = ['/owner/onboarding', '/owner/verification'].includes(location.pathname)
  const branches = useQuery({
    queryKey: ['owner-branches', user.id],
    queryFn: ownerApi.branchOptions,
    enabled: !!verification.data?.eligible,
    retry: false,
    refetchInterval: 3000,
  })
  const scope = params.has('branchId') ? params.get('branchId') || '' : selected
  const allowed = !scope || branches.data?.some((b) => b.id === scope)
  useEffect(() => {
    if (verification.data && !verification.data.eligible)
      queryClient.removeQueries({
        predicate: (q) =>
          q.queryKey[0] === 'owner' ||
          q.queryKey[0] === 'owner-branches' ||
          q.queryKey[0] === 'manager',
      })
  }, [verification.data])
  if (gatePage) return <Outlet />
  return (
    <Container className="py-7 sm:py-10">
      <QueryState
        pending={verification.isPending}
        error={verification.error}
        retry={verification.refetch}
      >
        {!verification.data?.eligible ? (
          <Notice tone="warning">
            Cần hoàn tất xác minh và được cấp quyền chủ trọ.{' '}
            <Link className="font-bold underline" to="/owner/verification">
              Xem hồ sơ
            </Link>
          </Notice>
        ) : (
          <QueryState pending={branches.isPending} error={branches.error} retry={branches.refetch}>
            <div className="grid min-w-0 gap-8 lg:grid-cols-[205px_minmax(0,1fr)]">
              <aside className="min-w-0">
                <p className="mb-5 flex items-center gap-2 text-sm font-bold text-primary">
                  <Building2 size={20} />
                  KHÔNG GIAN CHỦ TRỌ
                </p>
                <label
                  htmlFor="owner-scope"
                  className="mb-2 block text-xs font-bold text-muted-foreground"
                >
                  PHẠM VI CHI NHÁNH
                </label>
                <select
                  id="owner-scope"
                  className="input max-w-full"
                  value={scope}
                  disabled={busy}
                  onChange={(e) => {
                    select(user.id, e.target.value)
                    setParams((p) => {
                      if (e.target.value) p.set('branchId', e.target.value)
                      else p.delete('branchId')
                      p.delete('page')
                      return p
                    })
                  }}
                >
                  <option value="">Tất cả chi nhánh</option>
                  {branches.data?.map((b) => (
                    <option value={b.id} key={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <nav aria-label="Điều hướng chủ trọ" className="mt-5 hidden lg:block">
                  {groups.map(([group, items]) => (
                    <div className="mb-4" key={group}>
                      <p className="mb-1 px-3 text-[11px] font-bold uppercase text-muted-foreground">
                        {group}
                      </p>
                      {items.map(([path, label]) => (
                        <NavLink
                          key={path}
                          to={`/owner/${path}${scope ? `?branchId=${scope}` : ''}`}
                          className={({ isActive }) =>
                            `flex min-h-11 items-center rounded-lg px-3 text-sm ${isActive ? 'bg-primary-soft font-bold text-primary' : 'text-muted-foreground hover:bg-surface'}`
                          }
                        >
                          {label}
                        </NavLink>
                      ))}
                    </div>
                  ))}
                </nav>
                <select
                  aria-label="Điều hướng chủ trọ"
                  className="input mt-3 lg:hidden"
                  value={
                    groups
                      .flatMap(([, items]) => items)
                      .find(([p]) => location.pathname.startsWith(`/owner/${p}`))?.[0] ||
                    'dashboard'
                  }
                  onChange={(e) =>
                    navigate(`/owner/${e.target.value}${scope ? `?branchId=${scope}` : ''}`)
                  }
                >
                  {groups.map(([group, items]) => (
                    <optgroup label={group} key={group}>
                      {items.map(([p, label]) => (
                        <option value={p} key={p}>
                          {label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {scope && allowed && (
                  <Button className="mt-4 w-full" asChild>
                    <Link to={operationsLink(scope)}>
                      Vận hành chi nhánh
                      <ArrowUpRight size={16} />
                    </Link>
                  </Button>
                )}
                <div className="mt-5 flex flex-wrap gap-4 text-xs font-bold text-primary">
                  <Link to="/notifications">Thông báo</Link>
                  <Link to="/profile">Hồ sơ</Link>
                  <Link to="/user/dashboard">Tài khoản</Link>
                  <Link to="/owner/verification">Xác minh</Link>
                </div>
              </aside>
              <main className="min-w-0">
                {allowed ? (
                  <Outlet context={{ branches: branches.data || [], scope }} />
                ) : (
                  <Notice tone="warning">
                    Bạn không có quyền với chi nhánh trong liên kết này.{' '}
                    <Button
                      variant="ghost"
                      onClick={() => {
                        select(user.id, '')
                        setParams({})
                      }}
                    >
                      Về tất cả chi nhánh
                    </Button>
                  </Notice>
                )}
              </main>
            </div>
          </QueryState>
        )}
      </QueryState>
    </Container>
  )
}
