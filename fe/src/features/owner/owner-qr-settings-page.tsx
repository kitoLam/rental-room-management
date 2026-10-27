import { InlineError, Notice, Panel, QueryState } from '@/components/common/page'
import { Button } from '@/components/ui/button'
import { ImagePicker } from '@/features/manager/components'
import { ownerApi } from '@/services/owner'
import { useState } from 'react'
import { useParams } from 'react-router'
import { OwnerPage } from './components'
import { useOwnerMutation, useOwnerQuery } from './context'

export function OwnerQrSettings() {
  const { branchId = '' } = useParams(),
    query = useOwnerQuery('branch', () => ownerApi.branch(branchId), [branchId]),
    [images, setImages] = useState<string[]>([]),
    mutation = useOwnerMutation(() => setImages([]))
  return (
    <OwnerPage title="QR nhận tiền" description="Cấu hình QR thủ công theo chi nhánh.">
      <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
        {query.data && (
          <Panel>
            <h2 className="mb-4 font-bold">{query.data.name}</h2>
            <Notice>
              Ảnh QR không xác minh giao dịch. Nội dung chuyển tiền được cấp riêng theo nghĩa vụ.
              Demo không kết nối ngân hàng.
            </Notice>
            {query.data.qrUrl && (
              <img
                src={query.data.qrUrl}
                alt="QR nhận tiền của chi nhánh"
                className="mx-auto my-5 max-h-60 max-w-full rounded-lg"
              />
            )}
            <p className="my-4 break-all text-xs text-muted-foreground">
              Mã tài nguyên: {query.data.qrPublicId || 'Chưa có'} · QR thủ công
            </p>
            <ImagePicker
              value={images}
              onChange={(v) => setImages(v.slice(-1))}
              disabled={mutation.isPending}
            />
            <InlineError error={mutation.error} />
            {mutation.isSuccess && <Notice tone="success">Đã lưu QR chi nhánh.</Notice>}
            <Button
              className="mt-5"
              disabled={!images[0] || mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  path: `/branches/${branchId}/qr`,
                  value: { image: images[0], version: query.data!.version },
                  method: 'PUT',
                })
              }
            >
              {mutation.isPending ? 'Đang lưu…' : 'Lưu QR'}
            </Button>
          </Panel>
        )}
      </QueryState>
    </OwnerPage>
  )
}
