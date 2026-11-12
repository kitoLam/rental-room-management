import { Modal } from '@/components/common/page'
import { Records } from '@/features/manager/components'
import { Facts } from '@/features/tenant/components'
import { dateTime } from '@/lib/activity'
import { request } from '@/services/http'
import { provider } from '@/services/config'
import { adminApi } from '@/services/admin'
import { z } from 'zod'
import { useState } from 'react'
import { AdminFilters, AdminPage, AdminStatus } from './components'
import { useAdminFilters, useAdminQuery } from './context'

const branchResponseSchema = z.object({
  content: z.array(z.object({
    id: z.string(),
    name: z.string(),
    address: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    description: z.string().nullable(),
    status: z.string(),
    createdAt: z.string().nullable(),
    updatedAt: z.string().nullable(),
    ownerAccountId: z.string().nullable(),
    electricityRate: z.number().nullable(),
    waterRate: z.number().nullable(),
    parkingRate: z.number().nullable(),
  })),
  number: z.number(),
  size: z.number(),
  totalElements: z.number(),
  totalPages: z.number(),
})

async function fetchBranches(filters: Record<string, string>) {
  if (provider('admin') === 'real' || provider('manager') === 'real') {
    try {
      const query = new URLSearchParams({
        page: filters.page || '0',
        size: filters.size || '8',
      })
      if (filters.status) query.set('status', filters.status)
      if (filters.q) query.set('keyword', filters.q)
      const page = await request('admin', `/api/v1/branches?${query}`, branchResponseSchema)
      return {
        content: page.content.map((b) => ({
          id: b.id,
          code: b.id.slice(0, 8).toUpperCase(),
          name: b.name,
          province: '',
          address: b.address || '',
          status: (['DRAFT', 'ACTIVE', 'INACTIVE'].includes(b.status) ? b.status : 'ACTIVE') as 'DRAFT' | 'ACTIVE' | 'INACTIVE',
          ownerId: b.ownerAccountId || '',
          ownerName: b.ownerAccountId ? 'Chủ trọ' : 'Chưa có',
          managerId: null,
          managerName: null as string | null,
          createdAt: b.createdAt,
          phone: b.phone,
          email: b.email,
          description: b.description,
        })),
        number: Math.max(0, page.number - 1),
        size: page.size,
        totalElements: page.totalElements,
        totalPages: page.totalPages,
      }
    } catch (err) {
      console.error('Failed to fetch branches from real API:', err)
      if (provider('admin') !== 'mock') {
        return {
          content: [],
          number: 0,
          size: Number(filters.size || 8),
          totalElements: 0,
          totalPages: 0,
        }
      }
    }
  }
  return adminApi.list('branches', filters)
}

export function AdminBranches() {
  const state = useAdminFilters({ status: '' }),
    query = useAdminQuery('branches', () => fetchBranches(state.filters), [
      state.filters,
    ]),
    [selected, setSelected] = useState<string | null>(null),
    branch = query.data?.content.find((b: any) => b.id === selected) as any
  return (
    <AdminPage
      title="Danh bạ chi nhánh"
      description="Hiển thị tất cả các chi nhánh hiện có trong hệ thống."
    >
      <AdminFilters state={state} statuses={['DRAFT', 'ACTIVE', 'INACTIVE']} />
      <Records
        query={query}
        page={state.page}
        onPage={state.onPage}
        empty="Chưa có chi nhánh phù hợp."
        columns={[
          {
            label: 'Chi nhánh',
            render: (b: any) => (
              <button
                className="min-h-11 text-left text-sm font-bold text-primary"
                onClick={() => setSelected(b.id)}
              >
                {b.name}
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {b.code}
                </span>
              </button>
            ),
          },
          { label: 'Địa chỉ', render: (b: any) => b.address || 'Chưa cung cấp' },
          { label: 'Trạng thái', render: (b: any) => <AdminStatus value={b.status} /> },
          {
            label: 'Liên hệ',
            render: (b: any) => (
              <>
                {b.phone && <p className="text-sm">{b.phone}</p>}
                {b.email && <p className="text-xs text-muted-foreground">{b.email}</p>}
                {!b.phone && !b.email && <span className="text-xs text-muted-foreground">Chưa cung cấp</span>}
              </>
            ),
          },
        ]}
      />
      <Modal
        title="Thông tin chi nhánh"
        open={!!branch}
        onOpenChange={(v) => {
          if (!v) setSelected(null)
        }}
      >
        {branch && (
          <Facts
            items={[
              ['Mã chi nhánh', <span className="break-all">{branch.id}</span>],
              ['Tên', branch.name],
              ['Địa chỉ', branch.address || 'Chưa cung cấp'],
              ['Điện thoại', branch.phone || 'Chưa cung cấp'],
              ['Email', branch.email || 'Chưa cung cấp'],
              ['Mô tả', branch.description || 'Chưa cung cấp'],
              ['Trạng thái', <AdminStatus value={branch.status} />],
              [
                'Ngày tạo',
                branch.createdAt ? dateTime(branch.createdAt) : 'Chưa cung cấp',
              ],
            ]}
          />
        )}
      </Modal>
    </AdminPage>
  )
}
