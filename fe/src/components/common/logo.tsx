import { Link } from 'react-router'

import { routes } from '@/lib/routes'
import { site } from '@/lib/site'
import { cn } from '@/lib/utils'

type LogoProps = { className?: string; inverted?: boolean }

export function Logo({ className, inverted = false }: LogoProps) {
  return (
    <Link
      to={routes.home}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-lg text-base font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        inverted ? 'text-white' : 'text-foreground',
        className,
      )}
    >
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
        <rect width="32" height="32" rx="8" className={inverted ? 'fill-white' : 'fill-primary'} />
        <path
          d="M9 25V14l7-5 7 5v11h-5v-6h-4v6z"
          className={inverted ? 'fill-primary' : 'fill-white'}
        />
      </svg>
      {site.name}
    </Link>
  )
}
