import { Panel } from '@/components/common/page'
import { dateOnly } from '@/lib/activity'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyRows, Facts, TenantPage, TenantStatus } from './components'
import { tenantLink, useTenant } from './context'

export function ContractsPage() {
  const { tenancy: t, tenancies } = useTenant(),
    [status, setStatus] = useState(''),
    [search, setSearch] = useState('')
  const records = tenancies.filter(
    (v) =>
      (!status || v.contractStatus === status) &&
      `${v.code} ${v.roomName} ${v.branchName}`.toLowerCase().includes(search.toLowerCase()),
  )
  return (
    <TenantPage title="Hợp đồng thuê" description="Hồ sơ được cấp quyền cho tài khoản của bạn.">
      <div className="flex flex-wrap gap-3">
        <input
          className="input min-w-0 flex-1"
          aria-label="Tìm hợp đồng"
          placeholder="Mã hợp đồng, phòng hoặc chi nhánh"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input w-auto"
          aria-label="Trạng thái hợp đồng"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang hiệu lực</option>
          <option value="ENDED">Đã kết thúc</option>
          <option value="DRAFT">Bản nháp</option>
          <option value="CANCELLED">Đã hủy</option>
        </select>
      </div>
      {records.length ? (
        records.map((v) => (
          <Panel key={v.id}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold">{v.code}</h2>
              <TenantStatus value={v.contractStatus} />
            </div>
            <Facts
              items={[
                ['Chỗ ở', `${v.roomName}${v.slotName ? ` · ${v.slotName}` : ''}`],
                ['Chi nhánh', v.branchName],
                ['Thời hạn', `${dateOnly(v.startDate)} – ${dateOnly(v.endDate)}`],
                ['Vai trò của bạn', v.role === 'REPRESENTATIVE' ? 'Đại diện' : 'Thành viên'],
              ]}
            />
            <Link
              className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary"
              to={tenantLink(`/tenant/contracts/${v.contractId}`, v)}
            >
              Xem hợp đồng
              <ArrowRight size={16} />
            </Link>
            {t.id === v.id && <span className="ml-3 text-xs text-muted-foreground">Đang chọn</span>}
          </Panel>
        ))
      ) : (
        <EmptyRows>Không có hợp đồng phù hợp.</EmptyRows>
      )}
    </TenantPage>
  )
}
