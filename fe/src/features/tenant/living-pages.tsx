import { useState } from 'react'
import { useParams, Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, MapPin, ExternalLink } from 'lucide-react'
import { useSession } from '@/features/auth/session-store'
import { useTenant, useTenantQuery, tenantLink, isActive } from './context'
import { Facts, TenantLink, TenantPage, TenantStatus, EmptyRows } from './components'
import { InlineError, Modal, Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { tenantApi } from '@/services/tenant'
import { notificationService } from '@/services/guest-user'
import { dateOnly, dateTime, referenceLink } from '@/lib/activity'
import { formatVnd } from '@/lib/format'
import { safeZalo } from '@/lib/tenant-finance'
import { PrepaidPanel } from './prepaid-panel'

export function TenantDashboard() {
  const { tenancy: t } = useTenant(),
    userId = useSession((s) => s.user!.id)
  const invoices = useTenantQuery('invoices', tenantApi.invoices, [], true),
    reports = useTenantQuery('maintenance', tenantApi.reports, [], true),
    services = useTenantQuery('services', tenantApi.services, [], true)
  const notifications = useQuery({
    queryKey: ['notifications', userId, 'tenant-dashboard'],
    queryFn: () => notificationService.list('', 1),
    refetchInterval: 30000,
  })
  const debt = (invoices.data || []).reduce((s, i) => s + i.outstanding, 0),
    due = (invoices.data || [])
      .filter((i) => i.outstanding > 0)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
  return (
    <TenantPage
      title="Một nơi an tâm để ở."
      description={`${t.roomName}${t.slotName ? ` · ${t.slotName}` : ''} — ${t.branchName}`}
      actions={
        <TenantLink to="/tenant/my-room" button>
          Xem chỗ ở
        </TenantLink>
      }
    >
      <QueryState pending={invoices.isPending} error={invoices.error} retry={invoices.refetch}>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['Công nợ của bạn', formatVnd(debt)],
            ['Hạn thanh toán gần nhất', due ? dateOnly(due.dueDate) : 'Không có khoản đến hạn'],
            ['Hợp đồng', isActive(t) ? `Đến ${dateOnly(t.endDate)}` : 'Hồ sơ lịch sử'],
          ].map(([label, value]) => (
            <Panel key={label} className="sm:p-5">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-3 text-xl font-bold tabular-nums">{value}</p>
            </Panel>
          ))}
        </div>
        <Panel>
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="font-bold">Hóa đơn gần đây</h2>
            <TenantLink to="/tenant/invoices">Tất cả hóa đơn</TenantLink>
          </div>
          {invoices.data
            ?.filter((i) => i.documentStatus === 'ISSUED')
            .slice(0, 3)
            .map((i) => (
              <Link
                key={i.id}
                to={tenantLink(`/tenant/invoices/${i.id}`, t)}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-4"
              >
                <div>
                  <p className="text-sm font-bold">{i.code}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Kỳ {i.billingMonth.slice(0, 7)} · Hạn {dateOnly(i.dueDate)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold tabular-nums">{formatVnd(i.outstanding)}</span>
                  <ArrowRight size={16} />
                </div>
              </Link>
            ))}
          {!invoices.data?.length && <EmptyRows />}
        </Panel>
      </QueryState>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel>
          <h2 className="mb-4 font-bold">Việc đang chờ</h2>
          <InlineError error={reports.error || services.error} />
          <p className="text-sm leading-7">
            <TenantLink to="/tenant/maintenance">
              Bảo trì:{' '}
              {reports.data?.filter((r) => ['OPEN', 'ACCEPTED', 'IN_PROGRESS'].includes(r.status))
                .length ?? '…'}{' '}
              yêu cầu
            </TenantLink>
          </p>
          <TenantLink to="/tenant/services">
            Dịch vụ:{' '}
            {services.data?.filter((s) => ['PENDING', 'CANCEL_REQUESTED'].includes(s.status || ''))
              .length ?? '…'}{' '}
            chờ duyệt
          </TenantLink>
        </Panel>
        <Panel>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Cập nhật mới</h2>
            <Link to="/notifications" className="text-xs text-primary underline">
              Tất cả
            </Link>
          </div>
          <QueryState
            pending={notifications.isPending}
            error={notifications.error}
            retry={notifications.refetch}
            empty={notifications.data?.content.length === 0}
            emptyMessage="Chưa có cập nhật mới."
            emptyAction={null}
          >
            {notifications.data?.content.slice(0, 3).map((n) => {
              const to = referenceLink(n.referenceType, n.referenceId, n.contractTenantId)
              return (
                <div key={n.id} className="border-t border-border py-3 text-sm">
                  {to ? (
                    <Link to={to} className="font-bold hover:text-primary">
                      {n.title}
                    </Link>
                  ) : (
                    n.title
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">{dateTime(n.createdAt)}</p>
                </div>
              )
            })}
          </QueryState>
        </Panel>
      </div>
    </TenantPage>
  )
}
export function MyRoomPage() {
  const { tenancy: t } = useTenant(),
    room = useTenantQuery('room', tenantApi.room),
    services = useTenantQuery('services', tenantApi.services, [], true),
    [image, setImage] = useState<string | null>(null)
  const zalo = isActive(t) ? safeZalo(room.data?.zaloUrl || null) : null
  return (
    <TenantPage
      title="Chỗ ở của tôi"
      description={`${t.roomName}${t.slotName ? ` · ${t.slotName}` : ''}`}
    >
      <QueryState pending={room.isPending} error={room.error} retry={room.refetch}>
        {room.data && (
          <>
            <div className="grid grid-cols-3 gap-2 overflow-hidden rounded-xl">
              {room.data.images.slice(0, 3).map((src, i) => (
                <button
                  key={src}
                  className={
                    i === 0 ? 'col-span-3 sm:col-span-2 sm:row-span-2' : 'col-span-1 sm:col-span-1'
                  }
                  onClick={() => setImage(src)}
                  aria-label={`Xem ảnh phòng ${i + 1}`}
                >
                  <img
                    src={src}
                    alt={`Không gian ${t.roomName}, ảnh ${i + 1}`}
                    className="h-full max-h-80 min-h-24 w-full object-cover"
                    loading={i === 0 ? 'eager' : 'lazy'}
                  />
                </button>
              ))}
            </div>
            <Panel>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">
                    {t.roomName}
                    {t.slotName && ` · ${t.slotName}`}
                  </h2>
                  <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin size={15} />
                    {t.branchName}
                  </p>
                </div>
                <TenantStatus value={t.status} />
              </div>
              <Facts
                items={[
                  [
                    'Loại hình',
                    t.rentalMode === 'SLOT' ? 'Thuê chỗ trong phòng chung' : 'Thuê nguyên phòng',
                  ],
                  [
                    'Không gian',
                    `${room.data.roomType} · ${room.data.area} m² · Tầng ${room.data.floor}`,
                  ],
                  [
                    'Thời gian thuê',
                    `${dateOnly(t.startDate)} – ${dateOnly(t.endDate)} (không gồm ngày kết thúc)`,
                  ],
                  ['Tiện nghi', room.data.amenities.join(', ')],
                ]}
              />
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
                <TenantLink to={`/tenant/contracts/${t.contractId}`}>Hợp đồng</TenantLink>
                <TenantLink to="/tenant/services">Dịch vụ</TenantLink>
                {isActive(t) && <TenantLink to="/tenant/maintenance/new">Báo hỏng</TenantLink>}
                <Link
                  to={`/branches/${t.branchId}`}
                  className="inline-flex min-h-11 items-center text-sm text-primary"
                >
                  Xem chi nhánh
                </Link>
              </div>
            </Panel>
            <div className="grid gap-6 xl:grid-cols-2">
              <Panel>
                <h2 className="mb-5 font-bold">Tài sản & dịch vụ</h2>
                {room.data.assets.map((a) => (
                  <div
                    key={a.id}
                    className="flex justify-between gap-4 border-t border-border py-3 text-sm"
                  >
                    <span>{a.name}</span>
                    <span className="text-muted-foreground">{a.condition}</span>
                  </div>
                ))}
                <InlineError error={services.error} />
                {services.data
                  ?.filter((s) => !s.mandatory && s.status === 'APPROVED')
                  .map((s) => (
                    <p key={s.id} className="border-t border-border py-3 text-sm">
                      {s.name} · Đang sử dụng
                    </p>
                  ))}
              </Panel>
              <Panel>
                <h2 className="mb-5 font-bold">Sinh hoạt & liên hệ</h2>
                <ul className="mb-5 list-disc space-y-2 pl-4 text-sm text-muted-foreground">
                  {room.data.rules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <p className="text-sm font-bold">{room.data.manager.name}</p>
                <a
                  href={`tel:${room.data.manager.phone}`}
                  className="inline-flex min-h-11 items-center text-sm text-primary"
                >
                  {room.data.manager.phone}
                </a>
                <div className="mt-3">
                  {zalo ? (
                    <Button asChild variant="outline">
                      <a href={zalo} target="_blank" rel="noopener noreferrer">
                        Nhóm Zalo chi nhánh
                        <ExternalLink size={16} />
                      </a>
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" disabled>
                        Nhóm Zalo chưa khả dụng
                      </Button>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {isActive(t)
                          ? 'Chi nhánh chưa cung cấp liên kết nhóm hợp lệ.'
                          : 'Chỉ dành cho quan hệ thuê đang hiệu lực.'}
                      </p>
                    </>
                  )}
                </div>
              </Panel>
            </div>
          </>
        )}
      </QueryState>
      <Modal open={!!image} onOpenChange={() => setImage(null)} title={`Ảnh ${t.roomName}`}>
        {image && (
          <img src={image} alt={`Ảnh mở rộng ${t.roomName}`} className="w-full rounded-lg" />
        )}
      </Modal>
    </TenantPage>
  )
}
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
export function ContractDetailPage({ terms = false }: { terms?: boolean }) {
  const { contractId = '' } = useParams(),
    { tenancy: t } = useTenant(),
    query = useTenantQuery('contract', (id) => tenantApi.contract(id, contractId), [contractId]),
    payments = useTenantQuery('payments', tenantApi.payments)
  const prepaid = (payments.data || []).filter((p) => p.status === 'VERIFIED' && !p.invoiceId)
  return (
    <TenantPage
      title={terms ? 'Điều khoản cá nhân' : 'Chi tiết hợp đồng'}
      actions={<TenantLink to="/tenant/contracts">Danh sách hợp đồng</TenantLink>}
    >
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <>
            <Panel>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold">{query.data.code}</h2>
                <TenantStatus value={terms ? t.status : t.contractStatus} />
              </div>
              <Facts
                items={
                  terms
                    ? [
                        ['Quan hệ thuê', t.id],
                        ['Chỗ ở', `${t.roomName}${t.slotName ? ` · ${t.slotName}` : ''}`],
                        ['Tiền thuê thỏa thuận / tháng', formatVnd(t.monthlyRent)],
                        [
                          'Kỳ đầu / kỳ cuối',
                          `${formatVnd(t.firstMonthRent)} / ${formatVnd(t.lastMonthRent)}`,
                        ],
                        ['Trả trước kỳ đầu yêu cầu', formatVnd(t.prepaidFirstRequired)],
                        ['Trả trước kỳ cuối yêu cầu', formatVnd(t.prepaidLastRequired)],
                        ['Thời hạn cá nhân', `${dateOnly(t.startDate)} – ${dateOnly(t.endDate)}`],
                        [
                          'Ngày rời đi thực tế',
                          t.actualLeaveDate ? dateOnly(t.actualLeaveDate) : 'Chưa có',
                        ],
                      ]
                    : [
                        ['Chi nhánh', t.branchName],
                        ['Phòng', t.roomName],
                        [
                          'Hình thức thuê',
                          t.rentalMode === 'SLOT' ? 'Thuê chỗ' : 'Thuê nguyên phòng',
                        ],
                        [
                          'Thời hạn',
                          `${dateOnly(t.startDate)} – ${dateOnly(t.endDate)} (không gồm ngày kết thúc)`,
                        ],
                        [
                          'Vai trò của bạn',
                          t.role === 'REPRESENTATIVE' ? 'Đại diện' : 'Thành viên',
                        ],
                        ['Trạng thái quan hệ cá nhân', <TenantStatus value={t.status} />],
                      ]
                }
              />
              <p className="mt-6 border-t border-border pt-5 text-sm leading-7 text-muted-foreground">
                {terms ? t.terms : t.sharedTerms}
              </p>
              {!terms && (
                <div className="mt-4">
                  <TenantLink to={`/tenant/contracts/${t.contractId}/my-terms`}>
                    Điều khoản & nghĩa vụ của tôi
                  </TenantLink>
                </div>
              )}
            </Panel>
            {terms ? (
              <>
                <PrepaidPanel/>
                <Panel>
                  <h2 className="mb-5 font-bold">Tiền thuê trả trước</h2>
                  <QueryState
                    pending={payments.isPending}
                    error={payments.error}
                    retry={payments.refetch}
                  >
                    {prepaid.length ? (
                      prepaid.map((p) => (
                        <div key={p.id} className="grid gap-4">
                          <Facts
                            items={[
                              ['Đã xác minh kỳ đầu', formatVnd(p.prepaidFirstAmount)],
                              ['Đã xác minh kỳ cuối', formatVnd(p.prepaidLastAmount)],
                              ['Đã áp dụng kỳ đầu', formatVnd(p.prepaidFirstApplied)],
                              ['Đã áp dụng kỳ cuối', formatVnd(p.prepaidLastApplied)],
                            ]}
                          />
                          <p className="break-all text-xs text-muted-foreground">
                            Nguồn tiền: {p.reference}
                          </p>
                        </div>
                      ))
                    ) : (
                      <EmptyRows>Chưa có khoản trả trước đã xác minh.</EmptyRows>
                    )}
                  </QueryState>
                </Panel>
                <Notice>
                  Trả trước được áp dụng từ nguồn tiền đã nhận, không tạo thêm giao dịch thu tiền.
                  Số tiền theo hồ sơ đã duyệt; chính sách tháng lẻ và hoàn trả chưa được chốt.
                </Notice>
                <TenantLink to="/tenant/invoices">Hóa đơn của quan hệ thuê này</TenantLink>
              </>
            ) : (
              <Panel>
                <h2 className="mb-3 font-bold">Văn bản hợp đồng</h2>
                {t.document ? (
                  <a
                    href={t.document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 text-sm text-primary"
                  >
                    {t.document.name}
                    <ExternalLink size={16} />
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Chưa có văn bản được cung cấp. Liên hệ quản lý để nhận bản hợp đồng.
                  </p>
                )}
              </Panel>
            )}
          </>
        )}
      </QueryState>
    </TenantPage>
  )
}
export const MyTermsPage = () => <ContractDetailPage terms />
