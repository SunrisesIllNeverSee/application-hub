'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function ProfileTab({ href, label }: { href: string; label: string }) {
  const pathname = usePathname()
  const active = pathname === href

  return (
    <Link
      href={href}
      className={[
        'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
        active
          ? 'border-brand-600 text-brand-700 dark:text-brand-400 dark:border-brand-400'
          : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:border-neutral-300 dark:hover:border-neutral-600',
      ].join(' ')}
    >
      {label}
    </Link>
  )
}
