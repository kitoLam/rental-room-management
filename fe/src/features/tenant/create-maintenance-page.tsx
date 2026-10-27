import { Field, InlineError, Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { reportInputSchema, type ReportInput } from '@/interfaces/tenant'
import { tenantApi } from '@/services/tenant'
import { zodResolver } from '@hookform/resolvers/zod'
import { Upload, X } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { imageAttachment } from './attachments'
import { TenantLink, TenantPage } from './components'
import { isActive, tenantLink, useTenant, useTenantMutation, useTenantQuery } from './context'
import { tenantStatusLabel } from './status'

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
