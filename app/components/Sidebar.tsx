'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/ThemeProvider'

interface Application {
  id: string
  program_id: string
  status: string
  program_name: string
  program_slug: string
}

interface SidebarProps {
  user: User
  applications: Application[]
}

const NAV = [
  {
    href: '/hub',
    label: 'Hub',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/bank',
    label: 'Question Bank',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/profile/answers',
    label: 'Answer Bank',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  saved:       { label: 'Saved',       dot: 'bg-neutral-400' },
  drafting:    { label: 'In progress', dot: 'bg-brand-400' },
  submitted:   { label: 'Submitted',   dot: 'bg-success-400' },
  accepted:    { label: 'Accepted',    dot: 'bg-success-500' },
  rejected:    { label: 'Rejected',    dot: 'bg-neutral-500' },
  waitlisted:  { label: 'Waitlisted',  dot: 'bg-warning-400' },
}

const STATUS_ORDER = ['drafting', 'saved', 'submitted', 'waitlisted', 'accepted', 'rejected']

export function Sidebar({ user, applications }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const { theme, toggle } = useTheme()

  React.useEffect(() => { setMobileOpen(false) }, [pathname])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = user.email ? user.email.slice(0, 2).toUpperCase() : 'U'

  // Sort applications by status priority
  const sortedApps = [...applications].sort((a, b) => {
    return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
  })

  function isNavActive(href: string) {
    if (href === '/hub') {
      return pathname === '/hub' || (pathname.startsWith('/hub') && !pathname.startsWith('/hub/timeline'))
    }
    if (href === '/profile') {
      return pathname === '/profile' || pathname === '/profile/about' ||
             pathname === '/profile/settings' || pathname === '/profile/integrations'
    }
    return pathname === href || pathname.startsWith(href + '/')
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-neutral-800 flex-shrink-0">
        <Link href="/hub" className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-brand-600 flex items-center justify-center flex-shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-white tracking-tight">Application Hub</span>
        </Link>
      </div>

      {/* Main nav */}
      <div className="px-2 py-3 space-y-0.5 flex-shrink-0">
        {NAV.map((item) => {
          const active = isNavActive(item.href)
          return (
            <Link key={item.href} href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-neutral-800 text-white font-medium'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
              )}
            >
              <span className={cn('flex-shrink-0', active ? 'text-brand-400' : 'text-neutral-500')}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-neutral-800 flex-shrink-0" />

      {/* Applications list */}
      <div className="flex-1 overflow-y-auto px-2 py-3 min-h-0">
        <p className="px-3 mb-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
          My Applications
        </p>

        {sortedApps.length === 0 ? (
          <div className="px-3 py-2">
            <p className="text-xs text-neutral-600 dark:text-neutral-600">
              No applications yet.{' '}
              <Link href="/hub" className="text-brand-500 hover:text-brand-400">
                Browse Hub &rarr;
              </Link>
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {sortedApps.map(app => {
              const cfg = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.saved
              const isActive = pathname === `/workspace/${app.program_id}`
              return (
                <Link
                  key={app.id}
                  href={`/workspace/${app.program_id}`}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors group',
                    isActive
                      ? 'bg-neutral-800 text-white'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                  )}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', cfg.dot)} />
                  <span className="text-xs flex-1 truncate">{app.program_name}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-neutral-800 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-brand-700 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-neutral-200 truncate">{user.email}</p>
            <p className="text-xs text-neutral-500">Free plan</p>
          </div>
          {/* Dark mode toggle */}
          <button
            onClick={toggle}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="text-neutral-600 hover:text-neutral-300 transition-colors flex-shrink-0"
          >
            {theme === 'dark' ? (
              /* Sun icon — shown in dark mode to switch to light */
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              /* Moon icon — shown in light mode to switch to dark */
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          {/* Sign out */}
          <button onClick={signOut} title="Sign out"
            className="text-neutral-600 hover:text-neutral-300 transition-colors flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex w-56 flex-shrink-0 h-full flex-col bg-neutral-900 border-r border-neutral-800">
        {sidebarContent}
      </nav>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14 bg-neutral-900 border-b border-neutral-800">
        <Link href="/hub" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-brand-600 flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-white">Application Hub</span>
        </Link>
        <button onClick={() => setMobileOpen(true)}
          className="text-neutral-400 hover:text-white p-1" aria-label="Open menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <nav className="relative w-64 max-w-[85vw] flex flex-col h-full bg-neutral-900 border-r border-neutral-800 shadow-2xl">
            <div className="flex items-center justify-end px-4 py-3 border-b border-neutral-800 flex-shrink-0">
              <button onClick={() => setMobileOpen(false)}
                className="text-neutral-400 hover:text-white" aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {sidebarContent}
          </nav>
        </div>
      )}
    </>
  )
}
