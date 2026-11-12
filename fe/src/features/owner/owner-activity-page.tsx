import { Records } from '@/features/manager/components'
import { dateTime } from '@/lib/activity'
import { Link } from 'react-router'
import { OwnerFilters, OwnerPage } from './components'
import { useOwner, useOwnerFilters, useOwnerList } from './context'

export function OwnerActivityPage() {
  const state = useOwnerFilters({ month: '', type: '' }),
    query = useOwnerList('activity', state.filters),
    { branches } = useOwner()
  return (
    <OwnerPage
      title="Hoạt động quan trọng"
      description="Theo dõi thay đổi phân công, chính sách và chứng từ trong phạm vi chủ trọ."
    >
      <OwnerFilters state={state} period>
        <select
          aria-label="Loại hoạt động"
          className="input w-auto"
          value={state.filters.type}
          onChange={(e) => state.change('type', e.target.value)}
        >
          <option value="">Mọi hoạt động</option>
          {[
            ['BRANCH', 'Chi nhánh'],
            ['ASSIGNMENT', 'Phân công'],
            ['INVITATION', 'Lời mời'],
            ['POLICY', 'Chính sách'],
            ['QR', 'QR nhận tiền'],
            ['INVOICE', 'Hóa đơn'],
            ['PAYMENT', 'Giao dịch'],
            ['APPROVAL_REQUEST', 'Yêu cầu duyệt'],
            ['APPROVAL_DECISION', 'Quyết định duyệt'],
            ['MAINTENANCE', 'Sửa chữa'],
          ].map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </OwnerFilters>
      <Records
        query={query}
        page={state.page}
        onPage={state.onPage}
        empty="Chưa có hoạt động phù hợp."
        columns={[
          {
            label: 'Sự kiện',
            render: (a) => (
              <>
                {a.summary}
                {a.route && (
                  <Link className="mt-2 block text-xs font-bold text-primary" to={a.route}>
                    Mở hồ sơ liên quan
                  </Link>
                )}
              </>
            ),
          },
          {
            label: 'Chi nhánh',
            render: (a) => branches.find((b) => b.id === a.branchId)?.name || 'Quan hệ chủ trọ',
          },
          { label: 'Người thực hiện', render: (a) => a.actorName },
          { label: 'Thời gian', render: (a) => dateTime(a.at) },
        ]}
      />
    </OwnerPage>
  )
}
