/** Integer VND allocation using [start, end), largest remainder, UUID tie-break. */
export function residentDays(start: string, end: string, from: string, to: string) {
  return Math.max(
    0,
    Math.round(
      (Math.min(Date.parse(end), Date.parse(to)) - Math.max(Date.parse(start), Date.parse(from))) /
        86400000,
    ),
  )
}
export function allocateVnd(total: number, participants: { id: string; days: number }[]) {
  if (
    !Number.isSafeInteger(total) ||
    total < 0 ||
    !participants.length ||
    new Set(participants.map((p) => p.id)).size !== participants.length ||
    participants.some((p) => !Number.isSafeInteger(p.days) || p.days < 0)
  )
    throw new Error('Dữ liệu phân bổ chưa hợp lệ.')
  const weight = participants.reduce((s, p) => s + BigInt(p.days), 0n)
  if (weight === 0n) throw new Error('Không có ngày cư trú để phân bổ.')
  const rows = participants.map((p) => ({
    ...p,
    amount: Number((BigInt(total) * BigInt(p.days)) / weight),
    remainder: (BigInt(total) * BigInt(p.days)) % weight,
  }))
  let remaining = total - rows.reduce((s, p) => s + p.amount, 0)
  for (const row of [...rows].sort((a, b) =>
    a.remainder === b.remainder ? a.id.localeCompare(b.id) : a.remainder > b.remainder ? -1 : 1,
  )) {
    if (remaining-- > 0) row.amount++
  }
  return rows.map(({ id, amount }) => ({ id, amount }))
}
export function financialSummary(
  total: number,
  prepaid: number,
  allocated: number,
  dueDate: string,
  documentStatus: string,
  now = new Date().toISOString().slice(0, 10),
) {
  if (
    [total, prepaid, allocated].some((v) => !Number.isSafeInteger(v) || v < 0) ||
    prepaid + allocated > total
  )
    throw new Error('Tổng tài chính chưa hợp lệ.')
  const outstanding = documentStatus === 'ISSUED' ? total - prepaid - allocated : 0
  const financialStatus =
    outstanding === 0
      ? 'PAID'
      : dueDate < now
        ? 'OVERDUE'
        : allocated + prepaid > 0
          ? 'PARTIAL'
          : 'UNPAID'
  return {
    outstanding,
    financialStatus: financialStatus as 'PAID' | 'OVERDUE' | 'PARTIAL' | 'UNPAID',
  }
}
export function safeZalo(url: string | null) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' &&
      parsed.hostname === 'zalo.me' &&
      !parsed.username &&
      !parsed.password &&
      parsed.pathname.startsWith('/g/') &&
      parsed.pathname.length > 3
      ? parsed.href
      : null
  } catch {
    return null
  }
}
