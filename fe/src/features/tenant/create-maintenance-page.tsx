import { Field, InlineError, Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-store'
import { reportInputSchema, type ReportInput } from '@/interfaces/tenant'
import { tenantApi } from '@/services/tenant'
import { zodResolver } from '@hookform/resolvers/zod'
import { Upload, X } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { imageAttachment, MAX_ATTACHMENT_COUNT } from './attachments'
import { TenantLink, TenantPage } from './components'
import { isActive, tenantLink, useTenant, useTenantMutation, useTenantQuery } from './context'

export function CreateMaintenancePage() {
  const { tenancy: defaultTenancy, tenancies = [] } = useTenant()
  const canCreateReport = useSession((s) => {
    const roles = s.user?.roles || []
    if (s.activeRole === 'ADMIN' || s.activeRole === 'MANAGER') return false
    if (roles.includes('ADMIN') || roles.includes('MANAGER')) {
      return s.activeRole === 'TENANT' || s.activeRole === 'OWNER'
    }
    return roles.includes('TENANT') || roles.includes('OWNER')
  })
  const [selectedTenancyId, setSelectedTenancyId] = useState(defaultTenancy.id)
  const currentTenancy =
    tenancies.find((item) => item.id === selectedTenancyId) || defaultTenancy

  const room = useTenantQuery('room', () => tenantApi.room(currentTenancy.id), [currentTenancy.id])
  const navigate = useNavigate()
  const [uploadError, setUploadError] = useState<Error | null>(null)
  const [uploading, setUploading] = useState(false)

  const form = useForm<ReportInput>({
    resolver: zodResolver(reportInputSchema),
    defaultValues: {
      category: 'REPAIR',
      assetId: '',
      title: '',
      description: '',
      priority: 'NORMAL',
      attachments: [],
    },
  })
  const category = useWatch({ control: form.control, name: 'category' })
  const attachments = useWatch({ control: form.control, name: 'attachments' })

  const mutation = useTenantMutation(
    (_, val: any) => tenantApi.createReport(currentTenancy.id, val),
    (report) => navigate(tenantLink(`/tenant/maintenance/${report.id}`, currentTenancy)),
  )

  async function upload(files: FileList | null) {
    if (!files) return
    if (files.length + attachments.length > MAX_ATTACHMENT_COUNT) {
      setUploadError(new Error(`Tối đa ${MAX_ATTACHMENT_COUNT} ảnh cho mỗi yêu cầu.`))
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
      title="Gửi yêu cầu hỗ trợ"
      description="Gửi yêu cầu sửa chữa, bảo trì, dịch vụ, nội thất hoặc khiếu nại."
      actions={<TenantLink to="/tenant/maintenance">Về danh sách yêu cầu</TenantLink>}
    >
      {!canCreateReport ? (
        <Notice tone="warning">
          Chỉ tài khoản Khách thuê (Tenant) và Chủ trọ (Owner) mới có quyền tạo yêu cầu hỗ trợ.
        </Notice>
      ) : (
        <QueryState pending={room.isPending} error={room.error} retry={room.refetch}>
          {room.data && (
            <Panel>
              <form
                className="grid min-w-0 grid-cols-1 gap-5"
                onSubmit={form.handleSubmit(
                  (value) => {
                    const targetRoomId = room.data?.tenancy.roomId || currentTenancy.roomId || ''
                    const assetId = value.assetId || targetRoomId
                    const furnitureIds =
                      value.category === 'FURNITURE' && value.assetId && value.assetId !== targetRoomId
                        ? [value.assetId]
                        : undefined
                    const serviceIds =
                      value.category === 'SERVICE' && value.assetId && value.assetId !== targetRoomId
                        ? [value.assetId]
                        : undefined

                    mutation.mutate({
                      ...value,
                      roomId: targetRoomId,
                      assetId,
                      furnitureIds,
                      serviceIds,
                    })
                  },
                  (errors) => {
                    console.warn('Form validation errors:', errors)
                  },
                )}
              >
                {!isActive(currentTenancy) && (
                  <Notice tone="warning">
                    Hợp đồng thuê phòng này hiện không ở trạng thái hoạt động hoặc đã kết thúc.
                  </Notice>
                )}

                {tenancies.length > 1 ? (
                  <Field id="report-tenancy" label="Chọn phòng cần hỗ trợ">
                    <select
                      id="report-tenancy"
                      className="input"
                      value={selectedTenancyId}
                      onChange={(e) => {
                        setSelectedTenancyId(e.target.value)
                        form.setValue('assetId', '')
                      }}
                    >
                      {tenancies.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.roomName} ({item.branchName})
                          {item.slotName ? ` · ${item.slotName}` : ''}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Notice>
                    {currentTenancy.branchName} · {currentTenancy.roomName}
                    {currentTenancy.slotName ? ` · ${currentTenancy.slotName}` : ''}
                  </Notice>
                )}

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="report-category" label="Loại yêu cầu">
                    <select
                      id="report-category"
                      className="input"
                      {...form.register('category', {
                        onChange: (e) => {
                          const val = e.target.value
                          if (['FURNITURE', 'SERVICE'].includes(val)) {
                            form.setValue('assetId', '')
                          } else {
                            form.setValue('assetId', room.data?.tenancy.roomId || currentTenancy.roomId || '')
                          }
                        },
                      })}
                    >
                      <option value="REPAIR">Sửa chữa</option>
                      <option value="FURNITURE">Nội thất</option>
                      <option value="SERVICE">Dịch vụ</option>
                      <option value="COMPLAINT">Khiếu nại</option>
                      <option value="MAINTENANCE">Bảo trì</option>
                      <option value="CONTRACT">Gia hạn / Hợp đồng</option>
                      <option value="OTHER">Khác</option>
                    </select>
                  </Field>

                  {['FURNITURE', 'SERVICE'].includes(category) ? (
                    <Field
                      id="report-asset"
                      label="Tài sản / dịch vụ cụ thể"
                      error={
                        form.formState.errors.assetId
                          ? 'Chọn tài sản hoặc dịch vụ.'
                          : undefined
                      }
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
                  ) : (
                    <Field id="report-scope" label="Phạm vi hỗ trợ">
                      <input
                        id="report-scope"
                        className="input bg-muted/20"
                        readOnly
                        value={`${currentTenancy.roomName} (${currentTenancy.branchName})`}
                      />
                    </Field>
                  )}
                </div>

                <Field id="report-title" label="Tiêu đề" error={form.formState.errors.title?.message}>
                  <input
                    id="report-title"
                    className="input"
                    placeholder="Ví dụ: Vòi nước bồn rửa mặt bị rò rỉ"
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
                    placeholder="Mô tả chi tiết tình trạng, thời điểm xảy ra và ảnh hưởng hiện tại…"
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
                    <option value="LOW">Thấp</option>
                    <option value="NORMAL">Trung bình</option>
                    <option value="HIGH">Cao</option>
                    <option value="URGENT">Khẩn cấp</option>
                  </select>
                </Field>

                <Field
                  id="report-images"
                  label="Ảnh minh chứng"
                  hint={`JPG, PNG hoặc WebP · tối đa ${MAX_ATTACHMENT_COUNT} ảnh · 5 MB mỗi ảnh`}
                >
                  <div className="flex min-w-0 items-center gap-3 text-sm text-muted-foreground">
                    <Upload size={18} />
                    <input
                      id="report-images"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      disabled={uploading || mutation.isPending || !isActive(currentTenancy)}
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
                    Đang xử lý ảnh…
                  </p>
                )}
                <InlineError error={uploadError} />

                {attachments.length > 0 && (
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
                          className="absolute top-1 right-1 bg-surface size-7"
                          aria-label={`Xóa ảnh ${a.name}`}
                          disabled={mutation.isPending}
                          onClick={() =>
                            form.setValue(
                              'attachments',
                              attachments.filter((i) => i.id !== a.id),
                            )
                          }
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {Object.keys(form.formState.errors).length > 0 && (
                  <InlineError error={new Error('Vui lòng kiểm tra lại các trường có báo lỗi bên trên.')} />
                )}
                <InlineError error={mutation.error} />

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    loading={mutation.isPending}
                    disabled={uploading}
                  >
                    Gửi yêu cầu hỗ trợ
                  </Button>
                </div>
              </form>
            </Panel>
          )}
        </QueryState>
      )}
    </TenantPage>
  )
}
