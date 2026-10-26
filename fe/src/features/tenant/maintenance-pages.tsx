import { tenantStatusLabel } from './status'
import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Upload, X } from 'lucide-react'
import {
  Panel,
  QueryState,
  Field,
  InlineError,
  Modal,
  Notice,
  Pagination,
} from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { TenantPage, TenantStatus, TenantLink, Facts } from './components'
import { useTenant, useTenantQuery, useTenantMutation, isActive, tenantLink } from './context'
import { tenantApi } from '@/services/tenant'
import { formatVnd } from '@/lib/format'
import { dateTime } from '@/lib/activity'
import { reportInputSchema, type ReportInput } from '@/interfaces/tenant'

import { imageAttachment } from './attachments'
export function MaintenancePage() {
  const { tenancy: t } = useTenant(),
    query = useTenantQuery('maintenance', tenantApi.reports, [], true),
    [state, setState] = useState(''),
    [category, setCategory] = useState(''),
    [page, setPage] = useState(1)
  const rows = (query.data || []).filter(
      (r) => (!state || r.status === state) && (!category || r.category === category),
    ),
    pages = Math.ceil(rows.length / 6),
    current = Math.min(page, Math.max(1, pages))
  return (
    <TenantPage
      title="Bảo trì & sửa chữa"
      description="Gửi báo hỏng, theo dõi lịch xử lý và kết quả sửa chữa."
      actions={
        isActive(t) ? (
          <TenantLink to="/tenant/maintenance/new" button>
            <Plus size={17} />
            Báo hỏng
          </TenantLink>
        ) : undefined
      }
    >
      <div className="flex flex-wrap gap-3">
        <select
          aria-label="Lọc trạng thái bảo trì"
          className="input w-auto"
          value={state}
          onChange={(e) => {
            setState(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả trạng thái</option>
          {['OPEN', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED'].map((s) => (
            <option key={s} value={s}>
              {tenantStatusLabel(s)}
            </option>
          ))}
        </select>
        <select
          aria-label="Loại báo hỏng"
          className="input w-auto"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả loại</option>
          <option value="FURNITURE">Nội thất</option>
          <option value="SERVICE">Dịch vụ</option>
        </select>
      </div>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
        empty={rows.length === 0}
        emptyMessage="Chưa có yêu cầu bảo trì phù hợp."
        emptyAction={
          isActive(t) ? (
            <TenantLink to="/tenant/maintenance/new" button>
              Tạo yêu cầu
            </TenantLink>
          ) : null
        }
      >
        <Panel>
          {rows.slice((current - 1) * 6, current * 6).map((r) => (
            <Link
              key={r.id}
              to={tenantLink(`/tenant/maintenance/${r.id}`, t)}
              className="flex flex-wrap items-start justify-between gap-4 border-t border-border py-5 first:border-0 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <h2 className="break-words text-sm font-bold text-primary">{r.title}</h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  {r.assetName} · {dateTime(r.createdAt)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ưu tiên {tenantStatusLabel(r.priority).toLowerCase()}
                </p>
              </div>
              <TenantStatus value={r.status} />
            </Link>
          ))}
        </Panel>
        <Pagination page={current} totalPages={pages} onPage={setPage} />
      </QueryState>
    </TenantPage>
  )
}
export function CreateMaintenancePage() {
  const { tenancy: t } = useTenant(),
    room = useTenantQuery('room', tenantApi.room),
    navigate = useNavigate(),
    [uploadError, setUploadError] = useState<Error | null>(null),
    [uploading, setUploading] = useState(false)
  const form = useForm<ReportInput>({
      resolver: zodResolver(reportInputSchema),
      defaultValues: {
        category: 'FURNITURE',
        assetId: '',
        title: '',
        description: '',
        priority: 'NORMAL',
        attachments: [],
      },
    }),
    category = useWatch({ control: form.control, name: 'category' }),
    attachments = useWatch({ control: form.control, name: 'attachments' })
  const mutation = useTenantMutation(tenantApi.createReport, (report) =>
    navigate(tenantLink(`/tenant/maintenance/${report.id}`, t)),
  )
  async function upload(files: FileList | null) {
    if (!files) return
    if (files.length + attachments.length > 3) {
      setUploadError(new Error('Tối đa 3 ảnh cho mỗi yêu cầu.'))
      return
    }
    setUploading(true)
    setUploadError(null)
    try {
      const images = await Promise.all(Array.from(files).map(imageAttachment))
      form.setValue('attachments', [...attachments, ...images], { shouldValidate: true })
    } catch (error) {
      setUploadError(error instanceof Error ? error : new Error('Không thể tải ảnh.'))
    } finally {
      setUploading(false)
    }
  }
  return (
    <TenantPage
      title="Báo hỏng"
      description="Mô tả tình trạng để quản lý sắp xếp kiểm tra."
      actions={<TenantLink to="/tenant/maintenance">Về bảo trì</TenantLink>}
    >
      <QueryState pending={room.isPending} error={room.error} retry={room.refetch}>
        {room.data && (
          <Panel>
            <form
              className="grid min-w-0 grid-cols-1 gap-5"
              onSubmit={form.handleSubmit((value) => mutation.mutate(value))}
            >
              <Notice>
                {t.branchName} · {t.roomName}
                {t.slotName ? ` · ${t.slotName}` : ''}
              </Notice>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="report-category" label="Loại báo hỏng">
                  <select
                    id="report-category"
                    className="input"
                    {...form.register('category', { onChange: () => form.setValue('assetId', '') })}
                  >
                    <option value="FURNITURE">Nội thất</option>
                    <option value="SERVICE">Dịch vụ</option>
                  </select>
                </Field>
                <Field
                  id="report-asset"
                  label="Tài sản / dịch vụ"
                  error={form.formState.errors.assetId ? 'Chọn tài sản hoặc dịch vụ.' : undefined}
                >
                  <select id="report-asset" className="input" {...form.register('assetId')}>
                    <option value="">Chọn mục cần kiểm tra</option>
                    {room.data.assets
                      .filter((a) => a.category === category)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                </Field>
              </div>
              <Field id="report-title" label="Tiêu đề" error={form.formState.errors.title?.message}>
                <input
                  id="report-title"
                  className="input"
                  placeholder="Ví dụ: Điều hòa chảy nước"
                  maxLength={120}
                  {...form.register('title')}
                />
              </Field>
              <Field
                id="report-description"
                label="Mô tả tình trạng"
                error={form.formState.errors.description?.message}
              >
                <textarea
                  id="report-description"
                  className="input min-h-32"
                  placeholder="Tình trạng, thời điểm xảy ra và ảnh hưởng hiện tại…"
                  maxLength={2000}
                  {...form.register('description')}
                />
              </Field>
              <Field id="report-priority" label="Mức độ ưu tiên">
                <select
                  id="report-priority"
                  className="input max-w-xs"
                  {...form.register('priority')}
                >
                  {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((s) => (
                    <option value={s} key={s}>
                      {tenantStatusLabel(s)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                id="report-images"
                label="Ảnh hiện trạng"
                hint="JPG, PNG hoặc WebP · tối đa 3 ảnh · 1 MB mỗi ảnh"
              >
                <div className="flex min-w-0 items-center gap-3 text-sm text-muted-foreground">
                  <Upload size={18} />
                  <input
                    id="report-images"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    disabled={uploading || mutation.isPending || !isActive(t)}
                    className="w-full min-w-0 max-w-full"
                    onChange={(e) => {
                      void upload(e.target.files)
                      e.target.value = ''
                    }}
                  />
                </div>
              </Field>
              {uploading && (
                <p role="status" className="text-sm text-muted-foreground">
                  Đang đọc ảnh…
                </p>
              )}
              <InlineError error={uploadError} />
              <div className="grid grid-cols-3 gap-3">
                {attachments.map((a) => (
                  <div key={a.id} className="relative min-w-0">
                    <img
                      className="aspect-square w-full rounded-lg object-cover"
                      src={a.url}
                      alt={a.name}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="absolute top-1 right-1 bg-surface"
                      aria-label={`Xóa ảnh ${a.name}`}
                      disabled={mutation.isPending}
                      onClick={() =>
                        form.setValue(
                          'attachments',
                          attachments.filter((i) => i.id !== a.id),
                        )
                      }
                    >
                      <X size={16} />
                    </Button>
                  </div>
                ))}
              </div>
              <InlineError error={mutation.error} />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  loading={mutation.isPending}
                  disabled={!isActive(t) || uploading}
                >
                  Gửi yêu cầu bảo trì
                </Button>
              </div>
            </form>
          </Panel>
        )}
      </QueryState>
    </TenantPage>
  )
}
export function MaintenanceDetailPage() {
  const { reportId = '' } = useParams(),
    { tenancy: t } = useTenant(),
    query = useTenantQuery('report', (id) => tenantApi.report(id, reportId), [reportId], true),
    [confirm, setConfirm] = useState(false),
    [image, setImage] = useState<string | null>(null)
  const cancel = useTenantMutation(tenantApi.cancelReport, () => setConfirm(false))
  return (
    <TenantPage
      title="Chi tiết bảo trì"
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
                  ['Tài sản / dịch vụ', query.data.assetName],
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
              {query.data.status === 'OPEN' && isActive(t) && (
                <div className="mt-5">
                  <Button variant="outline" onClick={() => setConfirm(true)}>
                    Hủy yêu cầu bảo trì
                  </Button>
                </div>
              )}
            </Panel>
            <Panel>
              <h2 className="mb-6 font-bold">Tiến trình xử lý</h2>
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
                        {r.evidence.map((src) => (
                          <button
                            key={src}
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
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          {r.approvalStatus === 'APPROVED'
                            ? r.responsibleParty === 'TENANT'
                              ? 'Khoản được duyệt chỉ trở thành công nợ khi có trong hóa đơn đã phát hành.'
                              : 'Chi phí hao mòn được chủ nhà thanh toán.'
                            : 'Chưa được duyệt, chưa tính vào công nợ của bạn.'}
                        </p>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </Panel>
          </>
        )}
      </QueryState>
      <Modal
        title="Hủy yêu cầu bảo trì?"
        description="Chỉ có thể hủy yêu cầu chưa được tiếp nhận."
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
      <Modal title="Ảnh minh chứng" open={!!image} onOpenChange={() => setImage(null)}>
        {image && (
          <img src={image} alt="Ảnh minh chứng bảo trì mở rộng" className="w-full rounded-lg" />
        )}
      </Modal>
    </TenantPage>
  )
}
