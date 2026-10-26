import posterUrl from '@/assets/hero/living-room-poster.webp'
import desktopVideoUrl from '@/assets/hero/living-room-1440.mp4'
import mobileVideoUrl from '@/assets/hero/living-room-720.mp4'

/** Video nền hero. Muốn đổi video: thay 3 file trong src/assets/hero (giữ nguyên tên). */
export const heroMedia = {
  poster: posterUrl,
  sources: { desktop: desktopVideoUrl, mobile: mobileVideoUrl },
} as const
