import {useEffect, useRef, useState} from 'react'

import {Container} from '@/components/common/container'
import {usePrefersReducedMotion} from '@/hooks/use-media-query'

import {heroMedia} from '../data/hero-media'
import {HeroSearchForm} from './hero-search-form'

/** Video trôi chậm hơn trang khi cuộn qua hero (tạo chiều sâu) */
const PARALLAX = 0.25

/**
 * Hero toàn màn hình với video phòng khách.
 * Trang cuộn bình thường, không ghim. Lần cuộn đầu tiên làm video phát và lặp lại liên tục;
 * video tự dừng khi hero khuất khỏi màn hình và phát tiếp khi quay lại.
 */
export function HeroVideo() {
    const reducedMotion = usePrefersReducedMotion()
    const sectionRef = useRef<HTMLElement>(null)
    const mediaRef = useRef<HTMLDivElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)

    // Chọn bản nhẹ cho điện thoại; chỉ chọn một lần lúc mở trang
    const [videoSrc] = useState(() =>
        window.matchMedia('(max-width: 767px)').matches
            ? heroMedia.sources.mobile
            : heroMedia.sources.desktop,
    )

    // Phát video ở nhịp cuộn đầu tiên; sau đó chỉ phát khi hero còn trên màn hình
    useEffect(() => {
        const video = videoRef.current
        const section = sectionRef.current

        if (reducedMotion || !video || !section) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    // Autoplay immediately while hero is visible
                    video.play().catch(() => {
                        // Browser may block autoplay.
                        // Keep the poster as fallback.
                    })
                } else {
                    // Save resources when hero is off-screen
                    video.pause()
                }
            },
            {threshold: 0.05},
        )

        observer.observe(section)

        return () => {
            observer.disconnect()
            video.pause()
        }
    }, [reducedMotion])


    // Parallax: chỉ chạy khi hero còn trên màn hình
    useEffect(() => {
        const section = sectionRef.current
        const media = mediaRef.current
        if (reducedMotion || !section || !media) return

        let frameId = 0
        let visible = true

        const update = () => {
            const offset = Math.min(window.scrollY, section.offsetHeight)
            media.style.transform = `translate3d(0, ${offset * PARALLAX}px, 0)`
        }
        const onScroll = () => {
            if (!visible) return
            cancelAnimationFrame(frameId)
            frameId = requestAnimationFrame(update)
        }

        const observer = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting
        })
        observer.observe(section)
        window.addEventListener('scroll', onScroll, {passive: true})
        update()

        return () => {
            observer.disconnect()
            cancelAnimationFrame(frameId)
            window.removeEventListener('scroll', onScroll)
            media.style.transform = ''
        }
    }, [reducedMotion])

    return (
        <section
            ref={sectionRef}
            aria-labelledby="hero-title"
            className="relative h-svh min-h-[650px] overflow-hidden bg-foreground"
        >
            <div ref={mediaRef} className="absolute inset-0 will-change-transform">
                {reducedMotion ? (
                    <img src={heroMedia.poster} alt="" className="size-full object-cover"/>
                ) : (
                    <video
                        ref={videoRef}
                        src={videoSrc}
                        poster={heroMedia.poster}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        disablePictureInPicture
                        aria-hidden="true"
                        tabIndex={-1}
                        className="size-full object-cover"
                    />
                )}
            </div>

            {/* Lớp phủ: trên cho header, dưới cho tiêu đề — giữ chữ trắng đọc được trên video sáng */}
            <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-foreground/60 to-foreground/0"
            />
            <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/40 to-foreground/0"
            />

            <Container className="relative flex h-full flex-col justify-end pt-20 pb-6 sm:pt-24 sm:pb-10">
                <h1 id="hero-title" className="max-w-3xl text-display font-bold text-balance text-white">
                    Tìm phòng trọ vừa túi tiền
                </h1>
                <p className="mt-3 max-w-lg text-base text-white">
                    Khám phá không gian phù hợp, xem giá tham khảo và đặt lịch xem phòng.
                </p>
                <HeroSearchForm className="mt-6 sm:mt-8"/>
            </Container>

            {/* Mốc để header chuyển sang nền trắng khi hero đã cuộn qua */}
            <div id="hero-end" aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px"/>
        </section>
    )
}
