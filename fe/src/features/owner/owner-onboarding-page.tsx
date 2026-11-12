import { Field, InlineError, Notice, Page, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-store'
import { ManagerForm } from '@/features/manager/components'
import { imageAttachment } from '@/features/tenant/attachments'
import { Facts } from '@/features/tenant/components'
import type { Attachment } from '@/interfaces/tenant'
import { provider } from '@/services/config'
import { ownerApi } from '@/services/owner'
import { queryClient } from '@/services/query-client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { z } from 'zod'
import { status } from './onboarding-shared'
export function OwnerOnboarding() {
  const user = useSession((s) => s.user!),
    [document, setDocument] = useState<Attachment | null>(null),
    [error, setError] = useState<unknown>(null),
    [review, setReview] = useState<Record<string, unknown> | null>(null)
  const verification = useQuery({
    queryKey: ['owner-verification', user.id],
    queryFn: ownerApi.verification,
    retry: false,
  })
  const mutation = useMutation({
    mutationFn: ownerApi.submit,
    onSuccess: (data) => {
      setDocument(null)
      useSession.getState().updateUser({ ...user, fullName: data.fullName, phone: data.phone })
      void queryClient.invalidateQueries({ queryKey: ['owner-verification'] })
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
  const schema = z.object({
    fullName: z.string().trim().min(2).max(255),
    phone: z.string().regex(/^\+?[0-9 ]{9,15}$/),
  })
  return (
    <Page
      title="Trở thành chủ trọ"
      description="Xác minh thông tin để bắt đầu quản lý chi nhánh."
      eyebrow="HỒ SƠ CHỦ TRỌ"
      narrow
      back="/owner/verification"
    >
      <QueryState
        pending={verification.isPending}
        error={verification.error}
        retry={verification.refetch}
      >
        {mutation.isSuccess ? (
          <Notice tone="success">
            Đã gửi hồ sơ.{' '}
            <Link to="/owner/verification" className="font-bold underline">
              Theo dõi xét duyệt
            </Link>
          </Notice>
        ) : verification.data && ['PENDING', 'APPROVED'].includes(verification.data.status) ? (
          <Notice>
            Hồ sơ {status[verification.data.status].toLowerCase()}.{' '}
            <Link to="/owner/verification" className="underline">
              Xem trạng thái
            </Link>
          </Notice>
        ) : (
          <Panel>
            <p className="mb-5 text-sm">{user.email} · Email đã xác minh</p>
            {provider('owner') === 'mock' && (
              <Notice>
                Hồ sơ demo: chỉ dùng ảnh giả lập. Hệ thống chỉ giữ tên, định dạng và mã tài liệu mô
                phỏng.
              </Notice>
            )}
            <div className="mt-5">
              {!review ? (
                <ManagerForm
                  schema={schema}
                  defaults={{ fullName: user.fullName, phone: user.phone || '' }}
                  fields={[
                    { name: 'fullName', label: 'Họ và tên' },
                    { name: 'phone', label: 'Số điện thoại' },
                  ]}
                  pending={mutation.isPending}
                  error={error}
                  submitLabel="Kiểm tra hồ sơ"
                  onSubmit={(v) => {
                    if (!document) {
                      setError(new Error('Cần chọn tài liệu xác minh.'))
                      return
                    }
                    setError(null)
                    setReview(v)
                  }}
                >
                  <Field
                    id="owner-document"
                    label="Tài liệu xác minh"
                    hint="Ảnh PNG, JPEG hoặc WebP, tối đa 1 MB. Không tải giấy tờ thật vào môi trường demo."
                  >
                    <input
                      id="owner-document"
                      className="input"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        try {
                          setDocument(await imageAttachment(file))
                          setError(null)
                        } catch (err) {
                          setError(err)
                        }
                        e.target.value = ''
                      }}
                    />
                  </Field>
                  {document && <p className="text-sm">Đã chọn: {document.name}</p>}
                </ManagerForm>
              ) : (
                <div className="grid gap-5">
                  <Facts
                    items={[
                      ['Họ và tên', String(review.fullName)],
                      ['Điện thoại', String(review.phone)],
                      ['Tài liệu', document?.name || ''],
                    ]}
                  />
                  <InlineError error={mutation.error} />
                  <div className="flex flex-wrap gap-3">
                    <Button
                      disabled={mutation.isPending}
                      onClick={() => {
                        if (document) {
                          const { name, mime, size, url } = document
                          mutation.mutate({ ...review, document: { name, mime, size, url } })
                        }
                      }}
                    >
                      {mutation.isPending ? 'Đang gửi…' : 'Gửi xác minh'}
                    </Button>
                    <Button
                      disabled={mutation.isPending}
                      variant="outline"
                      onClick={() => setReview(null)}
                    >
                      Chỉnh sửa
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Panel>
        )}
      </QueryState>
    </Page>
  )
}
