import { Records } from '@/features/manager/components'
import { dateTime } from '@/lib/activity'
import { adminApi } from '@/services/admin'
import { AdminFilters, AdminLink, AdminPage, AdminStatus } from './components'
import { useAdminFilters, useAdminQuery } from './context'

export function AdminVerificationQueue() {
  const state = useAdminFilters({ status: 'PENDING', from: '', to: '' }),
    query = useAdminQuery('verifications', () => adminApi.list('verifications', state.filters), [
      state.filters,
    ])
  const records = query.data
    ? { ...query.data, content: query.data.content.map((r) => ({ ...r, id: r.user.id })) }
    : undefined
  return (
    <AdminPage
      title="Xác minh chủ trọ"
      description="Xét duyệt hồ sơ, theo dõi kết quả và quyền được cấp."
    >
      <AdminFilters
        state={state}
        statuses={['PENDING', 'APPROVED', 'REJECTED', 'NOT_SUBMITTED']}
        dates
      />
      <Records
        query={{ ...query, data: records }}
        page={state.page}
        onPage={state.onPage}
        empty="Chưa có hồ sơ phù hợp."
        columns={[
          {
            label: 'Người nộp',
            render: (r) => (
              <AdminLink to={`/admin/owner-verifications/${r.user.id}`}>
                {r.user.fullName}
              </AdminLink>
            ),
          },
          {
            label: 'Liên hệ',
            render: (r) => (
              <span className="break-all">{r.user.email || r.user.phone || 'Chưa cập nhật'}</span>
            ),
          },
          { label: 'Trạng thái', render: (r) => <AdminStatus value={r.verification.status} /> },
          {
            label: 'Ngày gửi',
            render: (r) =>
              r.verification.submittedAt ? dateTime(r.verification.submittedAt) : 'Chưa gửi',
          },
          {
            label: 'Tài liệu / xét duyệt',
            render: (r) => (
              <>
                <p className="text-xs">
                  {r.verification.document ? 'Có tài liệu' : 'Chưa có tài liệu'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.reviewerName ||
                    (r.verification.reviewedAt ? 'Đã xét duyệt' : 'Chưa xét duyệt')}
                </p>
              </>
            ),
          },
        ]}
      />
    </AdminPage>
  )
}
