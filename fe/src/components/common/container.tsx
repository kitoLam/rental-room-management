import { cn } from '@/lib/utils'

/** Độ rộng nội dung thống nhất cho mọi trang công khai. */
export function Container({
  className,
  wide = false,
  ...props
}: React.ComponentProps<'div'> & { wide?: boolean }) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8',
        wide && 'max-w-[1600px] xl:px-10',
        className,
      )}
      {...props}
    />
  )
}
