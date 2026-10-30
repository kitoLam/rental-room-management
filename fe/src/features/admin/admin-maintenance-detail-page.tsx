import { Field, InlineError, Modal, Panel, QueryState } from '@/components/common/page'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { dateTime } from '@/lib/activity'
import { reportRequestService } from '@/services/report-request'
import { tenantStatusLabel } from '@/features/tenant/status'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, ShieldAlert } from 'lucide-react'

export function AdminMaintenanceDetailPage() {
  const { reportId = '' } = useParams()
  const [resolveModal, setResolveModal] = useState(false)
  const [adminConclusion, setAdminConclusion] = useState('')
  const [image, setImage] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['admin', 'maintenance-detail', reportId],
    queryFn: () => reportRequestService.getById(reportId),
    enabled: !!reportId,
  })

  const resolveMutation = useMutation({
    mutationFn: () => reportRequestService.adminResolve(reportId, adminConclusion.trim()),
    onSuccess: () => {
      setResolveModal(false)
      setAdminConclusion('')
      query.refetch()
    },
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

  const r = query.data

  return (
    <div className="min-w-0">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            to="/admin/maintenance"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={14} /> Quay lại danh sách yêu cầu
          </Link>
          <h1 className="text-page-title font-bold tracking-tight">Chi tiết yêu cầu & Phân xử</h1>
        </div>
      </header>

      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {r && (
          <div className="grid min-w-0 grid-cols-1 gap-6">
            <Panel>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <h2 className="max-w-xl break-words text-xl font-bold">{r.title}</h2>
                <StatusBadge tone={getStatusTone(r.status)}>
                  {tenantStatusLabel(r.status)}
                </StatusBadge>
              </div>

              <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Loại yêu cầu</dt>
                  <dd className="font-semibold">{tenantStatusLabel(r.type)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Mức ưu tiên</dt>
                  <dd className="font-semibold">{tenantStatusLabel(r.priority)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Mã phòng / Chi nhánh</dt>
                  <dd className="font-semibold">
                    Phòng: {r.roomId || 'Không xác định'} {r.branchId ? `(Chi nhánh: ${r.branchId})` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Ngày gửi yêu cầu</dt>
                  <dd className="font-semibold">{dateTime(r.createdAt)}</dd>
                </div>
              </dl>

              <div className="mt-5 border-t border-border pt-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase">Nội dung yêu cầu ban đầu</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{r.content}</p>
                {r.attachments && r.attachments.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {r.attachments.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setImage(url)}
                        aria-label={`Xem ảnh ban đầu ${idx + 1}`}
                        className="cursor-pointer overflow-hidden rounded-lg hover:opacity-90"
                      >
                        <img
                          src={url}
                          alt={`Minh chứng ${idx + 1}`}
                          className="aspect-square w-full rounded-lg object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Dispute section when ESCALATED_ADMIN */}
              {r.status === 'ESCALATED_ADMIN' && (
                <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-5 text-sm">
                  <div className="flex items-center gap-2 text-destructive font-bold text-base">
                    <ShieldAlert size={20} />
                    <span>Hồ sơ đang chờ Admin phân xử tranh chấp!</span>
                  </div>
                  <div className="mt-3">
                    <p className="font-semibold text-foreground">Nội dung tranh chấp / khiếu nại của Khách thuê:</p>
                    <p className="mt-1 whitespace-pre-wrap rounded-md bg-background/80 p-3 text-foreground font-medium">
                      {r.disputeReason || 'Chưa có nội dung chi tiết.'}
                    </p>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold"
                      onClick={() => setResolveModal(true)}
                    >
                      Admin phân xử & đóng
                    </Button>
                  </div>
                </div>
              )}

              {/* Resolved / Solution info if any */}
              {r.solutionResult && (
                <div className="mt-6 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-900 dark:text-emerald-200">
                  <p className="font-bold">Kết quả xử lý của Quản lý trước đó:</p>
                  <p className="mt-1 whitespace-pre-wrap">{r.solutionResult}</p>
                </div>
              )}

              {/* Admin official conclusion when CLOSED */}
              {r.adminConclusion && (
                <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm text-emerald-900 dark:text-emerald-200">
                  <p className="font-bold text-base text-primary">Phán quyết & Kết luận chính thức của Admin:</p>
                  <p className="mt-2 whitespace-pre-wrap rounded-md bg-background/80 p-3 text-foreground font-medium">
                    {r.adminConclusion}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Hồ sơ đã được Admin phân xử và đóng chính thức.
                  </p>
                </div>
              )}

              {r.rejectReason && (
                <div className="mt-6 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                  <p className="font-bold">Lý do từ chối:</p>
                  <p className="mt-1 whitespace-pre-wrap">{r.rejectReason}</p>
                </div>
              )}
            </Panel>

            {/* Timeline */}
            <Panel>
              <h2 className="mb-6 font-bold text-base">Toàn bộ lịch sử & Tiến trình xử lý</h2>
              {r.timeline && r.timeline.length > 0 ? (
                <ol className="space-y-6">
                  {r.timeline.map((item) => (
                    <li key={item.id} className="relative border-l-2 border-border pl-5">
                      <span className="absolute top-1 -left-[5px] size-2 rounded-full bg-primary" />
                      <div className="flex flex-wrap items-center gap-3">
                        <StatusBadge tone={getStatusTone(item.statusTo || item.action)}>
                          {tenantStatusLabel(item.statusTo || item.action)}
                        </StatusBadge>
                        <time className="text-xs text-muted-foreground">{dateTime(item.createdAt)}</time>
                      </div>
                      <p className="mt-2 text-sm leading-6 whitespace-pre-wrap">{item.note}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Thực hiện bởi: {item.actorName || item.actorRole || 'Hệ thống'}
                      </p>
                      {item.attachments && item.attachments.length > 0 && (
                        <div className="mt-3 grid max-w-sm grid-cols-3 gap-2">
                          {item.attachments.map((src, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setImage(src)}
                              aria-label={`Ảnh minh chứng ${idx + 1}`}
                              className="cursor-pointer overflow-hidden rounded-md hover:opacity-90"
                            >
                              <img
                                src={src}
                                alt={`Ảnh minh chứng ${idx + 1}`}
                                className="aspect-square w-full rounded-md object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">Chưa có bản ghi tiến trình nào.</p>
              )}
            </Panel>
          </div>
        )}
      </QueryState>

      {/* Modal: Admin resolve dispute */}
      <Modal
        title="Admin phân xử & Đóng hồ sơ tranh chấp"
        description="Đưa ra kết luận phân xử chính thức. Quyết định của Admin là quyết định cuối cùng và hồ sơ sẽ được đóng hoàn tất."
        open={resolveModal}
        onOpenChange={setResolveModal}
      >
        <div className="grid gap-4">
          <Field id="admin-conclusion" label="Kết luận phân xử chính thức (bắt buộc)">
            <textarea
              id="admin-conclusion"
              className="input min-h-32"
              placeholder="Ghi rõ phán quyết: bên chịu chi phí, phương án bồi thường hoặc phương án khắc phục dứt điểm..."
              value={adminConclusion}
              onChange={(e) => setAdminConclusion(e.target.value)}
            />
          </Field>
          <InlineError error={resolveMutation.error} />
          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              disabled={resolveMutation.isPending}
              onClick={() => setResolveModal(false)}
            >
              Hủy
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold"
              loading={resolveMutation.isPending}
              disabled={!adminConclusion.trim()}
              onClick={() => resolveMutation.mutate()}
            >
              Xác nhận kết luận & Đóng hồ sơ
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Image enlarge */}
      <Modal title="Ảnh minh chứng chi tiết" open={!!image} onOpenChange={() => setImage(null)}>
        {image && (
          <img src={image} alt="Ảnh minh chứng phóng to" className="w-full rounded-lg" />
        )}
      </Modal>
    </div>
  )
}
