const vndFormatter = new Intl.NumberFormat('vi-VN')

/** 1500000 -> "1.500.000 ₫" (brief mục 7) */
export function formatVnd(amount: number): string {
  return `${vndFormatter.format(amount)} ₫`
}

/** Date | ISO string -> "dd/MM/yyyy" */
export function formatDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${date.getFullYear()}`
}
