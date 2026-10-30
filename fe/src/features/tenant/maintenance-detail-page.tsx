import { Field, InlineError, Modal, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { tenantApi } from '@/services/tenant'
import { reportRequestService } from '@/services/report-request'
import { useState } from 'react'
import { useParams } from 'react-router'
import { Upload, X } from 'lucide-react'
import { imageAttachment } from './attachments'
import { Facts, TenantLink, TenantPage, TenantStatus } from './components'
import { isActive, useTenant, useTenantMutation, useTenantQuery } from './context'
import { tenantStatusLabel } from './status'

export function MaintenanceDetailPage() {
  const { reportId = '' } = useParams(),
    { tenancy: t } = useTenant(),
    query = useTenantQuery('report', (id) => tenantApi.report(id, reportId), [reportId], true),
    [confirm, setConfirm] = useState(false),
    [image, setImage] = useState<string | null>(null),
    [supplementModal, setSupplementModal] = useState(false),
    [supplementNote, setSupplementNote] = useState(''),
    [supplementImages, setSupplementImages] = useState<string[]>([]),
    [reopenModal, setReopenModal] = useState(false),
    [reopenReason, setReopenReason] = useState(''),
    [escalateModal, setEscalateModal] = useState(false),
    [disputeReason, setDisputeReason] = useState(''),
    [uploading, setUploading] = useState(false),
    [uploadError, setUploadError] = useState<Error | null>(null)

  const cancel = useTenantMutation(tenantApi.cancelReport, () => setConfirm(false))

  const supplement = useTenantMutation(
    async () => {
      await reportRequestService.supplementInfo(reportId, supplementNote, supplementImages)
      setSupplementModal(false)
      setSupplementNote('')
      setSupplementImages([])
      query.refetch()
    },
  )

  const reopen = useTenantMutation(
    async () => {
      await reportRequestService.reopen(reportId, reopenReason)
      setReopenModal(false)
      setReopenReason('')
      query.refetch()
    },
  )

  const escalate = useTenantMutation(
    async () => {
      await reportRequestService.escalateAdmin(reportId, disputeReason)
      setEscalateModal(false)
      setDisputeReason('')
      query.refetch()
    },
  )

  const confirmClose = useTenantMutation(
    async () => {
      await reportRequestService.confirmClose(reportId)
      query.refetch()
    },
  )

  async function handleUpload(files: FileList | null) {
    if (!files) return
    if (files.length + supplementImages.length > 3) {
      setUploadError(new Error('Tối đa 3 ảnh bổ sung.'))
      return
    }
    setUploading(true)
    setUploadError(null)
    try {
      const images = await Promise.all(Array.from(files).map(imageAttachment))
      setSupplementImages((prev) => [...prev, ...images.map((img) => img.url)])
    } catch (err) {
      setUploadError(err instanceof Error ? err : new Error('Không thể tải ảnh.'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <TenantPage
      title="Chi tiết yêu cầu hỗ trợ"
      actions={<TenantLink to="/tenant/maintenance">Danh sách yêu cầu</TenantLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <h2 className="max-w-xl break-words text-xl font-bold">{query.data.title}</h2>
                <TenantStatus value={query.data.status} />
              </div>
              <Facts
                items={[
                  [
                    'Chỗ ở',
                    `${t.branchName} · ${t.roomName}${t.slotName ? ` · ${t.slotName}` : ''}`,
                  ],
                  ['Phạm vi / Mục', query.data.assetName],
                  ['Mức ưu tiên', tenantStatusLabel(query.data.priority)],
                  ['Ngày gửi', dateTime(query.data.createdAt)],
                  ['Người xử lý', query.data.assignedTo || 'Chưa phân công'],
                ]}
              />
              <p className="mt-6 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">
                {query.data.description}
              </p>
              {query.data.attachments.length > 0 && (
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {query.data.attachments.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setImage(a.url)}
                      aria-label={`Xem ảnh ${a.name}`}
                    >
                      <img
                        src={a.url}
                        alt={a.name}
                        className="aspect-square w-full rounded-lg object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Status Notices */}
              {query.data.requestedInfoNote && query.data.status === 'WAITING_INFO' && (
                <div className="mt-6 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
                  <p className="font-bold">Quản lý yêu cầu bổ sung thông tin:</p>
                  <p className="mt-1 whitespace-pre-wrap">{query.data.requestedInfoNote}</p>
                </div>
              )}
              {query.data.solutionResult && (
                <div className="mt-6 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-900 dark:text-emerald-200">
                  <p className="font-bold">Kết quả giải quyết của Quản lý:</p>
                  <p className="mt-1 whitespace-pre-wrap">{query.data.solutionResult}</p>
                </div>
              )}
              {query.data.rejectReason && query.data.status === 'REJECTED' && (
                <div className="mt-6 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                  <p className="font-bold">Lý do từ chối:</p>
                  <p className="mt-1 whitespace-pre-wrap">{query.data.rejectReason}</p>
                </div>
              )}
              {query.data.disputeReason && query.data.status === 'ESCALATED_ADMIN' && (
                <div className="mt-6 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
                  <p className="font-bold">Đang chờ Admin phân xử tranh chấp. Lý do:</p>
                  <p className="mt-1 whitespace-pre-wrap">{query.data.disputeReason}</p>
                  {query.data.adminConclusion && (
                    <p className="mt-3 font-semibold text-emerald-800 dark:text-emerald-300">
                      Kết luận Admin: {query.data.adminConclusion}
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons based on state */}
              <div className="mt-6 flex flex-wrap gap-3">
                {query.data.status === 'WAITING_INFO' && isActive(t) && (
                  <Button onClick={() => setSupplementModal(true)}>
                    Bổ sung thông tin
                  </Button>
                )}
                {query.data.status === 'RESOLVED' && isActive(t) && (
                  <>
                    <Button
                      loading={confirmClose.isPending}
                      onClick={() => confirmClose.mutate(reportId)}
                    >
                      Hài lòng & Đóng yêu cầu
                    </Button>
                    <Button variant="outline" onClick={() => setReopenModal(true)}>
                      Không hài lòng (Mở lại)
                    </Button>
                    <Button variant="outline" onClick={() => setEscalateModal(true)}>
                      Chuyển Admin phân xử
                    </Button>
                  </>
                )}
                {['PENDING', 'OPEN', 'WAITING_INFO'].includes(query.data.status) && isActive(t) && (
                  <Button variant="outline" onClick={() => setConfirm(true)}>
                    Hủy yêu cầu
                  </Button>
                )}
              </div>
            </Panel>

            <Panel>
              <h2 className="mb-6 font-bold">Tiến trình xử lý & Nhật ký</h2>
              {query.data.records.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có bản ghi tiến trình.</p>
              ) : (
                <ol className="space-y-7">
                  {query.data.records.map((r) => (
                    <li key={r.id} className="relative border-l-2 border-border pl-5">
                      <span className="absolute top-1 -left-[5px] size-2 rounded-full bg-primary" />
                      <div className="flex flex-wrap items-center gap-3">
                        <TenantStatus value={r.status} />
                        <time className="text-xs text-muted-foreground">{dateTime(r.at)}</time>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{r.description}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{r.performedBy}</p>
                      {r.evidence.length > 0 && (
                        <div className="mt-4 grid max-w-sm grid-cols-3 gap-2">
                          {r.evidence.map((src, idx) => (
                            <button
                              key={idx}
                              onClick={() => setImage(src)}
                              aria-label={`Ảnh minh chứng ${r.description}`}
                            >
                              <img
                                src={src}
                                alt={`Minh chứng ${tenantStatusLabel(r.status).toLowerCase()}`}
                                className="aspect-square w-full rounded-lg object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                      {r.cost > 0 && (
                        <div className="mt-4 rounded-lg bg-background p-4">
                          <p className="text-sm font-bold">
                            {formatVnd(r.cost)} ·{' '}
                            {r.responsibleParty === 'OWNER' ? 'Chủ nhà' : 'Người thuê'} chịu
                          </p>
                          {r.approvalStatus && (
                            <div className="mt-2">
                              <TenantStatus value={r.approvalStatus} />
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </>
        )}
      </QueryState>

      {/* Modal: Supplement info */}
      <Modal
        title="Bổ sung thông tin yêu cầu"
        description="Cung cấp thêm thông tin chi tiết hoặc hình ảnh theo yêu cầu của Quản lý."
        open={supplementModal}
        onOpenChange={setSupplementModal}
      >
        <div className="grid gap-4">
          <Field id="supplement-note" label="Nội dung bổ sung">
            <textarea
              id="supplement-note"
              className="input min-h-28"
              placeholder="Nhập thông tin chi tiết cần bổ sung..."
              value={supplementNote}
              onChange={(e) => setSupplementNote(e.target.value)}
            />
          </Field>
          <Field id="supplement-files" label="Ảnh minh chứng bổ sung" hint="Tối đa 3 ảnh">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Upload size={18} />
              <input
                id="supplement-files"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={uploading || supplement.isPending}
                onChange={(e) => {
                  void handleUpload(e.target.files)
                  e.target.value = ''
                }}
              />
            </div>
          </Field>
          {uploading && <p className="text-xs text-muted-foreground">Đang tải ảnh lên...</p>}
          <InlineError error={uploadError} />
          {supplementImages.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {supplementImages.map((url, idx) => (
                <div key={idx} className="relative">
                  <img
                    src={url}
                    alt={`Ảnh bổ sung ${idx + 1}`}
                    className="aspect-square w-full rounded-md object-cover"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="absolute top-1 right-1 bg-surface size-6"
                    onClick={() =>
                      setSupplementImages((prev) => prev.filter((_, i) => i !== idx))
                    }
                  >
                    <X size={12} />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <InlineError error={supplement.error} />
          <div className="flex justify-end gap-3 mt-2">
            <Button
              variant="outline"
              disabled={supplement.isPending}
              onClick={() => setSupplementModal(false)}
            >
              Hủy
            </Button>
            <Button
              loading={supplement.isPending}
              disabled={!supplementNote.trim() || uploading}
              onClick={() => supplement.mutate(reportId)}
            >
              Gửi thông tin bổ sung
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Reopen request */}
      <Modal
        title="Thỏa thuận mở lại yêu cầu"
        description="Mô tả lý do bạn chưa hài lòng hoặc cần Quản lý xử lý bổ sung."
        open={reopenModal}
        onOpenChange={setReopenModal}
      >
        <div className="grid gap-4">
          <Field id="reopen-reason" label="Lý do mở lại">
            <textarea
              id="reopen-reason"
              className="input min-h-24"
              placeholder="Ví dụ: Vẫn còn hiện tượng rò rỉ sau khi sửa..."
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
            />
          </Field>
          <InlineError error={reopen.error} />
          <div className="flex justify-end gap-3 mt-2">
            <Button
              variant="outline"
              disabled={reopen.isPending}
              onClick={() => setReopenModal(false)}
            >
              Đóng
            </Button>
            <Button
              loading={reopen.isPending}
              disabled={!reopenReason.trim()}
              onClick={() => reopen.mutate(reportId)}
            >
              Xác nhận mở lại
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Escalate to Admin */}
      <Modal
        title="Chuyển tranh chấp lên Admin"
        description="Khi hai bên không thống nhất được phương án giải quyết, Admin hệ thống sẽ tiếp nhận và xác minh."
        open={escalateModal}
        onOpenChange={setEscalateModal}
      >
        <div className="grid gap-4">
          <Field id="dispute-reason" label="Nội dung tranh chấp / khiếu nại">
            <textarea
              id="dispute-reason"
              className="input min-h-28"
              placeholder="Trình bày rõ bất đồng hoặc vi phạm chưa được xử lý thỏa đáng..."
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
            />
          </Field>
          <InlineError error={escalate.error} />
          <div className="flex justify-end gap-3 mt-2">
            <Button
              variant="outline"
              disabled={escalate.isPending}
              onClick={() => setEscalateModal(false)}
            >
              Đóng
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              loading={escalate.isPending}
              disabled={!disputeReason.trim()}
              onClick={() => escalate.mutate(reportId)}
            >
              Gửi khiếu nại lên Admin
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Cancel request */}
      <Modal
        title="Hủy yêu cầu hỗ trợ?"
        description="Chỉ có thể hủy yêu cầu đang ở trạng thái Chờ tiếp nhận hoặc Chờ bổ sung."
        open={confirm}
        onOpenChange={setConfirm}
      >
        <InlineError error={cancel.error} />
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={() => setConfirm(false)} disabled={cancel.isPending}>
            Giữ yêu cầu
          </Button>
          <Button loading={cancel.isPending} onClick={() => cancel.mutate(reportId)}>
            Xác nhận hủy
          </Button>
        </div>
      </Modal>

      {/* Modal: Enlarge image */}
      <Modal title="Ảnh minh chứng" open={!!image} onOpenChange={() => setImage(null)}>
        {image && (
          <img src={image} alt="Ảnh minh chứng mở rộng" className="w-full rounded-lg" />
        )}
      </Modal>
    </TenantPage>
  )
}
