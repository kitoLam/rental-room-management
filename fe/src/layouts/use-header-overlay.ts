import { useEffect, useState } from 'react'

const HEADER_HEIGHT = 64

/**
 * true khi header đang nằm trên video hero (trang chủ, chưa cuộn qua hero).
 * Hero đánh dấu điểm kết thúc bằng phần tử #hero-end.
 */
export function useHeaderOverlay(active: boolean) {
  const [overlay, setOverlay] = useState(active)

  useEffect(() => {
    if (!active) return

    let frameId = 0
    const update = () => {
      const end = document.getElementById('hero-end')
      setOverlay(end ? end.getBoundingClientRect().top > HEADER_HEIGHT : false)
    }
    const onScroll = () => {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [active])

  return active && overlay
}
