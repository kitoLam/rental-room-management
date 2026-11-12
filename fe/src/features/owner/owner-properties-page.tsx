import { Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-store'
import { ownerProperties, propertyTypes } from '@/services/owner-properties'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Building2, MapPin, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { OwnerPage } from './components'

export function OwnerProperties() {
  const userId = useSession((s) => s.user?.id)
  const query = useQuery({
    queryKey: ['owner-properties', userId],
    queryFn: ownerProperties.list,
    retry: false,
  })
  const [search, setSearch] = useState('')
  const items =
    query.data?.filter((b) =>
      `${b.name} ${b.address}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')),
    ) || []
  return (
    <OwnerPage
      title="Chi nhánh của tôi"
      description="Đăng ký chi nhánh trước, sau đó thêm các phòng thuộc chi nhánh của bạn."
      actions={
        <Button asChild>
          <Link to="/owner/branches/new">
            <Plus />
            Đăng ký chi nhánh
          </Link>
        </Button>
      }
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Panel>
          <p className="text-sm text-muted-foreground">Chi nhánh sở hữu</p>
          <p className="mt-2 text-[2rem] font-bold text-primary">{query.data?.length ?? '—'}</p>
        </Panel>
        <Panel>
          <p className="text-sm text-muted-foreground">Phòng đã đăng ký</p>
          <p className="mt-2 text-[2rem] font-bold text-primary">
            {query.data?.reduce((sum, b) => sum + b.roomCount, 0) ?? '—'}
          </p>
        </Panel>
      </div>
      <label className="mb-6 block">
        <span className="sr-only">Tìm chi nhánh</span>
        <input
          className="input"
          placeholder="Tìm theo tên hoặc địa chỉ chi nhánh…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
        empty={items.length === 0}
        emptyMessage={
          search
            ? 'Không có chi nhánh phù hợp.'
            : 'Bạn chưa đăng ký chi nhánh. Hãy tạo chi nhánh đầu tiên để bắt đầu thêm phòng.'
        }
        emptyAction={
          !search && (
            <Button asChild>
              <Link to="/owner/branches/new">Đăng ký chi nhánh đầu tiên</Link>
            </Button>
          )
        }
      >
        <div className="grid gap-6 xl:grid-cols-2">
          {items.map((b) => (
            <Link
              key={b.id}
              to={`/owner/branches/${b.id}`}
              className="group rounded-2xl border border-border bg-surface p-6 transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-primary sm:p-8"
            >
              <div className="mb-5 flex items-center justify-between">
                <span className="rounded-xl bg-primary-soft p-3 text-primary">
                  <Building2 />
                </span>
                <span className="text-xs font-semibold text-primary">
                  {b.propertyType ? propertyTypes[b.propertyType] : 'Chưa khai báo loại hình'}
                </span>
              </div>
              <h2 className="text-xl font-bold group-hover:text-primary">{b.name}</h2>
              <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                <MapPin className="mt-1 size-4 shrink-0" />
                {b.address}
              </p>
              <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-border pt-5 text-sm">
                <span>
                  <strong>{b.roomCount}</strong> / {b.declaredRoomCount ?? '—'} phòng đã đăng ký
                </span>
                <span className="flex items-center gap-2 font-bold text-primary">
                  Xem các phòng <ArrowUpRight className="size-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </QueryState>
    </OwnerPage>
  )
}
