import { Modal, Notice, QueryState } from '@/components/common/page'
import { useSession } from '@/features/auth/session-store'
import { adminApi } from '@/services/admin'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

export function DocumentPreview({
  id,
  version,
  onClose,
}: {
  id: string
  version: string
  onClose: () => void
}) {
  const uid = useSession((s) => s.user!.id),
    query = useQuery({
      queryKey: ['admin-document', uid, id, version],
      queryFn: () => adminApi.document(id),
      retry: false,
      gcTime: 0,
      staleTime: 0,
    }),
    image = useRef<HTMLImageElement>(null),
    [expired, setExpired] = useState(false)
  useEffect(() => {
    if (!query.data) return
    const objectUrl = URL.createObjectURL(new Blob([query.data.content], { type: query.data.mime }))
    const node = image.current
    if (node) node.src = objectUrl
    const timer = setTimeout(
      () => {
        setExpired(true)
        node?.removeAttribute('src')
        URL.revokeObjectURL(objectUrl)
      },
      Math.max(0, Date.parse(query.data.expiresAt) - Date.now()),
    )
    return () => {
      clearTimeout(timer)
      node?.removeAttribute('src')
      URL.revokeObjectURL(objectUrl)
    }
  }, [query.data])
  return (
    <Modal
      title="Tài liệu xác minh"
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Notice>
        Bản xem trước minh họa trong demo, không phải nội dung giấy tờ thật đã tải lên.
      </Notice>
      <div className="mt-5">
        <QueryState pending={query.isPending} error={query.error} retry={query.refetch}>
          {expired ? (
            <Notice tone="warning">
              Phiên xem tài liệu đã hết hạn. Đóng và mở lại để kiểm tra quyền.
            </Notice>
          ) : (
            query.data && (
              <img
                ref={image}
                alt="Tài liệu xác minh giả lập dành cho quản trị viên"
                className="w-full rounded-lg border border-border"
              />
            )
          )}
        </QueryState>
      </div>
    </Modal>
  )
}
