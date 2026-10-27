import { Field, Panel, QueryState } from '@/components/common/page'
import { managerApi } from '@/services/manager'
import { useState } from 'react'
import { useParams } from 'react-router'
import { ManagerLink, ManagerPage } from './components'
import { useManagerList, useManagerQuery } from './context'
import { InvoiceBuilder } from './finance-shared'
export function ManagerInvoiceEditor() {
  const { invoiceId } = useParams(),
    tenants = useManagerList('tenants', { size: '100' }),
    initial = useManagerQuery(
      'invoice-editor',
      (b) => (invoiceId ? managerApi.invoiceEditor(b, invoiceId) : Promise.resolve(null)),
      [invoiceId],
    ),
    [tenantId, setTenant] = useState(''),
    [month, setMonth] = useState(new Date().toISOString().slice(0, 7)),
    id = initial.data?.contractTenantId || tenantId,
    period = initial.data?.billingMonth || `${month}-01`
  return (
    <ManagerPage
      title={invoiceId ? 'Chỉnh sửa hóa đơn nháp' : 'Lập hóa đơn cá nhân'}
      actions={<ManagerLink to="/manager/invoices">Danh sách hóa đơn</ManagerLink>}
    >
      <QueryState
        pending={tenants.isPending || initial.isPending}
        error={tenants.error || initial.error}
        retry={() => {
          void tenants.refetch()
          void initial.refetch()
        }}
      >
        <Panel>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="invoice-tenant" label="Người chịu nghĩa vụ">
              <select
                id="invoice-tenant"
                className="input"
                value={id}
                disabled={!!invoiceId}
                onChange={(e) => setTenant(e.target.value)}
              >
                <option value="">Chọn quan hệ thuê</option>
                {tenants.data?.content
                  .filter((t) => ['ACTIVE', 'LEFT'].includes(t.status))
                  .map((t) => (
                    <option value={t.id} key={t.id}>
                      {t.userName} · {t.roomName}
                      {t.slotName ? ` · ${t.slotName}` : ''}
                    </option>
                  ))}
              </select>
            </Field>
            <Field id="invoice-month" label="Kỳ hóa đơn">
              <input
                id="invoice-month"
                type="month"
                className="input"
                value={period.slice(0, 7)}
                disabled={!!invoiceId}
                onChange={(e) => setMonth(e.target.value)}
              />
            </Field>
          </div>
        </Panel>
        {id && month && (
          <InvoiceBuilder
            key={`${id}:${period}:${invoiceId}`}
            tenantId={id}
            month={period}
            invoiceId={invoiceId}
            initial={initial.data || undefined}
          />
        )}
      </QueryState>
    </ManagerPage>
  )
}
