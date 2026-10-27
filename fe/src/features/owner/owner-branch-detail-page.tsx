import { InlineError, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { ActionDialog, ManagerStatus } from '@/features/manager/components'
import { Facts } from '@/features/tenant/components'
import { useNow } from '@/hooks/use-now'
import { ownerApi } from '@/services/owner'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { MoneyStats, OwnerPage } from './components'
import { operationsLink, useOwnerMutation, useOwnerQuery } from './context'

export function OwnerBranchDetail() {
  const clock = useNow()
  const { branchId = '' } = useParams(),
    query = useOwnerQuery('branch', () => ownerApi.branch(branchId), [branchId]),
    policies = useOwnerQuery('policies', () => ownerApi.policies(branchId), [branchId]),
    summary = useOwnerQuery(
      'branch-summary',
      () => ownerApi.summary({ branchId, month: new Date().toISOString().slice(0, 7) }),
      [branchId],
    ),
    [remove, setRemove] = useState(false),
    navigate = useNavigate(),
    mutation = useOwnerMutation(() => navigate('/owner/branches'))
  const current = policies.data?.find((p) => Date.parse(p.effectiveFrom) <= clock)
  return (
    <OwnerPage
      title={query.data?.name || 'Chi nhánh'}
      actions={
        <Button variant="outline" asChild>
          <Link to="/owner/branches">Danh sách chi nhánh</Link>
        </Button>
      }
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <ManagerStatus value={query.data.status} />
                <span className="text-xs text-muted-foreground">{query.data.code}</span>
              </div>
              <Facts
                items={[
                  ['Địa chỉ', query.data.address],
                  ['Quản lý', query.data.managerName || 'Chưa phân công'],
                  ['Phòng', String(query.data.roomCount)],
                  ['Chính sách', current ? `Phiên bản ${current.version}` : 'Chưa có hiệu lực'],
                  ['QR nhận tiền', query.data.qrPublicId ? 'Đã cấu hình' : 'Chưa cấu hình'],
                  ['Zalo', query.data.zaloEnabled ? 'Đang bật' : 'Chưa bật'],
                ]}
              />
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild>
                  <Link to={operationsLink(branchId)}>Vận hành chi nhánh</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to={`/owner/branches/${branchId}/edit`}>Sửa chi nhánh</Link>
                </Button>
                <Link
                  className="py-3 text-sm font-bold text-primary"
                  to={`/owner/manager-assignments?branchId=${branchId}`}
                >
                  Phân công quản lý
                </Link>
              </div>
            </Panel>
            <div className="grid gap-5 sm:grid-cols-2">
              <Panel>
                <h2 className="mb-4 font-bold">Chính sách & thanh toán</h2>
                <div className="grid gap-3 text-sm font-bold text-primary">
                  <Link to={`/owner/branches/${branchId}/policies`}>
                    Chính sách và lịch sử phiên bản
                  </Link>
                  <Link to={`/owner/branches/${branchId}/payments/settings`}>
                    Cấu hình QR nhận tiền
                  </Link>
                  <Link to={operationsLink(branchId, 'settings/zalo')}>Cấu hình nhóm Zalo</Link>
                </div>
              </Panel>
              <Panel>
                <h2 className="mb-4 font-bold">Thông tin công khai</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {query.data.description || 'Chưa có mô tả.'}
                </p>
                <p className="my-3 text-xs">
                  {query.data.isPublic
                    ? 'Đang công khai khi chi nhánh hoạt động'
                    : 'Đang ẩn khỏi tìm kiếm'}
                </p>
                <div className="flex flex-wrap gap-4 text-sm font-bold text-primary">
                  <Link to={`/owner/branches/${branchId}/edit`}>Sửa ảnh, liên hệ, nội quy</Link>
                  {query.data.isPublic && query.data.status === 'ACTIVE' && (
                    <Link to={`/branches/${branchId}`}>Xem trang công khai</Link>
                  )}
                </div>
              </Panel>
            </div>
            {query.data.images.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {query.data.images.map((image, i) => (
                  <img
                    key={image}
                    src={image}
                    alt={`${query.data!.name}, ảnh ${i + 1}`}
                    className="aspect-[4/3] w-full rounded-lg object-cover"
                  />
                ))}
              </div>
            )}
            <QueryState pending={summary.isPending} error={summary.error} retry={summary.refetch}>
              {summary.data && (
                <MoneyStats
                  items={[
                    ['Hóa đơn đã phát hành trong kỳ', summary.data.totals.billed],
                    ['Thực thu xác minh trong kỳ', summary.data.totals.receipts],
                    ['Dư nợ kỳ báo cáo', summary.data.totals.debt],
                  ]}
                />
              )}
            </QueryState>
            <InlineError error={policies.error} />
            {query.data.status === 'DRAFT' && (
              <Button
                variant="outline"
                className="justify-self-start"
                onClick={() => setRemove(true)}
              >
                Xóa chi nhánh nháp
              </Button>
            )}
          </>
        )}
      </QueryState>
      <ActionDialog
        title="Xóa chi nhánh nháp?"
        open={remove}
        onOpenChange={setRemove}
        pending={mutation.isPending}
        error={mutation.error}
        onConfirm={() =>
          mutation.mutate({
            path: `/branches/${branchId}`,
            value: { version: query.data?.version },
            method: 'DELETE',
          })
        }
      />
    </OwnerPage>
  )
}
