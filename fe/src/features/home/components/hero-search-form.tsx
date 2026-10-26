import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  areaOptions,
  priceOptions,
  quickAreaKeys,
  rentalModeOptions,
} from '@/features/rooms/data/filter-options'
import { cn } from '@/lib/utils'

import { buildSearchUrl } from '../lib/build-search-url'
import { provider } from '@/services/config'

const quickAreas = areaOptions.filter((o) => (quickAreaKeys as readonly string[]).includes(o.value))

type HeroSearchFormProps = { className?: string }

export function HeroSearchForm({ className }: HeroSearchFormProps) {
  const real = provider('catalog') === 'real'
  const navigate = useNavigate()
  const [area, setArea] = useState('')
  const [price, setPrice] = useState('')
  const [mode, setMode] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate(buildSearchUrl({ area, price, mode }))
  }

  return (
    <form
      role="search"
      aria-label="Tìm phòng trọ"
      onSubmit={handleSubmit}
      className={cn(
          'hero-search-panel animate-rise rounded-xl p-4 sm:p-5',
          className,
      )}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-end">
        <div className="col-span-2 grid min-w-0 gap-1.5 sm:col-span-1">
          <Label htmlFor="search-area">Khu vực</Label>
          <Select value={area} onValueChange={setArea} disabled={real}>
            <SelectTrigger id="search-area">
              <SelectValue placeholder="Chọn khu vực" />
            </SelectTrigger>
            <SelectContent>
              {areaOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="search-price">Khoảng giá</Label>
          <Select value={price} onValueChange={setPrice}>
            <SelectTrigger id="search-price">
              <SelectValue placeholder="Mọi mức giá" />
            </SelectTrigger>
            <SelectContent>
              {priceOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="search-mode">Hình thức</Label>
          <Select value={mode} onValueChange={setMode} disabled={real}>
            <SelectTrigger id="search-mode">
              <SelectValue placeholder="Tất cả" />
            </SelectTrigger>
            <SelectContent>
              {rentalModeOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" size="lg" className="col-span-2 sm:col-span-3 lg:col-span-1">
          <Search aria-hidden="true" />
          Tìm phòng
        </Button>
      </div>

      {real && <p className="mt-3 text-sm text-muted-foreground">Lọc theo khu vực và hình thức thuê hiện chưa khả dụng. Bạn có thể tìm theo khoảng giá.</p>}
      {!real && <nav aria-label="Gợi ý khu vực" className="mt-4 hidden border-t border-border pt-3 sm:block">
        <ul className="flex flex-wrap items-center gap-2">
          <li className="mr-1 text-sm text-muted-foreground">Khám phá:</li>
          {quickAreas.map((o) => (
            <li key={o.value}>
              <Link
                to={buildSearchUrl({ area: o.value })}
                className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm transition-colors outline-none hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {o.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>}
    </form>
  )
}
