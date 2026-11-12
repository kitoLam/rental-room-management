/** Readable state of a slot contract in the sign → submit → approve flow. */
export function contractStage(c: {
  status: string
  evidenceSubmittedAt?: string | null
  evidenceNote?: string | null
}): { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' } {
  if (c.status === 'ACTIVE') return { label: 'Đang hiệu lực', tone: 'success' }
  if (c.status === 'TERMINATED') return { label: 'Đã huỷ', tone: 'neutral' }
  if (c.status === 'EXPIRED') return { label: 'Đã kết thúc', tone: 'neutral' }
  if (c.evidenceSubmittedAt) return { label: 'Chờ duyệt', tone: 'info' }
  if (c.evidenceNote) return { label: 'Cần gửi lại', tone: 'danger' }
  return { label: 'Chờ ký & nộp', tone: 'warning' }
}
