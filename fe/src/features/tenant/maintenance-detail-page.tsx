import { Field, InlineError, Modal, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-store'
import { dateTime } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { tenantApi } from '@/services/tenant'
import { reportRequestService } from '@/services/report-request'
import { useState } from 'react'
import { useParams } from 'react-router'
import { Upload, X } from 'lucide-react'
import { imageAttachment, MAX_ATTACHMENT_COUNT } from './attachments'
import { Facts, TenantLink, TenantPage, TenantStatus } from './components'
import { useTenant, useTenantMutation, useTenantQuery } from './context'
import { tenantStatusLabel } from './status'

export function MaintenanceDetailPage() {
  const { reportId = '' } = useParams(),
    { tenancy: t } = useTenant(),
    isAdmin = useSession((s) => Boolean(s.user?.roles.includes('ADMIN') || s.activeRole === 'ADMIN')),
    query = useTenantQuery('report', (id) => tenantApi.report(id, reportId), [reportId], true),
    [confirmCancel, setConfirmCancel] = useState(false),
    [confirmCloseModal, setConfirmCloseModal] = useState(false),
    [image, setImage] = useState<string | null>(null),
    [supplementModal, setSupplementModal] = useState(false),
    [supplementNote, setSupplementNote] = useState(''),
    [supplementImages, setSupplementImages] = useState<string[]>([]),
    [reopenModal, setReopenModal] = useState(false),
    [reopenReason, setReopenReason] = useState(''),
    [reopenImages, setReopenImages] = useState<string[]>([]),
    [escalateModal, setEscalateModal] = useState(false),
    [disputeReason, setDisputeReason] = useState(''),
    [escalateImages, setEscalateImages] = useState<string[]>([]),
    [adminResolveModal, setAdminResolveModal] = useState(false),
    [adminConclusion, setAdminConclusion] = useState(''),
    [uploading, setUploading] = useState(false),
    [uploadError, setUploadError] = useState<Error | null>(null)

  const cancel = useTenantMutation(tenantApi.cancelReport, () => {
    setConfirmCancel(false)
    query.refetch()
  })

  const supplement = useTenantMutation(async () => {
    await reportRequestService.supplementInfo(reportId, supplementNote, supplementImages)
    setSupplementModal(false)
    setSupplementNote('')
    setSupplementImages([])
    query.refetch()
  })

  const reopen = useTenantMutation(async () => {
    await reportRequestService.reopen(reportId, reopenReason, reopenImages)
    setReopenModal(false)
    setReopenReason('')
    setReopenImages([])
    query.refetch()
  })

  const escalate = useTenantMutation(async () => {
    await reportRequestService.escalateAdmin(reportId, disputeReason, escalateImages)
    setEscalateModal(false)
    setDisputeReason('')
    setEscalateImages([])
    query.refetch()
  })

  const adminResolve = useTenantMutation(async () => {
    await reportRequestService.adminResolve(reportId, adminConclusion.trim())
    setAdminResolveModal(false)
    setAdminConclusion('')
    query.refetch()
  })

  const confirmClose = useTenantMutation(async () => {
    await reportRequestService.confirmClose(reportId)
    setConfirmCloseModal(false)
    query.refetch()
  })

  async function handleUpload(
    files: FileList | null,
    currentList: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) {
    if (!files) return
    if (files.length + currentList.length > MAX_ATTACHMENT_COUNT) {
      setUploadError(new Error(`Tối đa ${MAX_ATTACHMENT_COUNT} ảnh minh chứng.`))
      return
    }
    setUploading(true)
    setUploadError(null)
    try {
      const images = await Promise.all(Array.from(files).map(imageAttachment))
      setter((prev) => [...prev, ...images.map((img) => img.url)])
    } catch (err) {
      setUploadError(err instanceof Error ? err : new Error('Không thể tải ảnh.'))
    } finally {
      setUploading(false)
    }
  }

  // Tìm sự kiện giải quyết gần nhất để lấy ảnh nghiệm thu
  const resolveRecord = query.data?.records
    ? [...query.data.records]
        .reverse()
        .find(
          (r) =>
            r.status === 'RESOLVED' ||
            (r as any).action === 'RESOLVED' ||
            (r.evidence && r.evidence.length > 0 && r.description?.includes('giải quyết')),
        )
    : null
  const acceptanceImages = resolveRecord?.evidence || []

  const isTerminal =
    query.data?.status === 'CLOSED' ||
    query.data?.status === 'REJECTED' ||
    query.data?.status === 'CANCELLED'

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
                  ['Người xử lý', query.data.assignedTo || 'Quản lý phụ trách'],
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
                      type="button"
                      onClick={() => setImage(a.url)}
                      aria-label={`Xem ảnh ${a.name}`}
                      className="cursor-pointer overflow-hidden rounded-lg hover:opacity-90"
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
              {query.data.status === 'WAITING_INFO' && (
                <div className="mt-6 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
                  <p className="font-bold">Quản lý yêu cầu bổ sung thông tin:</p>
                  <p className="mt-1 whitespace-pre-wrap">
                    {query.data.requestedInfoNote || 'Vui lòng cung cấp thêm thông tin chi tiết.'}
                  </p>
                </div>
              )}

              {query.data.status === 'RESOLVED' && query.data.solutionResult && (
                <div className="mt-6 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-900 dark:text-emerald-200">
                  <p className="font-bold">Kết quả giải quyết của Quản lý:</p>
                  <p className="mt-1 whitespace-pre-wrap">{query.data.solutionResult}</p>
                  {acceptanceImages.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                        Ảnh nghiệm thu bàn giao:
                      </p>
                      <div className="mt-2 grid max-w-sm grid-cols-3 gap-2">
                        {acceptanceImages.map((src, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setImage(src)}
                            aria-label={`Xem ảnh nghiệm thu ${idx + 1}`}
                            className="cursor-pointer overflow-hidden rounded-md hover:opacity-90"
                          >
                            <img
                              src={src}
                              alt={`Nghiệm thu ${idx + 1}`}
                              className="aspect-square w-full rounded-md object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {query.data.status === 'REJECTED' && query.data.rejectReason && (
                <div className="mt-6 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                  <p className="font-bold">Lý do từ chối:</p>
                  <p className="mt-1 whitespace-pre-wrap">{query.data.rejectReason}</p>
                </div>
              )}

              {query.data.status === 'ESCALATED_ADMIN' && (
                <div className="mt-6 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                  <p className="font-bold">Hồ sơ đã chuyển lên Admin hệ thống phân xử tranh chấp:</p>
                  <p className="mt-1 whitespace-pre-wrap">
                    Lý do khiếu nại: {query.data.disputeReason || 'Chờ phân xử'}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Các thao tác thông thường tạm khóa trong thời gian chờ Admin giải quyết.
                    </p>
                    {isAdmin && (
                      <Button onClick={() => setAdminResolveModal(true)}>
                        Admin phân xử & đóng
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {query.data.status === 'CLOSED' && (
                <div className="mt-6 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-900 dark:text-emerald-200">
                  <p className="font-bold">Hồ sơ yêu cầu hỗ trợ đã đóng hoàn tất.</p>
                  {query.data.adminConclusion && (
                    <div className="mt-2 pt-2 border-t border-emerald-500/20">
                      <p className="font-semibold text-primary">Kết luận chính thức của Admin:</p>
                      <p className="mt-1 whitespace-pre-wrap">{query.data.adminConclusion}</p>
                    </div>
                  )}
                  {query.data.solutionResult && !query.data.adminConclusion && (
                    <div className="mt-2 pt-2 border-t border-emerald-500/20">
                      <p className="font-semibold">Kết quả giải quyết đã nghiệm thu:</p>
                      <p className="mt-1 whitespace-pre-wrap">{query.data.solutionResult}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons based on state (for Tenant) */}
              {!isTerminal && query.data.status !== 'ESCALATED_ADMIN' && (
                <div className="mt-6 flex flex-wrap gap-3">
                  {/* PENDING: Huỷ */}
                  {query.data.status === 'PENDING' && (
                    <Button variant="outline" onClick={() => setConfirmCancel(true)}>
                      Hủy yêu cầu
                    </Button>
                  )}

                  {/* WAITING_INFO: Bổ sung, Chuyển Admin, Huỷ */}
                  {query.data.status === 'WAITING_INFO' && (
                    <>
                      <Button onClick={() => setSupplementModal(true)}>
                        Bổ sung thông tin
                      </Button>
                      <Button variant="outline" onClick={() => setEscalateModal(true)}>
                        Chuyển Admin phân xử
                      </Button>
                      <Button variant="outline" onClick={() => setConfirmCancel(true)}>
                        Hủy yêu cầu
                      </Button>
                    </>
                  )}

                  {/* IN_PROGRESS: Chuyển Admin */}
                  {query.data.status === 'IN_PROGRESS' && (
                    <Button variant="outline" onClick={() => setEscalateModal(true)}>
                      Chuyển Admin phân xử
                    </Button>
                  )}

                  {/* RESOLVED: Hài lòng & Đóng, Không hài lòng (Mở lại), Chuyển Admin */}
                  {query.data.status === 'RESOLVED' && (
                    <>
                      <Button onClick={() => setConfirmCloseModal(true)}>
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
                </div>
              )}
            </Panel>

            <Panel>
              <h2 className="mb-6 font-bold">Tiến trình xử lý & Lịch sử</h2>
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
                              type="button"
                              onClick={() => setImage(src)}
                              aria-label={`Ảnh minh chứng ${r.description}`}
                              className="cursor-pointer overflow-hidden rounded-lg hover:opacity-90"
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
          <Field id="supplement-note" label="Nội dung bổ sung (bắt buộc)">
            <textarea
              id="supplement-note"
              className="input min-h-28"
              placeholder="Nhập thông tin chi tiết cần bổ sung..."
              value={supplementNote}
              onChange={(e) => setSupplementNote(e.target.value)}
            />
          </Field>
          <Field id="supplement-files" label="Ảnh minh chứng bổ sung" hint={`Tối đa ${MAX_ATTACHMENT_COUNT} ảnh (5 MB/ảnh)`}>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Upload size={18} />
              <input
                id="supplement-files"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={uploading || supplement.isPending}
                onChange={(e) => {
                  void handleUpload(e.target.files, supplementImages, setSupplementImages)
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
        title="Không hài lòng / Mở lại yêu cầu"
        description="Mô tả lý do bạn chưa hài lòng hoặc tình trạng lỗi chưa được khắc phục triệt để."
        open={reopenModal}
        onOpenChange={setReopenModal}
      >
        <div className="grid gap-4">
          <Field id="reopen-reason" label="Lý do mở lại (bắt buộc)">
            <textarea
              id="reopen-reason"
              className="input min-h-24"
              placeholder="Ví dụ: Vòi nước vẫn rò rỉ sau khi thợ thay linh kiện..."
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
            />
          </Field>
          <Field id="reopen-files" label="Ảnh minh chứng hiện trạng" hint={`Tối đa ${MAX_ATTACHMENT_COUNT} ảnh (5 MB/ảnh)`}>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Upload size={18} />
              <input
                id="reopen-files"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={uploading || reopen.isPending}
                onChange={(e) => {
                  void handleUpload(e.target.files, reopenImages, setReopenImages)
                  e.target.value = ''
                }}
              />
            </div>
          </Field>
          {uploading && <p className="text-xs text-muted-foreground">Đang tải ảnh lên...</p>}
          <InlineError error={uploadError} />
          {reopenImages.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {reopenImages.map((url, idx) => (
                <div key={idx} className="relative">
                  <img
                    src={url}
                    alt={`Ảnh lỗi mở lại ${idx + 1}`}
                    className="aspect-square w-full rounded-md object-cover"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="absolute top-1 right-1 bg-surface size-6"
                    onClick={() =>
                      setReopenImages((prev) => prev.filter((_, i) => i !== idx))
                    }
                  >
                    <X size={12} />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <InlineError error={reopen.error} />
          <div className="flex justify-end gap-3 mt-2">
            <Button
              variant="outline"
              disabled={reopen.isPending}
              onClick={() => setReopenModal(false)}
            >
              Hủy
            </Button>
            <Button
              loading={reopen.isPending}
              disabled={!reopenReason.trim() || uploading}
              onClick={() => reopen.mutate(reportId)}
            >
              Xác nhận mở lại
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Escalate to Admin */}
      <Modal
        title="Chuyển Admin phân xử tranh chấp"
        description="Khi có bất đồng hoặc không thỏa thuận được với Quản lý, Admin hệ thống sẽ tiếp nhận và đưa ra phán quyết."
        open={escalateModal}
        onOpenChange={setEscalateModal}
      >
        <div className="grid gap-4">
          <Field id="dispute-reason" label="Nội dung tranh chấp / khiếu nại (bắt buộc)">
            <textarea
              id="dispute-reason"
              className="input min-h-28"
              placeholder="Trình bày rõ tranh chấp về chi phí, chất lượng sửa chữa hoặc vi phạm thỏa thuận..."
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
            />
          </Field>
          <Field id="escalate-files" label="Ảnh chứng từ / minh chứng tranh chấp" hint={`Tối đa ${MAX_ATTACHMENT_COUNT} ảnh (5 MB/ảnh)`}>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Upload size={18} />
              <input
                id="escalate-files"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={uploading || escalate.isPending}
                onChange={(e) => {
                  void handleUpload(e.target.files, escalateImages, setEscalateImages)
                  e.target.value = ''
                }}
              />
            </div>
          </Field>
          {uploading && <p className="text-xs text-muted-foreground">Đang tải ảnh lên...</p>}
          <InlineError error={uploadError} />
          {escalateImages.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {escalateImages.map((url, idx) => (
                <div key={idx} className="relative">
                  <img
                    src={url}
                    alt={`Minh chứng tranh chấp ${idx + 1}`}
                    className="aspect-square w-full rounded-md object-cover"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="absolute top-1 right-1 bg-surface size-6"
                    onClick={() =>
                      setEscalateImages((prev) => prev.filter((_, i) => i !== idx))
                    }
                  >
                    <X size={12} />
                  </Button>
                </div>
              ))}
            </div>
          )}
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
              loading={escalate.isPending}
              disabled={!disputeReason.trim() || uploading}
              onClick={() => escalate.mutate(reportId)}
            >
              Gửi khiếu nại lên Admin
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Admin Resolve (only for ADMIN role) */}
      {isAdmin && (
        <Modal
          title="Admin phân xử & Đóng hồ sơ tranh chấp"
          description="Đưa ra kết luận phân xử chính thức. Quyết định của Admin là quyết định cuối cùng và hồ sơ sẽ được đóng hoàn tất."
          open={adminResolveModal}
          onOpenChange={setAdminResolveModal}
        >
          <div className="grid gap-4">
            <Field id="tenant-admin-conclusion" label="Kết luận phân xử chính thức (bắt buộc)">
              <textarea
                id="tenant-admin-conclusion"
                className="input min-h-28"
                placeholder="Nhập kết luận phân xử của Admin (ví dụ: Admin đã đối chiếu biên bản bàn giao ban đầu...)"
                value={adminConclusion}
                onChange={(e) => setAdminConclusion(e.target.value)}
              />
            </Field>
            <InlineError error={adminResolve.error} />
            <div className="flex justify-end gap-3 mt-2">
              <Button
                variant="outline"
                disabled={adminResolve.isPending}
                onClick={() => setAdminResolveModal(false)}
              >
                Hủy
              </Button>
              <Button
                loading={adminResolve.isPending}
                disabled={!adminConclusion.trim()}
                onClick={() => adminResolve.mutate(reportId)}
              >
                Xác nhận kết luận & Đóng hồ sơ
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Confirm Close */}
      <Modal
        title="Xác nhận hài lòng & Đóng yêu cầu?"
        description="Bạn đã hài lòng với kết quả xử lý của Quản lý và đồng ý đóng hoàn tất yêu cầu hỗ trợ này?"
        open={confirmCloseModal}
        onOpenChange={setConfirmCloseModal}
      >
        <InlineError error={confirmClose.error} />
        <div className="flex flex-wrap justify-end gap-3 mt-4">
          <Button
            variant="outline"
            disabled={confirmClose.isPending}
            onClick={() => setConfirmCloseModal(false)}
          >
            Quay lại
          </Button>
          <Button
            loading={confirmClose.isPending}
            onClick={() => confirmClose.mutate(reportId)}
          >
            Xác nhận đóng
          </Button>
        </div>
      </Modal>

      {/* Modal: Cancel request */}
      <Modal
        title="Xác nhận hủy yêu cầu hỗ trợ?"
        description="Chỉ có thể hủy yêu cầu đang ở trạng thái Chờ tiếp nhận hoặc Chờ bổ sung thông tin."
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
      >
        <InlineError error={cancel.error} />
        <div className="flex flex-wrap justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => setConfirmCancel(false)} disabled={cancel.isPending}>
            Giữ lại yêu cầu
          </Button>
          <Button
            loading={cancel.isPending}
            onClick={() => cancel.mutate(reportId)}
          >
            Xác nhận hủy
          </Button>
        </div>
      </Modal>

      {/* Modal: Enlarge image */}
      <Modal title="Ảnh minh chứng chi tiết" open={!!image} onOpenChange={() => setImage(null)}>
        {image && (
          <img src={image} alt="Ảnh minh chứng phóng to" className="w-full rounded-lg" />
        )}
      </Modal>
    </TenantPage>
  )
}
