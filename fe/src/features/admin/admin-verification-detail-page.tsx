import { Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-store'
import { ActionDialog } from '@/features/manager/components'
import { Facts } from '@/features/tenant/components'
import { dateTime } from '@/lib/activity'
import { adminApi } from '@/services/admin'
import { useState } from 'react'
import { useParams } from 'react-router'
import { AdminLink, AdminPage, AdminStatus } from './components'
import { useAdminMutation, useAdminQuery } from './context'
import { DocumentPreview } from './verification-shared'
export function AdminVerificationDetail() {
  const { userId = '' } = useParams(),
    uid = useSession((s) => s.user!.id),
    query = useAdminQuery('verification', () => adminApi.review(userId), [userId]),
    [document, setDocument] = useState(false),
    [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | null>(null),
    [version, setVersion] = useState(''),
    mutation = useAdminMutation(
      (value: { decision: 'APPROVED' | 'REJECTED'; reason: string; version: string }) =>
        adminApi.decide(userId, value),
      () => setDecision(null),
    )
  const canReview =
    query.data?.verification.status === 'PENDING' &&
    query.data.user.status === 'ACTIVE' &&
    !!query.data.verification.document &&
    uid !== userId
  return (
    <AdminPage
      title="Chi tiết hồ sơ chủ trọ"
      actions={<AdminLink to="/admin/owner-verifications">Về hàng chờ xét duyệt</AdminLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold">{query.data.user.fullName}</h2>
                <AdminStatus value={query.data.verification.status} />
              </div>
              <Facts
                items={[
                  ['Mã người dùng', <span className="break-all">{userId}</span>],
                  ['Liên hệ', query.data.user.email || query.data.user.phone || 'Chưa có'],
                  ['Tài khoản', <AdminStatus value={query.data.user.status} />],
                  [
                    'Ngày nộp',
                    query.data.verification.submittedAt
                      ? dateTime(query.data.verification.submittedAt)
                      : 'Chưa nộp',
                  ],
                  [
                    'Xác minh liên hệ',
                    query.data.verification.contactVerified ? 'Đã xác minh' : 'Chưa xác minh',
                  ],
                  ['Người xét duyệt', query.data.reviewerName || 'Chưa có thông tin'],
                  [
                    'Xét duyệt lúc',
                    query.data.verification.reviewedAt
                      ? dateTime(query.data.verification.reviewedAt)
                      : 'Chưa xét duyệt',
                  ],
                  ['Kết quả / lý do', query.data.verification.reason || 'Chưa có quyết định'],
                  [
                    'Quyền vận hành',
                    query.data.verification.eligible ? 'Đủ điều kiện chủ trọ' : 'Chưa đủ điều kiện',
                  ],
                ]}
              />
              <div className="mt-5 flex flex-wrap gap-4">
                <AdminLink to={`/admin/users/${userId}`}>Xem tài khoản</AdminLink>
                {query.data.verification.document && (
                  <Button variant="outline" onClick={() => setDocument(true)}>
                    Xem tài liệu được phép
                  </Button>
                )}
              </div>
            </Panel>
            <Panel>
              <h2 className="mb-4 font-bold">Tài liệu & quyết định</h2>
              <p className="mb-4 break-words text-sm text-muted-foreground">
                {query.data.verification.document
                  ? `${query.data.verification.document.name} · ${query.data.verification.document.mime} · ${query.data.verification.document.size} byte`
                  : 'Hồ sơ chưa có tài liệu.'}
              </p>
              <Notice>
                Phê duyệt xác minh và cấp quyền OWNER được thực hiện qua quy trình danh tính đã kiểm
                tra. Quyền này chỉ áp dụng cho chi nhánh do tài khoản sở hữu.
              </Notice>
              {canReview && (
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button
                    onClick={() => {
                      setVersion(query.data!.version)
                      setDecision('APPROVED')
                      mutation.reset()
                    }}
                  >
                    Phê duyệt hồ sơ
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setVersion(query.data!.version)
                      setDecision('REJECTED')
                      mutation.reset()
                    }}
                  >
                    Từ chối hồ sơ
                  </Button>
                </div>
              )}
              {uid === userId && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Bạn không được tự xét duyệt hồ sơ của mình.
                </p>
              )}
              {mutation.isSuccess && <Notice tone="success">Đã ghi nhận kết quả xét duyệt.</Notice>}
            </Panel>
            <Panel>
              <h2 className="mb-4 font-bold">Lịch sử xét duyệt</h2>
              {query.data.history.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Chưa có sự kiện xét duyệt được ghi nhận trong phiên.
                </p>
              ) : (
                query.data.history.map((a) => (
                  <div className="border-t border-border py-4" key={a.id}>
                    <p className="text-sm">{a.summary}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {a.actorName} · {dateTime(a.occurredAt)}
                    </p>
                    <p className="mt-2 text-sm">{a.reason}</p>
                    <AdminLink to={`/admin/activity/${a.id}`}>Xem sự kiện audit</AdminLink>
                  </div>
                ))
              )}
            </Panel>
          </>
        )}
      </QueryState>
      {document && query.data && (
        <DocumentPreview
          id={userId}
          version={query.data.version}
          onClose={() => setDocument(false)}
        />
      )}
      <ActionDialog
        title={
          decision === 'APPROVED'
            ? `Phê duyệt hồ sơ ${query.data?.user.fullName || ''}?`
            : `Từ chối hồ sơ ${query.data?.user.fullName || ''}?`
        }
        open={!!decision}
        onOpenChange={(v) => {
          if (!v) setDecision(null)
        }}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={(v) =>
          mutation.mutate({ decision: decision!, reason: String(v.reason), version })
        }
      />
    </AdminPage>
  )
}
