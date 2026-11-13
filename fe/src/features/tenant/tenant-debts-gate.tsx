import { Container } from '@/components/common/container'
import { useSession } from '@/features/auth/session-store'
import { TenantPage } from '@/features/tenant/components'
import { useTenant } from '@/features/tenant/context'
import type { Tenancy } from '@/interfaces/tenant'
import { dateOnly } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import {
  branchTenantsService,
  type TenantDebtItem,
} from '@/services/branch-tenants'
import { tenantApi } from '@/services/tenant'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock,
  Droplets,
  FileText,
  History,
  Sparkles,
  UserRound,
  Zap,
} from 'lucide-react'
import { type ReactNode, useMemo } from 'react'
import { Link } from 'react-router'

function matchesTenancy(item: TenantDebtItem, t: Tenancy): boolean {
  if (t.contractId && item.contractId && t.contractId === item.contractId) return true
  if (t.id && (item.contractId === t.id || item.contractTenantId === t.id)) return true
  if (t.roomId && item.roomId && t.roomId === item.roomId) return true
  if (
    t.roomName &&
    item.roomNumber &&
    t.roomName.trim().toLowerCase() === item.roomNumber.trim().toLowerCase()
  ) {
    return true
  }
  return false
}

export function useTenantDebtsQuery(enabled: boolean) {
  const user = useSession((s) => s.user)
  return useQuery({
    queryKey: ['tenant-own-debts', user?.id, user?.email],
    queryFn: () => branchTenantsService.debts({ size: 50 }, 'tenant'),
    enabled: enabled && Boolean(user),
    refetchInterval: 10000,
  })
}

export function TenantOverdueGate({ children }: { children?: ReactNode }) {
  const user = useSession((s) => s.user)
  const isTenantOnly = Boolean(
    user &&
      user.roles.includes('TENANT') &&
      !user.roles.some((r) => r === 'OWNER' || r === 'MANAGER' || r === 'ADMIN'),
  )

  const tenanciesQuery = useQuery<Tenancy[]>({
    queryKey: ['tenant', user?.id, 'tenancies', null],
    queryFn: tenantApi.tenancies,
    enabled: isTenantOnly,
  })
  const debtsQuery = useTenantDebtsQuery(isTenantOnly)
  const rawItems = debtsQuery.data?.content ?? []
  const activeTenancies = tenanciesQuery.data ?? []

  const items =
    activeTenancies.length > 0
      ? rawItems.filter((item) => activeTenancies.some((t) => matchesTenancy(item, t)))
      : rawItems

  const unpaidOverdueItems = items.filter((item) => item.remainingAmount > 0 && item.overdue)

  const overdueRoomNames = Array.from(
    new Set(
      unpaidOverdueItems
        .map((item) => item.roomNumber?.trim())
        .filter((room): room is string => Boolean(room)),
    ),
  )

  const bannerMessage =
    overdueRoomNames.length <= 1
      ? `Bạn đang trễ hạn trả tiền của phòng ${overdueRoomNames[0] || 'đang thuê'}`
      : `Bạn đang trễ hạn trả tiền của các phòng ${overdueRoomNames.join(', ')}`

  return (
    <>
      {isTenantOnly && unpaidOverdueItems.length > 0 && (
        <div
          role="alert"
          className="border-y border-danger/25 bg-[#fde8e8] px-4 py-2 text-danger shadow-2xs"
        >
          <Container wide className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="size-4 shrink-0 text-danger" />
              <span>{bannerMessage}.</span>
            </div>
            <Link
              to="/tenant/debts"
              className="text-xs font-bold text-danger underline hover:opacity-80"
            >
              Xem chi tiết & trả công nợ →
            </Link>
          </Container>
        </div>
      )}
      {children}
    </>
  )
}

