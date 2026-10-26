import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Panel, QueryState, Notice, Modal } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { Facts } from '@/features/tenant/components'
import { Records, ActionDialog } from '@/features/manager/components'
import { adminApi } from '@/services/admin'
import { useSession } from '@/features/auth/session-store'
import { useAdminQuery, useAdminMutation, useAdminFilters } from './context'
import { AdminPage, AdminFilters, AdminLink, AdminStatus } from './components'
import { dateTime } from '@/lib/activity'
function DocumentPreview({
  id,
  version,
  onClose,
}: {
  id: string
  version: string
  onClose: () => void
}) {
  const uid = useSession((s) => s.user!.id),
    query = useQuery({
      queryKey: ['admin-document', uid, id, version],
      queryFn: () => adminApi.document(id),
      retry: false,
      gcTime: 0,
      staleTime: 0,
    }),
    image = useRef<HTMLImageElement>(null),
    [expired, setExpired] = useState(false)
  useEffect(() => {
    if (!query.data) return
    const objectUrl = URL.createObjectURL(new Blob([query.data.content], { type: query.data.mime }))
    const node = image.current
    if (node) node.src = objectUrl
    const timer = setTimeout(
      () => {
        setExpired(true)
        node?.removeAttribute('src')
        URL.revokeObjectURL(objectUrl)
      },
      Math.max(0, Date.parse(query.data.expiresAt) - Date.now()),
    )
    return () => {
      clearTimeout(timer)
      node?.removeAttribute('src')
      URL.revokeObjectURL(objectUrl)
    }
  }, [query.data])
  return (
    <Modal
      title="Tài liệu xác minh"
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Notice>
        Bản xem trước minh họa trong demo, không phải nội dung giấy tờ thật đã tải lên.
      </Notice>
      <div className="mt-5">
        <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
          {expired ? (
            <Notice tone="warning">
              Phiên xem tài liệu đã hết hạn. Đóng và mở lại để kiểm tra quyền.
            </Notice>
          ) : (
            query.data && (
              <img
                ref={image}
                alt="Tài liệu xác minh giả lập dành cho quản trị viên"
                className="w-full rounded-lg border border-border"
              />
            )
          )}
        </QueryState>
      </div>
    </Modal>
  )
}
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
