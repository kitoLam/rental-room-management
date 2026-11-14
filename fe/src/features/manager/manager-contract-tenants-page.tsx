import { ContractEvidenceLink } from '@/features/leasing/contract-evidence-link'
import { Pagination, Panel, QueryState } from '@/components/common/page'
import type { ManagerContract, ManagerContractTenant } from '@/interfaces/manager'
import { useSession } from '@/features/auth/session-store'
import { Facts } from '@/features/tenant/components'
import { dateOnly } from '@/lib/activity'
import { branchTenantsService } from '@/services/branch-tenants'
import { bookingService } from '@/services/guest-user'
import { provider } from '@/services/config'
import { useQueries } from '@tanstack/react-query'
import { formatProfileDate, formatVnd } from '@/lib/format'
import { managerApi } from '@/services/manager'
import { useState } from 'react'
import { useParams } from 'react-router'
import { ManagerLink, ManagerPage, ManagerStatus } from './components'
import { useManager, useManagerList, useManagerQuery } from './context'

function ContractMember({ member }: { member: ManagerContractTenant }) {
  const profile = useManagerQuery('contract-member', (branchId) =>
    branchTenantsService.get(branchId, member.tenantId), [member.tenantId])
  const person = profile.data
  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">{person?.fullName || member.tenantName || 'Người thuê'}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {member.isRepresentative ? 'Đại diện ký hợp đồng' : 'Thành viên hợp đồng'}
          </p>
        </div>
        <ManagerStatus value={member.status} />
      </div>
      <Facts items={[
        ['Email', person?.email || member.tenantEmail || '—'],
        ['Điện thoại', person?.phone || '—'],
        ['Ngày sinh', formatProfileDate(person?.dateOfBirth) || '—'],
        ['Giới tính', person?.gender === 'MALE' ? 'Nam' : person?.gender === 'FEMALE' ? 'Nữ' : person?.gender === 'OTHER' ? 'Khác' : '—'],
        ['Phần tiền thuê', member.rentAmount == null ? '—' : `${formatVnd(member.rentAmount)}/tháng`],
        ['Ngày bắt đầu cư trú', dateOnly(member.joinedAt)],
      ]} />
      {profile.isError && <p className="mt-3 text-sm text-muted-foreground">Không tải được hồ sơ liên hệ bổ sung.</p>}
    </Panel>
  )
}

const SIGNED_CONTRACTS_PER_PAGE = 3

