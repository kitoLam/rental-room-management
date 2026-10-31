import { Panel, QueryState } from '@/components/common/page'
import { dateOnly } from '@/lib/activity'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import type { TenantContract, Tenancy } from '@/interfaces/tenant'
import { tenantApi } from '@/services/tenant'
import { EmptyRows, Facts, TenantPage, TenantStatus } from './components'
import { tenantLink, useTenant, useTenantQuery } from './context'

type ContractCard = {
  id: string
  contractId: string
  code: string
  status: string
  roomName: string
  branchName: string
  startDate: string
  endDate: string
  role: string
  selectedTenancy: boolean
}

function contractCards(items: TenantContract[] | Tenancy[], selectedContractId: string): ContractCard[] {
  return items.map((item) => {
    if ('contractNumber' in item) {
      return {
        id: item.id,
        contractId: item.id,
        code: item.contractNumber,
        status: item.status,
        roomName: item.roomSlotId ? 'Chỗ ở theo slot' : 'Phòng thuê',
        branchName: item.roomAddress || 'Địa chỉ chưa cập nhật',
        startDate: item.startDate,
        endDate: item.endDate,
        role: '',
        selectedTenancy: item.id === selectedContractId,
      }
    }
    return {
      id: item.id,
      contractId: item.contractId,
      code: item.code,
      status: item.contractStatus,
      roomName: `${item.roomName}${item.slotName ? ` · ${item.slotName}` : ''}`,
      branchName: item.branchName,
      startDate: item.startDate,
      endDate: item.endDate,
      role: item.role === 'REPRESENTATIVE' ? 'Đại diện' : 'Thành viên',
      selectedTenancy: item.id === selectedContractId,
    }
  })
}

export function ContractsPage() {
  const { tenancy: t } = useTenant(),
    query = useTenantQuery<TenantContract[] | Tenancy[]>(
      'contracts',
      () => tenantApi.contracts(),
    ),
    [status, setStatus] = useState(''),
    [search, setSearch] = useState('')
  const records = contractCards(query.data || [], t.contractId).filter(
    (v) =>
      (!status || v.status === status) &&
      `${v.code} ${v.roomName} ${v.branchName}`.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <TenantPage title="Hợp đồng thuê" description="Hợp đồng được cấp quyền cho tài khoản của bạn.">
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
          <option value="DRAFT">Bản nháp</option>
          <option value="EXPIRED">Đã hết hạn</option>
          <option value="TERMINATED">Đã chấm dứt</option>
          <option value="ENDED">Đã kết thúc</option>
          <option value="CANCELLED">Đã hủy</option>
        </select>
      </div>
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {records.length ? (
          records.map((v) => (
            <Panel key={v.id}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-bold">{v.code}</h2>
                <TenantStatus value={v.status} />
              </div>
              <Facts
                items={[
                  ['Phòng / chỗ ở', v.roomName],
                  ['Địa chỉ thuê', v.branchName],
                  ['Thời hạn', `${dateOnly(v.startDate)} – ${dateOnly(v.endDate)}`],
                  ...(v.role ? [['Vai trò của bạn', v.role] as [string, string]] : []),
                ]}
              />
              <Link
                className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary"
                to={tenantLink(`/tenant/contracts/${v.contractId}`, t)}
              >
                Xem hợp đồng
                <ArrowRight size={16} />
              </Link>
              {v.selectedTenancy && <span className="ml-3 text-xs text-muted-foreground">Đang chọn</span>}
            </Panel>
          ))
        ) : (
          <EmptyRows>Không có hợp đồng phù hợp.</EmptyRows>
        )}
      </QueryState>
    </TenantPage>
  )
}