export default function TenantDebtsPage() {
  const user = useSession((s) => s.user)
  const tenantCtx = useTenant() as { tenancy?: Tenancy; tenancies?: Tenancy[] } | undefined
  const activeTenancy = tenantCtx?.tenancy
  const contextTenancies = tenantCtx?.tenancies

  const fallbackTenanciesQuery = useQuery<Tenancy[]>({
    queryKey: ['tenant', user?.id, 'tenancies', null],
    queryFn: tenantApi.tenancies,
    enabled: Boolean(user) && !contextTenancies,
  })
  const tenancies = contextTenancies ?? fallbackTenanciesQuery.data ?? []

  const debtsQuery = useTenantDebtsQuery(Boolean(user))

  const currentDebt = useMemo(() => {
    const raw = debtsQuery.data?.content ?? []
    if (activeTenancy) {
      const matched = raw.find((item) => matchesTenancy(item, activeTenancy))
      if (matched) return matched
    }
    if (tenancies.length > 0) {
      const matched = raw.find((item) => tenancies.some((t) => matchesTenancy(item, t)))
      if (matched) return matched
    }
    return raw[0] ?? null
  }, [debtsQuery.data, activeTenancy, tenancies])

  const periodRows = currentDebt?.periodHistory ?? []
  const totalLateDays = periodRows.reduce((sum, r) => sum + r.overdueDays, 0)
  const totalReminders = periodRows.reduce((sum, r) => sum + r.reminderCount, 0)

  const roomLabel = currentDebt?.roomNumber || activeTenancy?.roomName || 'đang thuê'
  const branchLabel = currentDebt?.branchName || activeTenancy?.branchName || 'Cơ sở'
  const contractStartLabel =
    currentDebt?.contractStartDate || activeTenancy?.startDate
      ? dateOnly(currentDebt?.contractStartDate || activeTenancy?.startDate || '')
      : '—'
  const contractEndLabel =
    currentDebt?.contractEndDate || activeTenancy?.endDate
      ? dateOnly(currentDebt?.contractEndDate || activeTenancy?.endDate || '')
      : 'Đang mở'

  return (
    <TenantPage
      title={`Chi tiết công nợ — Phòng ${roomLabel}`}
      description={
        currentDebt
          ? `${branchLabel} · Hợp đồng ${currentDebt.contractNumber || 'Đang hiệu lực'} (${contractStartLabel} → ${contractEndLabel})`
          : `Chi tiết công nợ phòng ${roomLabel} tại ${branchLabel}`
      }
    >
      {debtsQuery.isLoading ? (
        <div className="rounded-2xl border border-border bg-surface py-10 text-center text-sm text-muted-foreground">
          Đang tải chi tiết công nợ...
        </div>
      ) : debtsQuery.isError ? (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          Không tải được chi tiết công nợ:{' '}
          {debtsQuery.error instanceof Error ? debtsQuery.error.message : 'Lỗi không xác định'}
        </div>
      ) : !currentDebt ? (
        <div className="rounded-2xl border border-border bg-surface py-10 text-center text-sm text-muted-foreground">
          Hiện tại phòng {roomLabel} không có khoản công nợ nào.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Thanh trạng thái kỳ hiện tại */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-danger/40 bg-danger/10 p-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-danger px-2.5 py-0.5 font-bold text-white">
                  <AlertTriangle className="size-3.5" />
                  Trễ hạn {currentDebt.overdueDays} ngày
                </span>
                <span className="text-muted-foreground">
                  <CalendarClock className="mr-1 inline size-3.5" />
                  Hạn trả: <strong className="text-foreground">{dateOnly(currentDebt.dueDate)}</strong>
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Tổng phát sinh kỳ {currentDebt.period}:{' '}
                <strong className="text-foreground">{formatVnd(currentDebt.totalAmount)}</strong> · Đã
                trả: <strong className="text-foreground">{formatVnd(currentDebt.paidAmount)}</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="text-right">
                <p className="text-xs uppercase text-muted-foreground">Còn chưa trả</p>
                <p
                  className={`text-xl font-bold ${
                    currentDebt.remainingAmount > 0 ? 'text-danger' : 'text-success'
                  }`}
                >
                  {formatVnd(currentDebt.remainingAmount)}
                </p>
              </div>
            </div>
          </div>

          {/* Bố cục 2 cột hiển thị trực tiếp chi tiết công nợ hiện tại & hợp đồng */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Cột trái: Bóc tách chi phí công nợ */}
            <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-primary">
                1. Bóc tách công nợ kỳ hiện tại ({currentDebt.period})
              </h2>

              <div className="divide-y divide-border text-sm">
                <div className="py-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">
                      Chi phí phòng ({currentDebt.roomNumber})
                    </span>
                    <span className="font-bold">{formatVnd(currentDebt.roomRentAmount)}</span>
                  </div>
                </div>

                <div className="py-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">Dịch vụ đã đăng ký</span>
                    <span className="font-bold">
                      {formatVnd(currentDebt.registeredServicesAmount)}
                    </span>
                  </div>
                  {currentDebt.registeredServices.length > 0 && (
                    <div className="rounded-xl bg-background p-2.5 space-y-1.5 text-xs">
                      {currentDebt.registeredServices.map((svc, idx) => (
                        <div
                          key={`${svc.name}-${idx}`}
                          className="flex items-center justify-between"
                        >
                          <span className="inline-flex items-center gap-1.5 text-foreground">
                            <Sparkles className="size-3 text-primary" />
                            {svc.name} ({svc.quantity} {svc.unit})
                          </span>
                          <span className="font-bold">{formatVnd(svc.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">Điện & nước chưa trả</span>
                    <span className="font-bold text-warning">
                      {formatVnd(currentDebt.unpaidUtilityAmount)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-background p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Zap className="size-3.5 text-warning" /> Tiền điện:
                      </span>
                      <span className="font-bold">{formatVnd(currentDebt.electricityAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Droplets className="size-3.5 text-info" /> Tiền nước:
                      </span>
                      <span className="font-bold">{formatVnd(currentDebt.waterAmount)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2.5 flex items-center justify-between">
                  <span className="font-bold text-foreground">Tổng hoá đơn kỳ này</span>
                  <span className="font-bold text-foreground">
                    {formatVnd(currentDebt.totalAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Cột phải: Thông tin người thuê & hợp đồng thuê */}
            <div className="rounded-2xl border border-border bg-surface p-4 space-y-4">
              <div className="space-y-2">
                <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                  <UserRound className="size-4" />
                  2. Thông tin người thuê
                </h2>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Họ và tên</dt>
                    <dd className="font-bold">{currentDebt.tenantName}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Số điện thoại</dt>
                    <dd className="font-bold">{currentDebt.tenantPhone || '—'}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="font-medium break-all">{currentDebt.tenantEmail || '—'}</dd>
                  </div>
                </dl>
              </div>

              <div className="border-t border-border pt-3 space-y-2">
                <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                  <FileText className="size-4" />
                  3. Thông tin hợp đồng thuê
                </h2>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Mã hợp đồng</dt>
                    <dd className="font-bold">{currentDebt.contractNumber || 'Đang hiệu lực'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Hạn trả hàng tháng</dt>
                    <dd className="font-bold">Ngày {currentDebt.paymentDueDay ?? 5} hàng tháng</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Thời hạn thuê</dt>
                    <dd className="font-medium">
                      {contractStartLabel} → {contractEndLabel}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Tiền đặt cọc</dt>
                    <dd className="font-bold">
                      {formatVnd(currentDebt.contractDepositAmount ?? currentDebt.roomRentAmount)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          {/* Lịch sử công nợ theo từng kỳ của hợp đồng */}
          <section className="rounded-2xl border border-border bg-surface p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold">
                  <History className="size-4 text-primary" />
                  Lịch sử công nợ theo hợp đồng ({currentDebt.contractNumber || 'Đang thuê'})
                </h2>
                <p className="text-xs text-muted-foreground">
                  Thời hạn hợp đồng: <strong className="text-foreground">{contractStartLabel}</strong>{' '}
                  → <strong className="text-foreground">{contractEndLabel}</strong> ({periodRows.length} kỳ)
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2.5 py-0.5 font-bold text-danger">
                  <AlertTriangle className="size-3.5" />
                  Tổng {totalLateDays} ngày trễ
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 font-bold text-warning">
                  <BellRing className="size-3.5" />
                  Đã được nhắc {totalReminders} lần
                </span>
              </div>
            </div>

            {periodRows.length === 0 ? (
              <p className="rounded-xl bg-surface px-3 py-2 text-xs text-muted-foreground">
                Chưa có kỳ hoá đơn nào của hợp đồng này.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="whitespace-nowrap pb-3 pr-4">Kỳ</th>
                      <th className="whitespace-nowrap pb-3 pr-4">Hạn trả</th>
                      <th className="whitespace-nowrap pb-3 pr-4">Tổng tiền</th>
                      <th className="whitespace-nowrap pb-3 pr-4">Đã trả</th>
                      <th className="whitespace-nowrap pb-3 pr-4">Còn nợ</th>
                      <th className="whitespace-nowrap pb-3 pr-4">Trễ</th>
                      <th className="whitespace-nowrap pb-3 pr-4">Số lần nhắc</th>
                      <th className="whitespace-nowrap pb-3 pr-4">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {periodRows.map((row) => {
                      const isCurrent = row.period === currentDebt.period && row.invoiceId === currentDebt.id
                      const paid = row.status === 'PAID' || row.remainingAmount === 0
                      return (
                        <tr key={row.invoiceId || row.period} className={isCurrent ? 'bg-primary-soft/25' : ''}>
                          <td className="whitespace-nowrap py-3 pr-4 font-bold">
                            Kỳ {row.period}
                            {isCurrent && (
                              <span className="ml-1.5 rounded bg-primary-soft px-1.5 py-0.5 text-[11px] font-bold text-primary">
                                Kỳ hiện tại
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap py-3 pr-4">
                            {row.dueDate ? dateOnly(row.dueDate) : '—'}
                          </td>
                          <td className="whitespace-nowrap py-3 pr-4">{formatVnd(row.totalAmount)}</td>
                          <td className="whitespace-nowrap py-3 pr-4 text-success">{formatVnd(row.paidAmount)}</td>
                          <td
                            className={`whitespace-nowrap py-3 pr-4 font-bold ${
                              row.remainingAmount > 0 ? 'text-danger' : 'text-muted-foreground'
                            }`}
                          >
                            {formatVnd(row.remainingAmount)}
                          </td>
                          <td className="whitespace-nowrap py-3 pr-4">
                            {row.overdueDays > 0 ? (
                              <span className="font-bold text-danger">{row.overdueDays} ngày</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap py-3 pr-4">{row.reminderCount}</td>
                          <td className="whitespace-nowrap py-3 pr-4">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                paid
                                  ? 'bg-success/15 text-success'
                                  : row.overdueDays > 0
                                    ? 'bg-danger/15 text-danger'
                                    : 'bg-warning/15 text-warning'
                              }`}
                            >
                              {paid ? (
                                <>
                                  <CheckCircle2 className="size-3.5" />
                                  Đã trả đủ
                                </>
                              ) : row.overdueDays > 0 ? (
                                <>
                                  <AlertTriangle className="size-3.5" />
                                  Trễ hạn
                                </>
                              ) : (
                                <>
                                  <Clock className="size-3.5" />
                                  Chưa trả
                                </>
                              )}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </TenantPage>
  )
}
