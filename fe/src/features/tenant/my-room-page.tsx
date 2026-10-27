import { InlineError, Modal, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { dateOnly } from '@/lib/activity'
import { safeZalo } from '@/lib/tenant-finance'
import { tenantApi } from '@/services/tenant'
import { ExternalLink, MapPin } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Facts, TenantLink, TenantPage, TenantStatus } from './components'
import { isActive, useTenant, useTenantQuery } from './context'

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
