import { Modal } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-store'
import { dateOnly } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import {
  branchTenantsService,
  computeFirstMonthProration,
  type TenantDebtItem,
} from '@/services/branch-tenants'
import { queryClient } from '@/services/query-client'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Droplets,
  FileText,
  Home,
  RotateCcw,
  Search,
  Sparkles,
  UserRound,
  Zap,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { ManagerPage } from './components'
import { useManager } from './context'

export function ManagerDebts() {
  const { branch } = useManager()
  const user = useSession((s) => s.user)
  const isOwner = Boolean(user?.roles.includes('OWNER'))
  const branchId = branch?.id
  const feature = isOwner ? 'owner' : 'manager'

  const [keyword, setKeyword] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const debtsQuery = useQuery({
    queryKey: ['manager-tenant-debts', feature, branchId, keyword.trim(), overdueOnly],
    queryFn: () =>
      branchTenantsService.debts(
        {
          branchId: branchId || undefined,
          keyword: keyword.trim() || undefined,
          overdueOnly: overdueOnly || undefined,
          size: 100,
        },
        feature,
      ),
  })

  const payMutation = useMutation({
    mutationFn: (debtId: string) => branchTenantsService.payDebt(debtId, feature),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['manager-tenant-debts'] })
      await queryClient.invalidateQueries({ queryKey: ['tenant-own-debts'] })
    },
  })

  const unpayMutation = useMutation({
    mutationFn: (debtId: string) => branchTenantsService.unpayDebt(debtId, feature),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['manager-tenant-debts'] })
      await queryClient.invalidateQueries({ queryKey: ['tenant-own-debts'] })
    },
  })

  const items = useMemo(() => debtsQuery.data?.content ?? [], [debtsQuery.data])
  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedId || i.contractTenantId === selectedId) ?? null,
    [items, selectedId],
  )

  const summary = useMemo(() => {
    const overdueTenants = items.filter((item) => item.overdue).length
    const totalRoomRent = items.reduce((sum, item) => sum + (item.roomRentAmount ?? 0), 0)
    const totalUtilityUnpaid = items.reduce((sum, item) => sum + (item.unpaidUtilityAmount ?? 0), 0)
    const totalRemaining = items.reduce((sum, item) => sum + (item.remainingAmount ?? 0), 0)
    return {
      totalTenants: items.length,
      overdueTenants,
      totalRoomRent,
      totalUtilityUnpaid,
      totalRemaining,
    }
  }, [items])

  return (
    <ManagerPage
      title="Công nợ"
      description="Theo dõi công nợ thu gọn theo từng phòng & người thuê. Bấm Chi tiết để xem đầy đủ chi phí phòng, dịch vụ, điện nước cùng hồ sơ người thuê và hợp đồng."
    >
      {/* Compact Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="whitespace-nowrap text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Người thuê đang ở
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">{summary.totalTenants}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="whitespace-nowrap text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Đang trễ hạn trả
          </p>
          <p className="mt-1 text-2xl font-bold text-danger">{summary.overdueTenants}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="whitespace-nowrap text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Tổng chi phí phòng
          </p>
          <p className="mt-1 text-xl font-bold text-foreground">
            {formatVnd(summary.totalRoomRent)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="whitespace-nowrap text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Tổng điện nước chưa trả
          </p>
          <p className="mt-1 text-xl font-bold text-warning">
            {formatVnd(summary.totalUtilityUnpaid)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="whitespace-nowrap text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Tổng công nợ chưa trả
          </p>
          <p className="mt-1 text-xl font-bold text-danger">
            {formatVnd(summary.totalRemaining)}
          </p>
        </div>
      </div>

      {/* Compact Main Table */}
      <section className="rounded-3xl border border-border bg-surface p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Danh sách công nợ người thuê</h2>
            <p className="text-xs text-muted-foreground">
              {isOwner
                ? 'Bảng tóm tắt công nợ theo phòng. Bấm vào nút Chi tiết để xem bảng bóc tách phí và thông tin hợp đồng / người thuê.'
                : 'Bảng tóm tắt công nợ trong cơ sở. Bấm vào nút Chi tiết để xem bảng bóc tách phí và thông tin hợp đồng / người thuê.'}
            </p>
          </div>
          <div className="inline-flex shrink-0 rounded-xl border border-border bg-background p-1">
            <button
              type="button"
              onClick={() => setOverdueOnly(false)}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                !overdueOnly
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Tất cả người thuê ({summary.totalTenants})
            </button>
            <button
              type="button"
              onClick={() => setOverdueOnly(true)}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                overdueOnly
                  ? 'bg-danger text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Đang trễ hạn ({summary.overdueTenants})
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm theo phòng, tên người thuê, mã hợp đồng, SĐT hoặc email..."
            className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>

        {debtsQuery.isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Đang tải danh sách công nợ...
          </div>
        ) : debtsQuery.isError ? (
          <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
            Không tải được danh sách công nợ:{' '}
            {debtsQuery.error instanceof Error ? debtsQuery.error.message : 'Lỗi không xác định'}
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {overdueOnly
              ? 'Hiện không có người thuê nào đang trễ hạn trả.'
              : 'Chưa có công nợ người thuê nào trong cơ sở này.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="whitespace-nowrap pb-3 pr-4">Phòng</th>
                  <th className="whitespace-nowrap pb-3 pr-4">Người thuê</th>
                  <th className="whitespace-nowrap pb-3 pr-4">Hợp đồng</th>
                  <th className="whitespace-nowrap pb-3 pr-4">Trạng thái thời gian trễ</th>
                  <th className="whitespace-nowrap pb-3 pr-8">Số tiền</th>
                  <th className="whitespace-nowrap pb-3 pr-4">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item: TenantDebtItem) => (
                  <tr
                    key={item.id}
                    className="align-middle hover:bg-surface-soft/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedId(item.id)}
                  >
                    {/* Phòng */}
                    <td className="whitespace-nowrap py-3.5 pr-4">
                      <span className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">
                        <Home className="size-3.5" />
                        Phòng {item.roomNumber || '—'}
                      </span>
                    </td>

                    {/* Người thuê */}
                    <td className="whitespace-nowrap py-3.5 pr-4 font-bold text-foreground">
                      {item.tenantName}
                    </td>

                    {/* Hợp đồng */}
                    <td className="whitespace-nowrap py-3.5 pr-4 font-medium text-foreground">
                      {item.contractNumber || 'Đang thuê'}
                    </td>

                    {/* Trạng thái thời gian trễ */}
                    <td className="whitespace-nowrap py-3.5 pr-4">
                      {item.overdue && item.overdueDays > 0 ? (
                        <div className="inline-flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2.5 py-0.5 text-xs font-bold text-danger">
                            <AlertTriangle className="size-3.5" />
                            Trễ {item.overdueDays} ngày
                          </span>
                          <span className="text-xs text-muted-foreground">
                            (từ {dateOnly(item.dueDate)})
                          </span>
                        </div>
                      ) : item.remainingAmount === 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-bold text-success">
                          <CheckCircle2 className="size-3.5" />
                          Đã trả đủ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-bold text-success">
                          Đúng hạn · {dateOnly(item.dueDate)}
                        </span>
                      )}
                    </td>

                    {/* Số tiền */}
                    <td className="whitespace-nowrap py-3.5 pr-8">
                      <span
                        className={`text-base font-bold ${
                          item.remainingAmount > 0 ? 'text-danger' : 'text-success'
                        }`}
                      >
                        {formatVnd(item.remainingAmount)}
                      </span>
                    </td>

                    {/* Thao tác */}
                    <td
                      className="whitespace-nowrap py-3.5 pr-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedId(item.id)}
                      >
                        Chi tiết
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal Chi tiết Công nợ + Thông tin Người thuê & Hợp đồng (gọn, không cuộn dọc) */}
      <Modal
        open={Boolean(selectedItem)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
        wide
        title={
          selectedItem
            ? `Chi tiết công nợ — Phòng ${selectedItem.roomNumber || '—'} | ${selectedItem.tenantName}`
            : 'Chi tiết công nợ'
        }
        description={
          selectedItem
            ? `${selectedItem.branchName || 'Cơ sở'} · Kỳ ${selectedItem.period}`
            : undefined
        }
      >
        {selectedItem && (
          <div className="space-y-3.5">
            {/* Thanh trạng thái thu gọn */}
            <div
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                selectedItem.remainingAmount > 0
                  ? 'border-danger/40 bg-danger/10'
                  : 'border-success/30 bg-success/10'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                {selectedItem.remainingAmount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-danger px-2.5 py-0.5 font-bold text-white">
                    <AlertTriangle className="size-3.5" />
                    Trễ hạn {selectedItem.overdueDays} ngày
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-0.5 font-bold text-white">
                    <CheckCircle2 className="size-3.5" />
                    Đã trả đủ
                  </span>
                )}
                <span className="text-muted-foreground">
                  <CalendarClock className="mr-1 inline size-3.5" />
                  Hạn trả: <strong className="text-foreground">{dateOnly(selectedItem.dueDate)}</strong>
                </span>
                <span className="text-muted-foreground">
                  · Tổng kỳ:{' '}
                  <strong className="text-foreground">{formatVnd(selectedItem.totalAmount)}</strong>
                </span>
                {selectedItem.paidAmount > 0 && (
                  <span className="text-muted-foreground">
                    · Đã trả:{' '}
                    <strong className="text-foreground">{formatVnd(selectedItem.paidAmount)}</strong>
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xs uppercase text-muted-foreground">Còn chưa trả:</span>
                <span
                  className={`text-lg font-bold ${
                    selectedItem.remainingAmount > 0 ? 'text-danger' : 'text-success'
                  }`}
                >
                  {formatVnd(selectedItem.remainingAmount)}
                </span>
              </div>
            </div>

            {/* Bố cục 2 cột ngang để không phải cuộn dọc */}
            <div className="grid gap-3.5 lg:grid-cols-2">
              {/* Cột trái: Bóc tách chi phí công nợ */}
              {(() => {
                const proration = computeFirstMonthProration(selectedItem)
                return (
                  <div className="rounded-xl border border-border bg-surface p-3.5 space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                      1. Bóc tách công nợ kỳ {selectedItem.period}
                    </h3>

                    <div className="divide-y divide-border text-xs">
                      {/* Chi phí phòng */}
                      <div className="py-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground">
                            Chi phí phòng ({selectedItem.roomNumber})
                          </span>
                          <span className="text-sm font-bold">
                            {formatVnd(selectedItem.roomRentAmount)}
                          </span>
                        </div>
                        {proration.isFirstMonth && (
                          <div className="rounded-lg bg-background px-2.5 py-2 space-y-1">
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>Giá phòng tiêu chuẩn (30 ngày · 100%)</span>
                              <span className="font-bold text-foreground">
                                {formatVnd(proration.baseRoomRent)}
                              </span>
                            </div>
                            {proration.unoccupiedDays > 0 && (
                              <div className="flex items-center justify-between text-danger">
                                <span>
                                  Trừ {proration.unoccupiedDays}/30 ngày chưa ở (-
                                  {proration.deductedPercent}%)
                                </span>
                                <span className="font-bold">
                                  -{formatVnd(proration.deductedAmount)}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center justify-between text-primary font-bold">
                              <span>
                                Thực ở tháng đầu ({proration.stayedDays}/30 ngày ·{' '}
                                {proration.stayedPercent}%)
                              </span>
                              <span>{formatVnd(selectedItem.roomRentAmount)}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Dịch vụ đã đăng ký */}
                      <div className="py-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground">Dịch vụ đã đăng ký</span>
                          <span className="text-sm font-bold">
                            {formatVnd(selectedItem.registeredServicesAmount)}
                          </span>
                        </div>
                        {proration.isFirstMonth ? (
                          <p className="text-[11px] italic text-muted-foreground">
                            Tháng đầu dọn vào ở chỉ tính tiền phòng theo ngày hiệu lực hợp đồng.
                          </p>
                        ) : (
                          selectedItem.registeredServices.length > 0 && (
                            <div className="rounded-lg bg-background px-2.5 py-2 space-y-1">
                              {selectedItem.registeredServices.map((svc, idx) => (
                                <div
                                  key={`${svc.name}-${idx}`}
                                  className="flex items-center justify-between text-muted-foreground"
                                >
                                  <span className="inline-flex items-center gap-1.5 text-foreground">
                                    <Sparkles className="size-3 text-primary" />
                                    {svc.name} ({svc.quantity} {svc.unit})
                                  </span>
                                  <span className="font-bold text-foreground">
                                    {formatVnd(svc.amount)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )
                        )}
                      </div>

                      {/* Tổng tiền điện nước chưa trả */}
                      <div className="pt-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground">Điện & nước chưa trả</span>
                          <span className="text-sm font-bold text-warning">
                            {formatVnd(selectedItem.unpaidUtilityAmount)}
                          </span>
                        </div>
                        {proration.isFirstMonth ? (
                          <p className="rounded-lg bg-background px-2.5 py-1.5 text-[11px] italic text-muted-foreground">
                            Tháng đầu mới nhận phòng chưa tính điện nước (sẽ chốt và tính vào kỳ
                            tháng sau).
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 rounded-lg bg-background px-2.5 py-2">
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <Zap className="size-3 text-warning" /> Điện:
                              </span>
                              <span className="font-bold">
                                {formatVnd(selectedItem.electricityAmount)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <Droplets className="size-3 text-info" /> Nước:
                              </span>
                              <span className="font-bold">
                                {formatVnd(selectedItem.waterAmount)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Cột phải: Thông tin người thuê & hợp đồng (đã lược bỏ thông tin thừa) */}
              <div className="rounded-xl border border-border bg-surface p-3.5 space-y-3">
                <div className="space-y-1.5">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                    <UserRound className="size-3.5" />
                    2. Người thuê
                  </h3>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Họ và tên</dt>
                      <dd className="font-bold">{selectedItem.tenantName}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Số điện thoại</dt>
                      <dd className="font-bold">{selectedItem.tenantPhone || '—'}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Email</dt>
                      <dd className="font-medium break-all">{selectedItem.tenantEmail || '—'}</dd>
                    </div>
                  </dl>
                </div>

                <div className="border-t border-border pt-2.5 space-y-1.5">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                    <FileText className="size-3.5" />
                    3. Hợp đồng thuê
                  </h3>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Mã hợp đồng</dt>
                      <dd className="font-bold">{selectedItem.contractNumber || 'Đang hiệu lực'}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Hạn trả hàng tháng</dt>
                      <dd className="font-bold">Ngày {selectedItem.paymentDueDay ?? 5}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Thời hạn thuê</dt>
                      <dd className="font-medium">
                        {selectedItem.contractStartDate
                          ? dateOnly(selectedItem.contractStartDate)
                          : '—'}{' '}
                        →{' '}
                        {selectedItem.contractEndDate
                          ? dateOnly(selectedItem.contractEndDate)
                          : 'Đang mở'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Tiền đặt cọc</dt>
                      <dd className="font-bold">
                        {formatVnd(selectedItem.contractDepositAmount ?? selectedItem.roomRentAmount)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-end gap-2 border-t border-border pt-2.5">
              <Button type="button" size="sm" variant="outline" onClick={() => setSelectedId(null)}>
                Đóng
              </Button>
              {selectedItem.remainingAmount > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  loading={payMutation.isPending && payMutation.variables === selectedItem.id}
                  onClick={() => payMutation.mutate(selectedItem.id)}
                >
                  <CheckCircle2 className="size-4" />
                  Xác nhận đã thu ({formatVnd(selectedItem.remainingAmount)})
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  loading={unpayMutation.isPending && unpayMutation.variables === selectedItem.id}
                  onClick={() => unpayMutation.mutate(selectedItem.id)}
                >
                  <RotateCcw className="size-4 text-warning" />
                  Đặt lại chưa thu
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </ManagerPage>
  )
}
