import { cn } from '@/lib/utils'

/**
 * Renders 1-5 stars for a significance_score in the 0-1 range.
 * Used in Question Bank, Workspace, and Program Detail pages.
 */
export function SignificanceStars({
  score,
  size = 'sm',
}: {
  score: number
  size?: 'xs' | 'sm'
}) {
  // score is stored on a 1-5 scale
  const stars = score > 0 ? Math.min(5, Math.max(1, Math.round(score))) : 0

  if (stars === 0) return null

  const dim = size === 'xs' ? 10 : 12
  return (
    <div
      className="flex gap-0.5 flex-shrink-0"
      title={`Significance: ${Math.round(score * 100)}%`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width={dim}
          height={dim}
          viewBox="0 0 24 24"
          className={cn(
            i < stars ? 'text-warning-500' : 'text-neutral-200 dark:text-neutral-700'
          )}
        >
          <path
            fill="currentColor"
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          />
        </svg>
      ))}
    </div>
  )
}
