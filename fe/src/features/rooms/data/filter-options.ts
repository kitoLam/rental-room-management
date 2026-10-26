import type { RentalMode } from '../types'

export interface Option<T extends string = string> {
  value: T
  label: string
}

export const areaOptions: Option[] = [
  { value: 'khu-cong-nghe-cao', label: 'Gần ĐH FPT, Khu Công nghệ cao' },
  { value: 'lang-dai-hoc', label: 'Làng Đại học Thủ Đức' },
  { value: 'thu-duc', label: 'Thủ Đức' },
  { value: 'binh-thanh', label: 'Bình Thạnh' },
  { value: 'go-vap', label: 'Gò Vấp' },
]

/** Khoảng giá theo tháng (VND). Giá trị dạng "min-max" để gửi thẳng lên query string. */
export const priceOptions: Option[] = [
  { value: '0-2000000', label: 'Dưới 2 triệu' },
  { value: '2000000-3000000', label: '2 đến 3 triệu' },
  { value: '3000000-5000000', label: '3 đến 5 triệu' },
  { value: '5000000-', label: 'Trên 5 triệu' },
]

export const rentalModeOptions: Option<RentalMode>[] = [
  { value: 'ROOM', label: 'Nguyên phòng' },
  { value: 'SLOT', label: 'Ở ghép' },
]

/** Lối tắt khu vực hiện dưới thanh tìm kiếm trên homepage */
export const quickAreaKeys = ['khu-cong-nghe-cao', 'lang-dai-hoc', 'binh-thanh'] as const
