import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Calendar,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  Phone,
  Save,
  Search,
  User as UserIcon,
  CheckCircle2,
  ArrowRight,
  Building2,
  BookmarkCheck,
  Layers,
  Banknote,
} from 'lucide-react'
import {
  Page,
  Panel,
  Field,
  InlineError,
  Notice,
  QueryState,
  RecordStatus,
} from '@/components/common/page'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { profileSchema, changePasswordSchema, today } from '@/lib/validation'
import { profileService, authService, appointmentService, bookingService } from '@/services/guest-user'
import { viewingDependenciesService } from '@/services/viewing-dependencies'
import { provider } from '@/services/config'
import { useSession } from '@/features/auth/session-store'
import { viewingDateTime } from '@/features/leasing/viewing-time'
import { formatVnd, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { User } from '@/interfaces/domain'

type ProfileFormData = z.infer<typeof profileSchema>
type ChangePasswordFormData = z.infer<typeof changePasswordSchema>

interface UpcomingAppointmentItem {
  id: string
  roomId: string
  roomTitle: string
  branchName: string
  startAt: string
  endAt?: string
  status: string
  shiftType?: string
  contactPhone?: string
  canCancel: boolean
}

interface UpcomingBookingItem {
  id: string
  roomId: string
  roomTitle: string
  branchName: string
  slotLabel?: string | null
  rentalMode: string
  startDate: string
  endDate: string
  holdAmount: number
  status: string
  paymentDueAt?: string
  temporaryHoldUntil?: string
  depositStatus?: string
  canCancel: boolean
}

/* =========================================================================
   1. DASHBOARD: TỔNG QUAN LỊCH XEM PHÒNG & GIỮ CHỖ (MỞ RỘNG RỘNG RÃI)
   ========================================================================= */
function OverviewDashboard() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'appointments' | 'bookings'>('appointments')

  // State hủy cuộc hẹn
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState('')

  // State hủy giữ chỗ
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null)
  const [cancelBookingError, setCancelBookingError] = useState('')

  // 1. Query Lịch hẹn xem phòng
  const appointmentsQuery = useQuery({
    queryKey: ['upcoming-appointments-dashboard'],
    queryFn: async (): Promise<UpcomingAppointmentItem[]> => {
      if (provider('viewing') === 'real') {
        const res = await viewingDependenciesService.appointments({ page: 1, size: 20 })
        return res.content.map((item) => ({
          id: item.id,
          roomId: item.roomId,
          roomTitle: item.roomNumber ? `Phòng ${item.roomNumber}` : 'Phòng xem lịch hẹn',
          branchName: item.branchName || 'Chi nhánh hệ thống',
          startAt: item.startAt || `${item.appointmentDate}T09:00:00Z`,
          endAt: item.endAt || undefined,
          status: item.status,
          shiftType: item.shiftType || undefined,
          contactPhone: item.contactPhone || item.publicContactPhone || undefined,
          canCancel: item.allowedActions.includes('CANCEL'),
        }))
      }

      const mockRes = await appointmentService.list('', 1)
      return mockRes.content.map((item) => ({
        id: item.id,
        roomId: item.roomId,
        roomTitle: item.roomTitle,
        branchName: item.branchName,
        startAt: item.startAt,
        endAt: item.endAt,
        status: item.status,
        shiftType: undefined,
        contactPhone: undefined,
        canCancel: ['PENDING', 'CONFIRMED'].includes(item.status),
      }))
    },
    refetchInterval: 30000,
  })

  // 2. Query Yêu cầu đặt phòng & giữ chỗ
  const bookingsQuery = useQuery({
    queryKey: ['upcoming-bookings-dashboard'],
    queryFn: async (): Promise<UpcomingBookingItem[]> => {
      const res = await bookingService.list('', 1)
      return res.content.map((item) => ({
        id: item.id,
        roomId: 'roomId' in item && typeof item.roomId === 'string' ? item.roomId : item.id,
        roomTitle: item.roomTitle,
        branchName: item.branchName,
        slotLabel: item.slotLabel,
        rentalMode: item.rentalMode,
        startDate: item.startDate,
        endDate: item.endDate,
        holdAmount: item.holdAmount,
        status: item.status,
        paymentDueAt: item.paymentDueAt,
        temporaryHoldUntil: item.temporaryHoldUntil,
        depositStatus: item.depositStatus,
        canCancel: ['PENDING', 'REQUESTED', 'AWAITING_PAYMENT'].includes(item.status),
      }))
    },
    refetchInterval: 30000,
  })

  // Mutation Hủy cuộc hẹn
  const cancelAppointmentMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      if (provider('viewing') === 'real') {
        return viewingDependenciesService.actOnAppointment(id, 'CANCEL', {
          cancellationReason: reason || 'Người xem yêu cầu hủy',
          cancellationCause: 'TENANT_REQUEST',
        })
      }
      return appointmentService.cancel(id)
    },
    onSuccess: () => {
      setCancellingAppointmentId(null)
      setCancelReason('')
      setCancelError('')
      queryClient.invalidateQueries({ queryKey: ['upcoming-appointments-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['viewing-appointments'] })
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
    },
    onError: (err: unknown) => {
      setCancelError(err instanceof Error ? err.message : 'Không thể hủy lịch hẹn.')
    },
  })

  // Mutation Hủy giữ chỗ
  const cancelBookingMutation = useMutation({
    mutationFn: async (id: string) => bookingService.cancel(id),
    onSuccess: () => {
      setCancellingBookingId(null)
      setCancelBookingError('')
      queryClient.invalidateQueries({ queryKey: ['upcoming-bookings-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
    onError: (err: unknown) => {
      setCancelBookingError(err instanceof Error ? err.message : 'Không thể hủy yêu cầu giữ chỗ.')
    },
  })

  const allAppointments = appointmentsQuery.data || []
  const activeAppointments = allAppointments.filter(
    (item) => !['REJECTED', 'CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(item.status),
  )

  const allBookings = bookingsQuery.data || []
  const activeBookings = allBookings.filter(
    (item) => !['REJECTED', 'CANCELLED', 'EXPIRED'].includes(item.status),
  )

  // Quick stats numbers
  const confirmedAppointments = activeAppointments.filter((i) => i.status === 'CONFIRMED').length
  const pendingAppointments = activeAppointments.filter((i) => i.status === 'PENDING').length
  const pendingBookings = activeBookings.filter((i) => ['PENDING', 'REQUESTED'].includes(i.status)).length
  const totalPending = pendingAppointments + pendingBookings

  const getAppointmentBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <StatusBadge tone="success">Đã xác nhận</StatusBadge>
      case 'PENDING':
        return <StatusBadge tone="warning">Chờ duyệt</StatusBadge>
      case 'COMPLETED':
        return <StatusBadge tone="info">Đã xem phòng</StatusBadge>
      default:
        return <StatusBadge tone="neutral">{status}</StatusBadge>
    }
  }

  return (
    <section className="space-y-6">
      {/* 4 Thẻ thống kê tổng quan mở rộng */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/70 bg-surface p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Lịch hẹn xem phòng
            </span>
            <div className="rounded-lg bg-primary-soft p-2 text-primary">
              <Calendar className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{activeAppointments.length}</span>
            <span className="text-xs text-muted-foreground">cuộc hẹn</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Lịch hẹn đang có hiệu lực</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-surface p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Lịch hẹn đã xác nhận
            </span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
              <CheckCircle2 className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">{confirmedAppointments}</span>
            <span className="text-xs text-muted-foreground">lịch sẵn sàng</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Quản lý đã xếp lịch tiếp đón</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-surface p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Yêu cầu giữ chỗ & cọc
            </span>
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600">
              <BookmarkCheck className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-600">{activeBookings.length}</span>
            <span className="text-xs text-muted-foreground">phòng đang giữ</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Phòng đang giữ chỗ / đặt trước</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-surface p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Đang chờ xử lý
            </span>
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600">
              <Clock className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600">{totalPending}</span>
            <span className="text-xs text-muted-foreground">yêu cầu</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Đang chờ quản lý xác nhận</p>
        </div>
      </div>

      {/* Panel chính: Bảng danh sách Mở Rộng Rộng Rãi với 2 Tab chuyển đổi */}
      <Panel className="p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Layers className="size-5 text-primary" />
              Tổng quan Lịch xem phòng & Đặt giữ chỗ
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Theo dõi toàn bộ lịch hẹn xem thực tế và các yêu cầu đặt giữ phòng trọ của bạn trên toàn hệ thống.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'appointments' ? (
              <Link
                to="/user/appointments"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                Xem tất cả lịch sử xem phòng ({allAppointments.length})
                <ArrowRight size={14} />
              </Link>
            ) : (
              <Link
                to="/user/bookings"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                Xem tất cả yêu cầu giữ chỗ ({allBookings.length})
                <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-border/60 gap-8 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('appointments')}
            className={cn(
              'flex items-center gap-2 pb-3.5 text-sm font-bold border-b-2 transition-all cursor-pointer',
              activeTab === 'appointments'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Calendar className="size-4" />
            <span>Lịch hẹn xem phòng</span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-semibold transition-colors',
                activeTab === 'appointments'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {activeAppointments.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bookings')}
            className={cn(
              'flex items-center gap-2 pb-3.5 text-sm font-bold border-b-2 transition-all cursor-pointer',
              activeTab === 'bookings'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <BookmarkCheck className="size-4" />
            <span>Yêu cầu giữ chỗ & đặt phòng</span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-semibold transition-colors',
                activeTab === 'bookings'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {activeBookings.length}
            </span>
          </button>
        </div>

        {/* TAB 1: LỊCH HẸN XEM PHÒNG - MỞ RỘNG RỘNG RÃI */}
        {activeTab === 'appointments' && (
          <QueryState
            pending={appointmentsQuery.isPending}
            error={appointmentsQuery.error}
            retry={appointmentsQuery.refetch}
          >
            {activeAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 rounded-full bg-muted/60 p-4 text-muted-foreground">
                  <Calendar className="size-8" />
                </div>
                <h3 className="text-sm font-bold text-foreground">
                  Bạn chưa có lịch hẹn xem phòng nào sắp tới
                </h3>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Đặt lịch hẹn để trực tiếp khảo sát phòng trọ và không gian sống trước khi đưa ra quyết định thuê.
                </p>
                <Button asChild variant="outline" className="mt-5">
                  <Link to="/rooms">
                    <Search size={15} />
                    Khám phá phòng ngay
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {activeAppointments.map((item) => (
                  <div
                    key={item.id}
                    className="group relative flex flex-col lg:flex-row lg:items-center justify-between rounded-xl border border-border/70 bg-surface/50 p-5 transition-all hover:border-primary/50 hover:bg-surface hover:shadow-xs gap-4"
                  >
                    {/* Cột trái: Tên phòng & Chi nhánh */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-3.5">
                        <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                          <Calendar className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-foreground text-base truncate">
                            <Link
                              to={`/rooms/${item.roomId}`}
                              className="hover:text-primary transition-colors hover:underline"
                            >
                              {item.roomTitle}
                            </Link>
                          </h4>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Building2 className="size-3.5 shrink-0" />
                            <span className="truncate">{item.branchName}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Cột giữa: Thời gian & Liên hệ */}
                    <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground lg:border-x lg:border-border/60 lg:px-8">
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Thời gian xem phòng
                        </span>
                        <p className="flex items-center gap-1.5 font-bold text-foreground text-sm">
                          <Clock className="size-4 text-primary shrink-0" />
                          <span>{viewingDateTime(item.startAt)}</span>
                        </p>
                      </div>

                      {item.contactPhone && (
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Điện thoại liên hệ
                          </span>
                          <p className="flex items-center gap-1.5 font-medium text-foreground">
                            <Phone className="size-3.5 text-muted-foreground shrink-0" />
                            <span>{item.contactPhone}</span>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Cột phải: Trạng thái & Thao tác */}
                    <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-border/50">
                      {getAppointmentBadge(item.status)}

                      <div className="flex items-center gap-2">
                        <Button asChild variant="outline" className="text-xs h-8 px-3">
                          <Link to={`/user/appointments/${item.id}`}>
                            Chi tiết
                            <ArrowRight size={12} />
                          </Link>
                        </Button>

                        {item.canCancel && (
                          <button
                            type="button"
                            onClick={() => {
                              setCancellingAppointmentId(item.id)
                              setCancelError('')
                              setCancelReason('')
                            }}
                            className="text-xs text-muted-foreground hover:text-destructive transition-colors underline px-1"
                          >
                            Hủy hẹn
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Modal xác nhận hủy nhanh */}
                    {cancellingAppointmentId === item.id && (
                      <div className="absolute inset-0 z-10 flex flex-col justify-center rounded-xl bg-surface/95 p-5 backdrop-blur-xs">
                        <p className="text-xs font-bold text-foreground mb-1">
                          Xác nhận hủy lịch xem phòng này?
                        </p>
                        <input
                          className="input text-xs mb-2"
                          placeholder="Lý do hủy (tùy chọn)..."
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                        />
                        {cancelError && (
                          <p className="text-[11px] text-destructive mb-2">{cancelError}</p>
                        )}
                        <div className="flex gap-2">
                          <Button
                            loading={cancelAppointmentMutation.isPending}
                            onClick={() =>
                              cancelAppointmentMutation.mutate({ id: item.id, reason: cancelReason })
                            }
                            className="text-xs h-8 px-3 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Đồng ý hủy
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setCancellingAppointmentId(null)}
                            disabled={cancelAppointmentMutation.isPending}
                            className="text-xs h-8 px-3"
                          >
                            Đóng
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </QueryState>
        )}

        {/* TAB 2: YÊU CẦU GIỮ CHỖ & ĐẶT PHÒNG - MỞ RỘNG RỘNG RÃI */}
        {activeTab === 'bookings' && (
          <QueryState
            pending={bookingsQuery.isPending}
            error={bookingsQuery.error}
            retry={bookingsQuery.refetch}
          >
            {activeBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 rounded-full bg-muted/60 p-4 text-muted-foreground">
                  <BookmarkCheck className="size-8" />
                </div>
                <h3 className="text-sm font-bold text-foreground">
                  Bạn chưa có yêu cầu đặt phòng hay giữ chỗ nào
                </h3>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Khi bạn tìm được phòng ưng ý, gửi yêu cầu đặt chỗ để giữ căn phòng trước khi người khác thuê.
                </p>
                <Button asChild variant="outline" className="mt-5">
                  <Link to="/rooms">
                    <Search size={15} />
                    Khám phá phòng ngay
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {activeBookings.map((item) => (
                  <div
                    key={item.id}
                    className="group relative flex flex-col lg:flex-row lg:items-center justify-between rounded-xl border border-border/70 bg-surface/50 p-5 transition-all hover:border-primary/50 hover:bg-surface hover:shadow-xs gap-4"
                  >
                    {/* Cột trái: Tên phòng & Chi nhánh & Slot */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-3.5">
                        <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                          <BookmarkCheck className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-foreground text-base truncate">
                              <Link
                                to={`/user/bookings/${item.id}`}
                                className="hover:text-primary transition-colors hover:underline"
                              >
                                {item.roomTitle}
                              </Link>
                            </h4>
                            {item.slotLabel && (
                              <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground shrink-0">
                                {item.slotLabel}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Building2 className="size-3.5 shrink-0" />
                            <span className="truncate">{item.branchName}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Cột giữa: Khoảng thời gian thuê & Tiền giữ chỗ */}
                    <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground lg:border-x lg:border-border/60 lg:px-8">
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Thời gian dự kiến thuê
                        </span>
                        <p className="flex items-center gap-1.5 font-bold text-foreground text-sm">
                          <Calendar className="size-4 text-primary shrink-0" />
                          <span>
                            {formatDate(item.startDate)} → {formatDate(item.endDate)}
                          </span>
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Tiền cọc / Giữ chỗ
                        </span>
                        <p className="flex items-center gap-1 font-bold text-emerald-600 text-sm">
                          <Banknote className="size-4 shrink-0" />
                          <span>{formatVnd(item.holdAmount)}</span>
                        </p>
                      </div>
                    </div>

                    {/* Cột phải: Trạng thái & Thao tác */}
                    <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-border/50">
                      <RecordStatus status={item.status} />

                      <div className="flex items-center gap-2">
                        <Button asChild variant="outline" className="text-xs h-8 px-3">
                          <Link to={`/user/bookings/${item.id}`}>
                            Chi tiết
                            <ArrowRight size={12} />
                          </Link>
                        </Button>

                        {item.status === 'AWAITING_PAYMENT' && (
                          <Button asChild className="text-xs h-8 px-3">
                            <Link to={`/user/bookings/${item.id}`}>
                              Thanh toán cọc
                            </Link>
                          </Button>
                        )}

                        {item.canCancel && (
                          <button
                            type="button"
                            onClick={() => {
                              setCancellingBookingId(item.id)
                              setCancelBookingError('')
                            }}
                            className="text-xs text-muted-foreground hover:text-destructive transition-colors underline px-1"
                          >
                            Hủy giữ chỗ
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Modal xác nhận hủy giữ chỗ */}
                    {cancellingBookingId === item.id && (
                      <div className="absolute inset-0 z-10 flex flex-col justify-center rounded-xl bg-surface/95 p-5 backdrop-blur-xs">
                        <p className="text-xs font-bold text-foreground mb-1">
                          Xác nhận hủy yêu cầu giữ chỗ này?
                        </p>
                        <p className="text-xs text-muted-foreground mb-3">
                          Hành động này sẽ giải phóng phòng/chỗ đang giữ cho người thuê khác.
                        </p>
                        {cancelBookingError && (
                          <p className="text-[11px] text-destructive mb-2">{cancelBookingError}</p>
                        )}
                        <div className="flex gap-2">
                          <Button
                            loading={cancelBookingMutation.isPending}
                            onClick={() => cancelBookingMutation.mutate(item.id)}
                            className="text-xs h-8 px-3 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Đồng ý hủy
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setCancellingBookingId(null)}
                            disabled={cancelBookingMutation.isPending}
                            className="text-xs h-8 px-3"
                          >
                            Đóng
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </QueryState>
        )}
      </Panel>
    </section>
  )
}

/* =========================================================================
   2. FORM: SỬA HỌ TÊN, SỐ ĐIỆN THOẠI & EMAIL KHÓA CỨNG (MỞ RỘNG)
   ========================================================================= */
function ProfileInfoForm({ user }: { user: User }) {
  const queryClient = useQueryClient()
  const [saved, setSaved] = useState(false)
  const defaultValues: ProfileFormData = {
    fullName: user.fullName || '',
    phone: user.phone || '',
    dateOfBirth: user.dateOfBirth || '',
    gender: (['MALE', 'FEMALE', 'OTHER'].includes(user.gender || '') ? user.gender : '') as ProfileFormData['gender'],
  }

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues,
  })

  useEffect(() => {
    if (!form.formState.isDirty) {
      form.reset({
        fullName: user.fullName || '',
        phone: user.phone || '',
        dateOfBirth: user.dateOfBirth || '',
        gender: (['MALE', 'FEMALE', 'OTHER'].includes(user.gender || '') ? user.gender : '') as ProfileFormData['gender'],
      })
    }
  }, [user.fullName, user.phone, user.dateOfBirth, user.gender, form])

  const update = useMutation({
    mutationFn: profileService.update,
    onSuccess: (data) => {
      useSession.getState().updateUser(data)
      queryClient.setQueryData(['profile', user.id], data)
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      setSaved(true)
      form.reset({
        fullName: data.fullName,
        phone: data.phone || '',
        dateOfBirth: data.dateOfBirth || '',
        gender: (data.gender || '') as ProfileFormData['gender'],
      })
    },
  })

  return (
    <Panel className="p-6">
      <form
        className="grid gap-5"
        noValidate
        onChange={() => setSaved(false)}
        onSubmit={form.handleSubmit((values) => update.mutate(values))}
      >
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <UserIcon className="size-5 text-primary" />
          <h2 className="font-bold text-base text-foreground">Thông tin cá nhân</h2>
        </div>

        {/* EMAIL KHÓA CỨNG - CHỈ ĐƯỢC XEM */}
        <div className="rounded-lg border border-border/80 bg-muted/30 p-4">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Lock className="size-3.5 text-muted-foreground" />
              Email tài khoản (Khóa cố định)
            </label>
            <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">
              Chỉ xem
            </span>
          </div>
          <input
            id="profile-email-readonly"
            className="input mt-1.5 bg-muted/60 text-muted-foreground cursor-not-allowed select-none font-medium"
            value={user.email}
            type="email"
            readOnly
            disabled
            aria-readonly="true"
          />
          <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed flex items-start gap-1">
            <Lock className="size-3 shrink-0 mt-0.5 text-muted-foreground" />
            <span>
              Email là định danh tài khoản chính và được sử dụng để xác thực hợp đồng thuê. Trường này được khóa cứng để đảm bảo tính an toàn.
            </span>
          </p>
        </div>

        {/* HỌ VÀ TÊN - CÓ THỂ SỬA */}
        <Field
          id="profile-fullname"
          label="Họ và tên"
          error={form.formState.errors.fullName?.message}
          hint="Tên hiển thị trên hồ sơ thuê phòng và thông tin liên hệ."
        >
          <div className="relative">
            <UserIcon className="absolute top-3 left-3 size-4 text-muted-foreground" />
            <input
              id="profile-fullname"
              className="input pl-10"
              autoComplete="name"
              placeholder="Nhập họ và tên đầy đủ"
              {...form.register('fullName')}
              aria-invalid={!!form.formState.errors.fullName}
            />
          </div>
        </Field>

        {/* SỐ ĐIỆN THOẠI - CÓ THỂ SỬA */}
        <Field
          id="profile-phone"
          label="Số điện thoại"
          error={form.formState.errors.phone?.message}
          hint="Số điện thoại liên hệ để quản lý liên lạc khi xem phòng."
        >
          <div className="relative">
            <Phone className="absolute top-3 left-3 size-4 text-muted-foreground" />
            <input
              id="profile-phone"
              className="input pl-10"
              type="tel"
              autoComplete="tel"
              placeholder="VD: 0912345678"
              {...form.register('phone')}
              aria-invalid={!!form.formState.errors.phone}
            />
          </div>
        </Field>

        {/* NGÀY SINH & GIỚI TÍNH */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="profile-birth"
            label="Ngày sinh (tùy chọn)"
            error={form.formState.errors.dateOfBirth?.message}
          >
            <input
              id="profile-birth"
              className="input"
              type="date"
              max={today()}
              {...form.register('dateOfBirth')}
            />
          </Field>

          <Field id="profile-gender" label="Giới tính (tùy chọn)">
            <select id="profile-gender" className="input" {...form.register('gender')}>
              <option value="">Không cung cấp</option>
              <option value="MALE">Nam</option>
              <option value="FEMALE">Nữ</option>
              <option value="OTHER">Khác</option>
            </select>
          </Field>
        </div>

        <InlineError error={update.error} />
        {saved && <Notice tone="success">Đã cập nhật thông tin cá nhân thành công!</Notice>}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            type="submit"
            loading={update.isPending}
            disabled={!form.formState.isDirty}
          >
            <Save />
            Lưu thông tin cá nhân
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={update.isPending || !form.formState.isDirty}
            onClick={() => {
              form.reset(defaultValues)
              setSaved(false)
            }}
          >
            Hủy thay đổi
          </Button>
        </div>
      </form>
    </Panel>
  )
}

/* =========================================================================
   3. FORM: ĐỔI MẬT KHẨU (THU NHỎ GỌN GÀNG)
   ========================================================================= */
function ChangePasswordForm() {
  const [success, setSuccess] = useState(false)
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const form = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  const mutation = useMutation({
    mutationFn: (values: ChangePasswordFormData) => authService.changePassword(values),
    onSuccess: () => {
      setSuccess(true)
      form.reset()
    },
  })

  return (
    <Panel className="p-6">
      <form
        className="grid gap-4"
        noValidate
        onSubmit={form.handleSubmit((values) => {
          setSuccess(false)
          mutation.mutate(values)
        })}
      >
        <div className="border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" />
            <h2 className="font-bold text-base text-foreground">Đổi mật khẩu tài khoản</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Bắt buộc phải nhập chính xác mật khẩu cũ thì mới được phép đổi sang mật khẩu mới.
          </p>
        </div>

        {/* MẬT KHẨU CŨ - BẮT BUỘC */}
        <Field
          id="pwd-old"
          label="Mật khẩu cũ (Hiện tại)"
          error={form.formState.errors.oldPassword?.message}
          hint="Mật khẩu hiện tại của tài khoản."
        >
          <div className="relative">
            <input
              id="pwd-old"
              className="input pr-10"
              type={showOld ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Nhập mật khẩu hiện tại"
              {...form.register('oldPassword')}
              aria-invalid={!!form.formState.errors.oldPassword}
            />
            <button
              type="button"
              className="absolute top-2.5 right-3 text-muted-foreground hover:text-foreground"
              onClick={() => setShowOld(!showOld)}
              tabIndex={-1}
              aria-label={showOld ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        {/* MẬT KHẨU MỚI */}
        <Field
          id="pwd-new"
          label="Mật khẩu mới"
          error={form.formState.errors.newPassword?.message}
          hint="Tối thiểu 8 ký tự, gồm chữ hoa, thường, số & ký tự đặc biệt."
        >
          <div className="relative">
            <input
              id="pwd-new"
              className="input pr-10"
              type={showNew ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Nhập mật khẩu mới"
              {...form.register('newPassword')}
              aria-invalid={!!form.formState.errors.newPassword}
            />
            <button
              type="button"
              className="absolute top-2.5 right-3 text-muted-foreground hover:text-foreground"
              onClick={() => setShowNew(!showNew)}
              tabIndex={-1}
              aria-label={showNew ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        {/* XÁC NHẬN MẬT KHẨU MỚI */}
        <Field
          id="pwd-confirm"
          label="Xác nhận mật khẩu mới"
          error={form.formState.errors.confirmPassword?.message}
        >
          <div className="relative">
            <input
              id="pwd-confirm"
              className="input pr-10"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu mới"
              {...form.register('confirmPassword')}
              aria-invalid={!!form.formState.errors.confirmPassword}
            />
            <button
              type="button"
              className="absolute top-2.5 right-3 text-muted-foreground hover:text-foreground"
              onClick={() => setShowConfirm(!showConfirm)}
              tabIndex={-1}
              aria-label={showConfirm ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        <InlineError error={mutation.error} />
        {success && <Notice tone="success">Đã cập nhật mật khẩu mới thành công!</Notice>}

        <div className="pt-1">
          <Button
            type="submit"
            className="w-full"
            loading={mutation.isPending}
            disabled={!form.watch('oldPassword') || !form.watch('newPassword')}
          >
            <KeyRound />
            Cập nhật mật khẩu
          </Button>
        </div>
      </form>
    </Panel>
  )
}

/* =========================================================================
   4. TRANG CHÍNH: PROFILE & DASHBOARD
   ========================================================================= */
export default function ProfilePage() {
  const navigate = useNavigate()
  const sessionUser = useSession((s) => s.user)

  const profile = useQuery({
    queryKey: ['profile', sessionUser?.id],
    queryFn: profileService.get,
    enabled: !!sessionUser,
  })

  // Sử dụng dữ liệu profile mới nhất nếu có, hoặc dùng thông tin sessionUser có sẵn
  const activeUser = profile.data || sessionUser

  const logout = useMutation({
    mutationFn: authService.logout,
    onSettled: () => {
      useSession.getState().clear()
      navigate('/login', { replace: true, flushSync: true })
    },
  })

  return (
    <Page
      wide
      title="Hồ sơ tài khoản & Tổng quan"
      eyebrow="TÀI KHOẢN CÁ NHÂN"
      description="Quản lý thông tin liên lạc, bảo mật đăng nhập và theo dõi toàn bộ lịch hẹn xem phòng cùng các yêu cầu giữ chỗ của bạn."
    >
      <div className="space-y-8">
        {/* KHU VỰC CHÍNH: HÀNG TRÊN CÙNG GỒM THÔNG TIN CÁ NHÂN + ĐỔI MẬT KHẨU (NGANG NHAU) VÀ ASIDE */}
        <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* CỘT CHÍNH: HÀNG NGANG CHỨA FORM THÔNG TIN (MỞ RỘNG) & FORM ĐỔI MẬT KHẨU (THU NHỎ) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* THÔNG TIN CÁ NHÂN - MỞ RỘNG (7/12 CỘT) */}
            <div className="md:col-span-7">
              {activeUser ? (
                <ProfileInfoForm user={activeUser} />
              ) : (
                <Panel className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 w-1/3 bg-muted rounded" />
                    <div className="h-10 bg-muted rounded" />
                    <div className="h-10 bg-muted rounded" />
                  </div>
                </Panel>
              )}
            </div>

            {/* ĐỔI MẬT KHẨU - THU NHỎ (5/12 CỘT) */}
            <div className="md:col-span-5">
              <ChangePasswordForm />
            </div>
          </div>

          {/* ASIDE: TÀI KHOẢN & LIÊN KẾT NHANH */}
          <aside className="space-y-5">
            <Panel className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-base font-bold text-primary">
                  {activeUser?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-foreground truncate">{activeUser?.fullName}</h3>
                  <p className="text-xs text-muted-foreground truncate">{activeUser?.email}</p>
                </div>
              </div>

              <div className="space-y-2 border-t border-border/60 pt-4 text-xs">
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">Trạng thái:</span>
                  <StatusBadge tone={activeUser?.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {activeUser?.status === 'ACTIVE' ? 'Đang hoạt động' : activeUser?.status}
                  </StatusBadge>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">Vai trò:</span>
                  <span className="font-medium text-foreground">
                    {activeUser?.roles?.join(', ') || 'Khách thuê (TENANT)'}
                  </span>
                </div>
              </div>

              <div className="mt-5 space-y-2 border-t border-border/60 pt-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Lối tắt nhanh
                </p>
                <Link
                  to="/user/appointments"
                  className="flex items-center justify-between text-xs font-semibold text-primary hover:underline py-1.5"
                >
                  <span>Quản lý lịch hẹn xem phòng</span>
                  <ArrowRight size={13} />
                </Link>
                <Link
                  to="/user/bookings"
                  className="flex items-center justify-between text-xs font-semibold text-primary hover:underline py-1.5"
                >
                  <span>Yêu cầu đặt phòng & giữ chỗ</span>
                  <ArrowRight size={13} />
                </Link>
                <Link
                  to="/manager-invitations"
                  className="flex items-center justify-between text-xs font-semibold text-primary hover:underline py-1.5"
                >
                  <span>Lời mời làm quản lý</span>
                  <ArrowRight size={13} />
                </Link>
                <Link
                  to={activeUser?.roles?.includes('OWNER') ? '/owner/dashboard' : '/owner/onboarding'}
                  className="flex items-center justify-between text-xs font-semibold text-primary hover:underline py-1.5"
                >
                  <span>{activeUser?.roles?.includes('OWNER') ? 'Không gian chủ trọ' : 'Đăng ký làm chủ trọ'}</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

              <InlineError error={logout.error} />

              <Button
                variant="outline"
                loading={logout.isPending}
                className="mt-6 w-full text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => logout.mutate()}
              >
                <LogOut size={14} />
                Đăng xuất tài khoản
              </Button>
            </Panel>
          </aside>
        </div>

        {/* PHẦN DƯỚI: TỔNG QUAN LỊCH XEM PHÒNG & GIỮ CHỖ - MỞ RỘNG TOÀN DIỆN */}
        <div className="border-t border-border/60 pt-6">
          <OverviewDashboard />
        </div>
      </div>
    </Page>
  )
}