function SignedContract({ contract, slotNames }: { contract: ManagerContract; slotNames: Map<string, string> }) {
  const file = contract.signedEvidenceUrl || contract.signedFileUrl
  return (
    <article className="grid min-w-0 gap-3 rounded-xl border border-border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0 break-words">
        <ManagerLink to={`/manager/contracts/${contract.id}`}>{contract.code ?? 'Chưa có mã hợp đồng'}</ManagerLink>
        <p className="text-sm text-muted-foreground">
          {contract.roomSlotIds?.map((id) => slotNames.get(id) || id).join(', ') || 'Chưa có thông tin chỗ thuê'}
        </p>
        {contract.startDate && contract.endDate && (
          <p className="mt-1 text-sm">{dateOnly(contract.startDate)} – {dateOnly(contract.endDate)}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
        <ManagerStatus value={contract.status} />
        {file && /^https?:\/\//i.test(file) && (
          <ContractEvidenceLink key={file} contractId={contract.id}
            evidenceUrl={contract.signedEvidenceUrl} legacyUrl={contract.signedFileUrl} label="Mở bản ký" />
        )}
      </div>
    </article>
  )
}

export function ManagerContractTenants() {
  const { contractId = '' } = useParams()
  return <ContractTenantsContent key={contractId} contractId={contractId} />
}

function ContractTenantsContent({ contractId }: { contractId: string }) {
  const [signedPage, setSignedPage] = useState(1)
  const contract = useManagerQuery(
      'contract',
      (branchId) => managerApi.get(branchId, 'contracts', contractId),
      [contractId],
      true,
    ),
    query = useManagerList('contract-tenants', { contractId, size: '100' }, true),
    { branch } = useManager()
  const roomId = contract.data?.roomId
  const slots = useManagerList('slots', { roomId: roomId || '' }, false, Boolean(roomId))
  const bookingId = contract.data?.sourceBookingId
  const booking = useManagerQuery('contract-source-booking',
    () => bookingService.managerGet(bookingId!), [bookingId], false,
    Boolean(bookingId && provider('manager') === 'real'))
  const relatedIds = [...new Set([
    ...(booking.data?.contractIds ?? []),
    ...(contract.data?.renewedFromContractId ? [contract.data.renewedFromContractId] : []),
    ...(contract.data?.renewedToContractId ? [contract.data.renewedToContractId] : []),
  ])].filter((id) => id !== contractId)
  const userId = useSession((state) => state.user?.id)
  const related = useQueries({
    queries: relatedIds.map((id) => ({
      queryKey: ['manager', userId, branch.id, 'contract-related', contractId, id],
      queryFn: () => managerApi.get(branch.id, 'contracts', id),
    })),
  })
  const slotNames = new Map(slots.data?.content.map((slot) => [slot.id, slot.code]))
  booking.data?.roomSlotIds.forEach((id, index) => {
    const label = booking.data?.slotLabels[index]
    if (label && !slotNames.has(id)) slotNames.set(id, label)
  })
  const slotIds = [...new Set([
    ...(contract.data?.roomSlotIds ?? []),
    ...(query.data?.content.flatMap((member) => member.roomSlotIds ?? []) ?? []),
  ])]
  const signedContracts = [contract.data, ...related.map((item) => item.data)]
    .filter((item): item is ManagerContract => Boolean(item && (item.signedFileUrl || item.signedEvidenceUrl)))

  const totalSignedPages = Math.max(1, Math.ceil(signedContracts.length / SIGNED_CONTRACTS_PER_PAGE))
  const currentSignedPage = Math.min(signedPage, totalSignedPages)
  const firstSignedIndex = (currentSignedPage - 1) * SIGNED_CONTRACTS_PER_PAGE
  const visibleSignedContracts = signedContracts.slice(firstSignedIndex, firstSignedIndex + SIGNED_CONTRACTS_PER_PAGE)

  return (
    <ManagerPage
      title="Người ký và chỗ thuê"
      description={contract.data?.code ?? undefined}
      actions={<ManagerLink to={`/manager/contracts/${contractId}`}>Chi tiết hợp đồng</ManagerLink>}
    >
      <QueryState pending={contract.isPending} error={contract.error} retry={() => void contract.refetch()}>
        {contract.data && (
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <section className="min-w-0 space-y-4">
              <h2 className="text-lg font-bold">Người ký và thành viên</h2>
              <QueryState pending={query.isPending} error={query.error} retry={() => void query.refetch()}>
                {query.data?.content.map((member) => (
                  <ContractMember key={member.id} member={member} />
                ))}
                {query.data?.content.length === 0 && <Panel>Chưa có thành viên trong hợp đồng.</Panel>}
              </QueryState>
            </section>
            <div className="grid min-w-0 gap-4">
              <h2 className="text-lg font-bold">Chỗ thuê</h2>
              <Panel>
                <Facts items={[
                  ['Phòng', contract.data.roomName || '—'],
                  ['Slot đã ký', slotIds.map((id) => slotNames.get(id) || id).join(', ') || '—'],
                  ['Bắt đầu thuê', contract.data.startDate ? dateOnly(contract.data.startDate) : '—'],
                  ['Kết thúc thuê', contract.data.endDate ? dateOnly(contract.data.endDate) : '—'],
                  ['Tiền thuê/tháng', contract.data.rentPrice == null ? '—' : formatVnd(contract.data.rentPrice)],
                  ['Tiền cọc', contract.data.contractDepositAmount == null ? '—' : formatVnd(contract.data.contractDepositAmount)],
                ]} />
                <dl className="mt-5 border-t border-border pt-4">
                  <dt className="text-xs text-muted-foreground">Địa chỉ thuê</dt>
                  <dd className="mt-1 break-words text-sm font-bold leading-6">{contract.data.roomAddress || '—'}</dd>
                </dl>
              </Panel>
              <Panel>
                <h2 className="mb-4 text-lg font-bold">Hợp đồng đã ký</h2>
                <div className="grid gap-3">
                  {visibleSignedContracts.map((item) => <SignedContract key={item.id} contract={item} slotNames={slotNames} />)}
                </div>
                <Pagination page={currentSignedPage} totalPages={totalSignedPages} onPage={setSignedPage} />
                {booking.isFetching || related.some((item) => item.isPending) ? (
                  <p className="text-sm text-muted-foreground">Đang tải hợp đồng liên quan…</p>
                ) : !signedContracts.length && (
                  <p className="text-sm text-muted-foreground">Chưa có bản ký được lưu.</p>
                )}
                {(booking.isError || related.some((item) => item.isError)) && (
                  <p className="mt-2 text-sm text-muted-foreground">Một số hợp đồng liên quan chưa tải được.</p>
                )}
              </Panel>
            </div>
          </div>
        )}
      </QueryState>
    </ManagerPage>
  )
}
