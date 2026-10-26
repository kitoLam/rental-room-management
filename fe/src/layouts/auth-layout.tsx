import {Outlet, Link, ScrollRestoration} from 'react-router'
import {ArrowLeft, ArrowUpRight} from 'lucide-react'
import {Logo} from '@/components/common/logo'
import {heroMedia} from '@/features/home/data/hero-media'

export function AuthLayout() {
    return (
        // <div className="grid min-h-dvh bg-surface lg:grid-cols-2">
        <div className="grid min-h-dvh bg-background lg:grid-cols-2">
            <aside className="relative hidden overflow-hidden bg-primary lg:block">
                <img
                    src={heroMedia.poster}
                    alt="Không gian phòng khách thoáng sáng"
                    className="absolute inset-0 size-full object-cover"
                />
                <div className="absolute inset-0 bg-foreground/45"/>
                <div className="relative flex min-h-dvh flex-col justify-between p-12 text-white">
                    <Logo inverted/>
                    <div className="max-w-lg">
                        <p className="mb-4 text-sm">KHỞI ĐẦU TẠI TROPRO</p>
                        <h2 className="text-display font-bold text-balance">
                            Một nơi để trở về.
                            <br/>
                            Một cuộc sống để bắt đầu.
                        </h2>
                        <Link to="/rooms" className="mt-8 inline-flex min-h-11 items-center gap-3 text-sm">
                            Khám phá không gian sống
                            <ArrowUpRight size={18}/>
                        </Link>
                    </div>
                    <p className="text-xs">Tìm phòng · Đặt lịch xem · Giữ chỗ</p>
                </div>
            </aside>
            <main id="main" className="flex min-w-0 flex-col px-5 py-7 sm:px-10">
                <div className="flex items-center justify-between">
          <span className="lg:hidden">
            <Logo/>
          </span>
                    <Link
                        to="/"
                        className="ml-auto inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"
                    >
                        <ArrowLeft size={16}/>
                        Về trang chủ
                    </Link>
                </div>
                <div className="m-auto w-full max-w-md py-12">
                    <Outlet/>
                </div>
                <p className="text-center text-xs text-muted-foreground">
                    TroPro · Tìm một nơi ở phù hợp với bạn
                </p>
            </main>
            <ScrollRestoration/>
        </div>
    )
}
