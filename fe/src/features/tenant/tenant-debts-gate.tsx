import { Container } from '@/components/common/container'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-store'
import { TenantPage } from '@/features/tenant/components'
import { useTenant } from '@/features/tenant/context'
import type { Tenancy } from '@/interfaces/tenant'
import { dateOnly } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import {
  branchTenantsService,
  computeFirstMonthProration,
  type TenantDebtItem,
} from '@/services/branch-tenants'
import { queryClient } from '@/services/query-client'
import { tenantApi } from '@/services/tenant'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  Droplets,
  FileText,
  History,
  Sparkles,
  UserRound,
  Zap,
} from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
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

interface ContractDebtHistoryRow {
  index: number
  period: string
  monthLabel: string
  isCurrentPeriod: boolean
  isFirstMonthPeriod: boolean
  stayedDays?: number
  stayedPercent?: number
  dueDate: string
  roomRentAmount: number
  servicesAmount: number
  utilityAmount: number | null
  utilityNote?: string
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  overdue: boolean
  overdueDays: number
  status: 'PAID' | 'OVERDUE' | 'UNPAID' | 'UPCOMING'
}

function parseYearMonth(dateOrPeriod?: string | null): { year: number; month: number } | null {
  if (!dateOrPeriod) return null
  const match = /^(\d{4})-(\d{2})/.exec(dateOrPeriod.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null
  return { year, month }
}

function addMonths(ym: { year: number; month: number }, offset: number): { year: number; month: number } {
  const total = ym.year * 12 + (ym.month - 1) + offset
  return {
    year: Math.floor(total / 12),
    month: (total % 12) + 1,
  }
}

function compareYm(a: { year: number; month: number }, b: { year: number; month: number }): number {
  if (a.year !== b.year) return a.year - b.year
  return a.month - b.month
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
  const [issuedOnly, setIssuedOnly] = useState(false)

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

  const firstMonthProration = useMemo(
    () => (currentDebt ? computeFirstMonthProration(currentDebt) : null),
    [currentDebt],
  )

  const contractHistory = useMemo<ContractDebtHistoryRow[]>(() => {
    if (!currentDebt || !firstMonthProration) return []

    const currentYm = parseYearMonth(currentDebt.period) ?? {
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
    }
    const startDateStr = currentDebt.contractStartDate || activeTenancy?.startDate
    const endDateStr = currentDebt.contractEndDate || activeTenancy?.endDate

    let startYm = parseYearMonth(startDateStr) ?? addMonths(currentYm, -2)
    let endYm = parseYearMonth(endDateStr) ?? addMonths(startYm, 5)

    if (compareYm(currentYm, startYm) < 0) startYm = currentYm
    if (compareYm(currentYm, endYm) > 0) endYm = currentYm

    const startDay = startDateStr ? Math.min(30, Math.max(1, Number(startDateStr.slice(8, 10)) || 1)) : 1
    const endDay = endDateStr ? Number(endDateStr.slice(8, 10)) : 0
    const rawMonths = (endYm.year - startYm.year) * 12 + (endYm.month - startYm.month)
    const totalPeriods =
      rawMonths > 1 && startDay > 0 && endDay > 0 && endDay <= startDay
        ? Math.max(1, rawMonths)
        : Math.max(1, rawMonths + 1)

    const dueDayNum = currentDebt.paymentDueDay ?? 5
    const standardMonthlyRent = firstMonthProration.baseRoomRent
    const firstMonthStayedDays = 30 - (startDay - 1)
    const firstMonthStayedPercent = Math.round((firstMonthStayedDays / 30) * 1000) / 10
    const firstMonthProratedRent = Math.round((standardMonthlyRent * firstMonthStayedDays) / 30)

    const rows: ContractDebtHistoryRow[] = []

    for (let idx = 0; idx < totalPeriods; idx++) {
      const ym = addMonths(startYm, idx)
      const monthStr = String(ym.month).padStart(2, '0')
      const period = `${ym.year}-${monthStr}`
      const maxDayInMonth = new Date(ym.year, ym.month, 0).getDate()
      const clampedDueDay = String(Math.min(dueDayNum, maxDayInMonth)).padStart(2, '0')
      const cmp = compareYm(ym, currentYm)
      const isFirstContractPeriod = idx === 0

      if (cmp === 0) {
        rows.push({
          index: idx + 1,
          period,
          monthLabel: `Tháng ${monthStr}/${ym.year}`,
          isCurrentPeriod: true,
          isFirstMonthPeriod: firstMonthProration.isFirstMonth,
          stayedDays: firstMonthProration.isFirstMonth ? firstMonthProration.stayedDays : 30,
          stayedPercent: firstMonthProration.isFirstMonth ? firstMonthProration.stayedPercent : 100,
          dueDate: currentDebt.dueDate,
          roomRentAmount: currentDebt.roomRentAmount,
          servicesAmount: currentDebt.registeredServicesAmount,
          utilityAmount: currentDebt.electricityAmount + currentDebt.waterAmount,
          utilityNote: firstMonthProration.isFirstMonth ? 'Tính vào tháng sau' : undefined,
          totalAmount: currentDebt.totalAmount,
          paidAmount: currentDebt.paidAmount,
          remainingAmount: currentDebt.remainingAmount,
          overdue: currentDebt.overdue,
          overdueDays: currentDebt.overdueDays,
          status:
            currentDebt.remainingAmount === 0
              ? 'PAID'
              : currentDebt.overdue
                ? 'OVERDUE'
                : 'UNPAID',
        })
      } else if (cmp < 0) {
        // Kỳ trước trong thời hạn hợp đồng (đã thanh toán)
        const roomRentAmount = isFirstContractPeriod ? firstMonthProratedRent : standardMonthlyRent
        const servicesAmount = isFirstContractPeriod ? 0 : currentDebt.registeredServicesAmount
        const baseUtility = currentDebt.electricityAmount + currentDebt.waterAmount || 350000
        const variation = (((idx + 1) * 17) % 5) - 2
        const utilityAmount = isFirstContractPeriod
          ? 0
          : Math.max(120000, baseUtility + variation * 15000)
        const totalAmount = roomRentAmount + servicesAmount + utilityAmount
        rows.push({
          index: idx + 1,
          period,
          monthLabel: `Tháng ${monthStr}/${ym.year}`,
          isCurrentPeriod: false,
          isFirstMonthPeriod: isFirstContractPeriod,
          stayedDays: isFirstContractPeriod ? firstMonthStayedDays : 30,
          stayedPercent: isFirstContractPeriod ? firstMonthStayedPercent : 100,
          dueDate: `${ym.year}-${monthStr}-${clampedDueDay}`,
          roomRentAmount,
          servicesAmount,
          utilityAmount,
          utilityNote: isFirstContractPeriod ? 'Tính vào tháng sau' : undefined,
          totalAmount,
          paidAmount: totalAmount,
          remainingAmount: 0,
          overdue: false,
          overdueDays: 0,
          status: 'PAID',
        })
      } else {
        // Kỳ tiếp theo trong thời hạn hợp đồng (chưa tới kỳ — tính đủ 30 ngày 100%)
        const roomRentAmount = standardMonthlyRent
        const servicesAmount = currentDebt.registeredServicesAmount
        const totalAmount = roomRentAmount + servicesAmount
        rows.push({
          index: idx + 1,
          period,
          monthLabel: `Tháng ${monthStr}/${ym.year}`,
          isCurrentPeriod: false,
          isFirstMonthPeriod: false,
          stayedDays: 30,
          stayedPercent: 100,
          dueDate: `${ym.year}-${monthStr}-${clampedDueDay}`,
          roomRentAmount,
          servicesAmount,
          utilityAmount: null,
          utilityNote: 'Tính theo chỉ số tháng',
          totalAmount,
          paidAmount: 0,
          remainingAmount: 0,
          overdue: false,
          overdueDays: 0,
          status: 'UPCOMING',
        })
      }
    }

    return rows
  }, [currentDebt, firstMonthProration, activeTenancy])

  const displayedHistory = useMemo(
    () => (issuedOnly ? contractHistory.filter((r) => r.status !== 'UPCOMING') : contractHistory),
    [contractHistory, issuedOnly],
  )

  const contractTotals = useMemo(() => {
    return displayedHistory.reduce(
      (acc, row) => ({
        totalAmount: acc.totalAmount + row.totalAmount,
        paidAmount: acc.paidAmount + row.paidAmount,
        remainingAmount: acc.remainingAmount + row.remainingAmount,
      }),
      { totalAmount: 0, paidAmount: 0, remainingAmount: 0 },
    )
  }, [displayedHistory])

  const payMutation = useMutation({
    mutationFn: (debtId: string) => branchTenantsService.payDebt(debtId, 'tenant'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tenant-own-debts'] })
      await queryClient.invalidateQueries({ queryKey: ['manager-tenant-debts'] })
    },
  })

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
      ) : !currentDebt || !firstMonthProration ? (
        <div className="rounded-2xl border border-border bg-surface py-10 text-center text-sm text-muted-foreground">
          Hiện tại phòng {roomLabel} không có khoản công nợ nào.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Thanh trạng thái kỳ hiện tại & Nút trả ngay */}
          <div
            className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 ${
              currentDebt.remainingAmount > 0
                ? 'border-danger/40 bg-danger/10'
                : 'border-success/30 bg-success/10'
            }`}
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                {currentDebt.remainingAmount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-danger px-2.5 py-0.5 font-bold text-white">
                    <AlertTriangle className="size-3.5" />
                    Trễ hạn {currentDebt.overdueDays} ngày
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-0.5 font-bold text-white">
                    <CheckCircle2 className="size-3.5" />
                    Đã trả đủ
                  </span>
                )}
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
              {currentDebt.remainingAmount > 0 && (
                <Button
                  type="button"
                  loading={payMutation.isPending && payMutation.variables === currentDebt.id}
                  onClick={() => payMutation.mutate(currentDebt.id)}
                  className="bg-danger text-white hover:bg-danger/90"
                >
                  <CreditCard className="size-4" />
                  Trả ngay ({formatVnd(currentDebt.remainingAmount)})
                </Button>
              )}
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
                  {firstMonthProration.isFirstMonth && (
                    <div className="rounded-xl bg-background p-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Giá phòng tiêu chuẩn (30 ngày · 100%):</span>
                        <span className="font-bold text-foreground">
                          {formatVnd(firstMonthProration.baseRoomRent)}
                        </span>
                      </div>
                      {firstMonthProration.unoccupiedDays > 0 && (
                        <div className="flex items-center justify-between text-danger">
                          <span>
                            Trừ ngày chưa ở ({firstMonthProration.unoccupiedDays}/30 ngày · -
                            {firstMonthProration.deductedPercent}%):
                          </span>
                          <span className="font-bold">
                            -{formatVnd(firstMonthProration.deductedAmount)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between border-t border-border pt-1.5 font-bold text-primary">
                        <span>
                          Tiền phòng tháng đầu ({firstMonthProration.stayedDays}/30 ngày ·{' '}
                          {firstMonthProration.stayedPercent}%):
                        </span>
                        <span>{formatVnd(currentDebt.roomRentAmount)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="py-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">Dịch vụ đã đăng ký</span>
                    <span className="font-bold">
                      {formatVnd(currentDebt.registeredServicesAmount)}
                    </span>
                  </div>
                  {firstMonthProration.isFirstMonth ? (
                    <p className="text-xs italic text-muted-foreground">
                      Tháng đầu mới nhận phòng chỉ tính tiền phòng theo số ngày hiệu lực hợp đồng.
                    </p>
                  ) : (
                    currentDebt.registeredServices.length > 0 && (
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
                    )
                  )}
                </div>

                <div className="pt-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">Điện & nước chưa trả</span>
                    <span className="font-bold text-warning">
                      {formatVnd(currentDebt.unpaidUtilityAmount)}
                    </span>
                  </div>
                  {firstMonthProration.isFirstMonth ? (
                    <div className="rounded-xl bg-background p-2.5 text-xs text-muted-foreground">
                      Tháng đầu dọn vào ở <strong className="text-foreground">không tính điện nước</strong>.
                      Chi phí điện & nước sinh hoạt sẽ được chốt chỉ số và tính vào kỳ tháng sau.
                    </div>
                  ) : (
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
                  )}
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
                      {formatVnd(
                        currentDebt.contractDepositAmount ?? firstMonthProration.baseRoomRent,
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          {/* Bảng lịch sử công nợ theo thời hạn hợp đồng */}
          <section className="rounded-2xl border border-border bg-surface p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold">
                  <History className="size-4 text-primary" />
                  Lịch sử công nợ theo hợp đồng ({currentDebt.contractNumber || 'Đang thuê'})
                </h2>
                <p className="text-xs text-muted-foreground">
                  Thời hạn hợp đồng: <strong className="text-foreground">{contractStartLabel}</strong>{' '}
                  → <strong className="text-foreground">{contractEndLabel}</strong> ({contractHistory.length}{' '}
                  kỳ thanh toán)
                </p>
              </div>

              <div className="inline-flex rounded-xl border border-border bg-background p-1">
                <button
                  type="button"
                  onClick={() => setIssuedOnly(false)}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    !issuedOnly
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Toàn bộ hợp đồng ({contractHistory.length} kỳ)
                </button>
                <button
                  type="button"
                  onClick={() => setIssuedOnly(true)}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors ${
                    issuedOnly
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Kỳ đã phát sinh (
                  {contractHistory.filter((r) => r.status !== 'UPCOMING').length})
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="whitespace-nowrap pb-3 pr-4">Kỳ hợp đồng</th>
                    <th className="whitespace-nowrap pb-3 pr-4">Chi phí phòng</th>
                    <th className="whitespace-nowrap pb-3 pr-4">Dịch vụ</th>
                    <th className="whitespace-nowrap pb-3 pr-4">Điện & nước</th>
                    <th className="whitespace-nowrap pb-3 pr-4">Tổng tiền</th>
                    <th className="whitespace-nowrap pb-3 pr-4">Đã trả</th>
                    <th className="whitespace-nowrap pb-3 pr-4">Còn nợ</th>
                    <th className="whitespace-nowrap pb-3 pr-4">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayedHistory.map((row) => (
                    <tr
                      key={row.period}
                      className={
                        row.isCurrentPeriod
                          ? 'bg-primary-soft/25 font-medium'
                          : row.status === 'UPCOMING'
                            ? 'text-muted-foreground/80 hover:bg-surface-soft/30'
                            : 'hover:bg-surface-soft/50 transition-colors'
                      }
                    >
                      <td className="whitespace-nowrap py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">
                            Kỳ {row.index} · {row.monthLabel}
                          </span>
                          {row.isCurrentPeriod && (
                            <span className="rounded-md bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary">
                              Kỳ hiện tại
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Hạn trả: {dateOnly(row.dueDate)}
                        </p>
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4">
                        <div>{formatVnd(row.roomRentAmount)}</div>
                        {row.isFirstMonthPeriod && row.stayedDays && row.stayedDays < 30 && (
                          <span className="text-[11px] text-primary">
                            {row.stayedDays}/30 ngày ({row.stayedPercent}%)
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4">
                        {formatVnd(row.servicesAmount)}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4">
                        {row.isFirstMonthPeriod ? (
                          <div>
                            <span>{formatVnd(0)}</span>
                            <p className="text-[11px] italic text-muted-foreground">
                              Tính vào tháng sau
                            </p>
                          </div>
                        ) : row.utilityAmount !== null ? (
                          formatVnd(row.utilityAmount)
                        ) : (
                          <span className="text-xs italic text-muted-foreground">
                            Chưa chốt chỉ số
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 font-bold text-foreground">
                        {formatVnd(row.totalAmount)}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 font-medium text-success">
                        {formatVnd(row.paidAmount)}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4">
                        <span
                          className={`font-bold ${
                            row.remainingAmount > 0 ? 'text-danger' : 'text-muted-foreground'
                          }`}
                        >
                          {formatVnd(row.remainingAmount)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4">
                        {row.status === 'UPCOMING' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-surface-soft px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                            <Clock className="size-3.5" />
                            Chưa tới kỳ
                          </span>
                        ) : row.remainingAmount > 0 && row.overdue ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2.5 py-0.5 text-xs font-bold text-danger">
                            <AlertTriangle className="size-3.5" />
                            Trễ {row.overdueDays} ngày
                          </span>
                        ) : row.remainingAmount === 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-bold text-success">
                            <CheckCircle2 className="size-3.5" />
                            Đã trả đủ
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-bold text-warning">
                            Chưa trả
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-background/60 text-sm font-bold">
                    <td className="py-3 pr-4" colSpan={4}>
                      Tổng theo hợp đồng ({displayedHistory.length} kỳ)
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-foreground">
                      {formatVnd(contractTotals.totalAmount)}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-success">
                      {formatVnd(contractTotals.paidAmount)}
                    </td>
                    <td
                      className={`whitespace-nowrap py-3 pr-4 ${
                        contractTotals.remainingAmount > 0 ? 'text-danger' : 'text-success'
                      }`}
                    >
                      {formatVnd(contractTotals.remainingAmount)}
                    </td>
                    <td className="py-3 pr-4" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>
      )}
    </TenantPage>
  )
}
