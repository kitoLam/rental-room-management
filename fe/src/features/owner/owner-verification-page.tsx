import { Notice, Page, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-store'
import { Facts } from '@/features/tenant/components'
import { dateTime } from '@/lib/activity'
import { provider } from '@/services/config'
import { profileService } from '@/services/guest-user'
import { ownerApi } from '@/services/owner'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link } from 'react-router'
import { status } from './onboarding-shared'
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
