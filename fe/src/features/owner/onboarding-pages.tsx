import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Page, Panel, QueryState, Notice, InlineError, Field } from '@/components/common/page'
import { Facts } from '@/features/tenant/components'
import { Button } from '@/components/ui/button'
import { ManagerForm } from '@/features/manager/components'
import { useSession } from '@/features/auth/session-store'
import { imageAttachment } from '@/features/tenant/attachments'
import type { Attachment } from '@/interfaces/tenant'
import { ownerApi } from '@/services/owner'
import { queryClient } from '@/services/query-client'
import { dateTime } from '@/lib/activity'
import { provider } from '@/services/config'
import { profileService } from '@/services/guest-user'
const status: Record<string, string> = {
  NOT_SUBMITTED: 'Chưa nộp hồ sơ',
  PENDING: 'Đang chờ xét duyệt',
  APPROVED: 'Hồ sơ đã được duyệt',
  REJECTED: 'Cần bổ sung hồ sơ',
}
export function OwnerVerificationPage() {
  const user = useSession((s) => s.user!),
    query = useQuery({
      queryKey: ['owner-verification', user.id],
      queryFn: ownerApi.verification,
      refetchInterval: 3000,
      retry: false,
    })
  const identity = useQuery({
    queryKey: ['owner-authorized-profile', user.id],
    queryFn: profileService.get,
    enabled:
      !!query.data?.eligible &&
      provider('auth') === 'mock' &&
      provider('profile') === 'mock' &&
      !user.roles.includes('OWNER'),
    retry: false,
  })
  useEffect(() => {
    if (
      identity.data?.id === user.id &&
      identity.data.roles.includes('OWNER') &&
      !user.roles.includes('OWNER')
    )
      useSession.getState().updateUser(identity.data)
  }, [identity.data, user.id, user.roles])
  return (
    <Page title="Xác minh chủ trọ" eyebrow="HỒ SƠ CHỦ TRỌ" narrow back="/user/dashboard">
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <Panel>
            <h2 className="mb-5 text-xl font-bold">{status[query.data.status]}</h2>
            <Facts
              items={[
                ['Tài khoản', user.email],
                ['Liên hệ', query.data.contactVerified ? 'Đã xác minh email' : 'Chưa xác minh'],
                [
                  'Ngày gửi',
                  query.data.submittedAt ? dateTime(query.data.submittedAt) : 'Chưa gửi',
                ],
                ['Tài liệu', query.data.document?.name || 'Chưa có'],
                [
                  'Ngày duyệt',
                  query.data.reviewedAt ? dateTime(query.data.reviewedAt) : 'Chưa xét duyệt',
                ],
                ['Kết quả', query.data.reason || 'Quản trị viên sẽ xét duyệt hồ sơ.'],
              ]}
            />
            <div className="mt-6 flex flex-wrap gap-3">
              {query.data.eligible ? (
                <Button asChild>
                  <Link to="/owner/dashboard">Vào không gian chủ trọ</Link>
                </Button>
              ) : ['NOT_SUBMITTED', 'REJECTED'].includes(query.data.status) ? (
                <Button asChild>
                  <Link to="/owner/onboarding">
                    {query.data.status === 'REJECTED' ? 'Bổ sung và gửi lại' : 'Bắt đầu hồ sơ'}
                  </Link>
                </Button>
              ) : (
                <Notice>
                  {query.data.status === 'APPROVED'
                    ? 'Hồ sơ đã duyệt; quyền vận hành vẫn cần được hệ thống cấp.'
                    : 'Hồ sơ đang chờ quản trị viên xét duyệt.'}
                </Notice>
              )}
            </div>
          </Panel>
        )}
      </QueryState>
    </Page>
  )
}
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
export function ManagerInvitationsPage() {
  const user = useSession((s) => s.user!),
    query = useQuery({
      queryKey: ['my-manager-invitations', user.id],
      queryFn: ownerApi.invitations,
    }),
    mutation = useMutation({
      mutationFn: ownerApi.accept,
      onSuccess: (data) => {
        useSession.getState().updateUser(data.user)
        void queryClient.invalidateQueries()
      },
    })
  return (
    <Page title="Lời mời quản lý" back="/profile" narrow>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
        empty={query.data?.length === 0}
        emptyMessage="Bạn chưa có lời mời quản lý."
        emptyAction={<Link to="/profile">Về hồ sơ</Link>}
      >
        <div className="grid gap-5">
          {query.data?.map((i) => (
            <Panel key={i.id}>
              <h2 className="text-lg font-bold">Lời mời dành cho {i.fullName}</h2>
              <p className="my-3 text-sm text-muted-foreground">
                {i.note || 'Tham gia quản lý chi nhánh trên TroPro.'}
              </p>
              <p className="text-xs">Hết hạn: {dateTime(i.expiresAt)}</p>
              <p className="my-3 text-sm">
                {i.status === 'ACCEPTED'
                  ? 'Đã xác nhận. Chủ trọ sẽ phân công chi nhánh.'
                  : i.status === 'INVITED'
                    ? 'Chờ bạn xác nhận'
                    : 'Lời mời đã hủy hoặc hết hạn'}
              </p>
              {i.status === 'INVITED' && (
                <Button disabled={mutation.isPending} onClick={() => mutation.mutate(i.id)}>
                  Xác nhận tham gia
                </Button>
              )}
            </Panel>
          ))}
        </div>
        <InlineError error={mutation.error} />
        {mutation.isSuccess && (
          <Notice tone="success">
            Đã xác nhận bằng tài khoản của bạn.{' '}
            <Link to="/manager/dashboard" className="underline">
              Xem phân công
            </Link>
          </Notice>
        )}
      </QueryState>
    </Page>
  )
}
