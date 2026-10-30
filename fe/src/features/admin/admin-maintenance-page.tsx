import { Pagination, Panel, QueryState } from '@/components/common/page'
import { StatusBadge } from '@/components/common/status-badge'
import { dateTime } from '@/lib/activity'
import { reportRequestService } from '@/services/report-request'
import { tenantStatusLabel } from '@/features/tenant/status'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'

export function AdminMaintenancePage() {
  const [status, setStatus] = useState('ESCALATED_ADMIN')
  const [type, setType] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(0)

  const query = useQuery({
    queryKey: ['admin', 'maintenance', status, type, keyword, page],
    queryFn: () =>
      reportRequestService.search(
        {
          status: (status || undefined) as any,
          type: (type || undefined) as any,
          keyword: keyword.trim() || undefined,
          page,
          size: 10,
        },
        'admin' as any,
      ),
  })

  const getStatusTone = (s: string) => {
    switch (s) {
      case 'CLOSED':
      case 'RESOLVED':
        return 'success'
      case 'IN_PROGRESS':
        return 'info'
      case 'PENDING':
      case 'WAITING_INFO':
        return 'warning'
      case 'REJECTED':
      case 'ESCALATED_ADMIN':
        return 'danger'
      default:
        return 'neutral'
    }
  }

  const items = query.data?.content || []
  const totalPages = query.data?.totalPages || 1

  return (
    <div className="min-w-0">
      <header className="mb-8">
        <h1 className="text-page-title font-bold tracking-tight">
          Quản lý yêu cầu hỗ trợ & Phân xử tranh chấp
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Theo dõi tất cả yêu cầu hỗ trợ và phân xử các tranh chấp do Khách thuê chuyển lên Admin.
        </p>
      </header>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select
          aria-label="Lọc theo trạng thái"
          className="input w-auto font-medium"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(0)
          }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ESCALATED_ADMIN">Chuyển Admin (Cần phân xử)</option>
          <option value="PENDING">Chờ xử lý</option>
          <option value="IN_PROGRESS">Đang xử lý</option>
          <option value="WAITING_INFO">Chờ bổ sung</option>
          <option value="RESOLVED">Đã giải quyết</option>
          <option value="CLOSED">Đã đóng</option>
          <option value="REJECTED">Đã từ chối</option>
          <option value="CANCELLED">Đã hủy</option>
        </select>

        <select
          aria-label="Lọc theo loại yêu cầu"
          className="input w-auto font-medium"
          value={type}
          onChange={(e) => {
            setType(e.target.value)
            setPage(0)
          }}
        >
          <option value="">Tất cả loại</option>
          <option value="REPAIR">Sửa chữa</option>
          <option value="FURNITURE">Nội thất</option>
          <option value="SERVICE">Dịch vụ</option>
          <option value="COMPLAINT">Khiếu nại</option>
          <option value="MAINTENANCE">Bảo trì</option>
          <option value="CONTRACT">Hợp đồng / Gia hạn</option>
          <option value="OTHER">Khác</option>
        </select>

        <input
          type="text"
          className="input max-w-xs"
          placeholder="Tìm tiêu đề, nội dung..."
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value)
            setPage(0)
          }}
        />
      </div>

      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
        empty={items.length === 0}
        emptyMessage="Không tìm thấy yêu cầu hỗ trợ nào phù hợp."
      >
        <Panel>
          {items.map((r) => (
            <Link
              key={r.id}
              to={`/admin/maintenance/${r.id}`}
              className="flex flex-wrap items-start justify-between gap-4 border-t border-border py-5 first:border-0 first:pt-0 last:pb-0 hover:bg-muted/10 transition-colors px-2 rounded-md"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="break-words text-base font-bold text-primary">{r.title}</h2>
                  {r.status === 'ESCALATED_ADMIN' && (
                    <span className="inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive">
                      Cần phân xử
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{r.content}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>Loại: {tenantStatusLabel(r.type)}</span>
                  <span>·</span>
                  <span>Ưu tiên: {tenantStatusLabel(r.priority)}</span>
                  <span>·</span>
                  <span>Gửi ngày: {dateTime(r.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge tone={getStatusTone(r.status)}>
                  {tenantStatusLabel(r.status)}
                </StatusBadge>
              </div>
            </Link>
          ))}
        </Panel>

        {totalPages > 1 && (
          <div className="mt-4">
            <Pagination
              page={page + 1}
              totalPages={totalPages}
              onPage={(p) => setPage(p - 1)}
            />
          </div>
        )}
      </QueryState>
    </div>
  )
}
