'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface SidebarProps {
  user: User
}

const NAV = [
  {
    href: '/hub',
    label: 'Hub',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  // Timeline folded into Hub — placeholder until Question Bank + Companies index ships
  {
    href: '/bank',
    label: 'Question Bank',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: '/profile/answers',
    label: 'Answer Bank',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
]

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = user.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'U'

  const [mobileOpen, setMobileOpen] = React.useState(false)

  // Close drawer on navigation
  React.useEffect(() => { setMobileOpen(false) }, [pathname])

  const navContent = (
    <>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-neutral-800">
        <Link href="/hub" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-white">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="text-sm font-semibold text-white">Application Hub</span>
        </Link>
      </div>

      {/* Nav */}
      <div className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
          const matches = NAV.filter(
            (i) => pathname === i.href || pathname.startsWith(i.href + '/')
          )
          const best = matches.sort((a, b) => b.href.length - a.href.length)[0]
          const active = best?.href === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-brand-600 text-white font-medium'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              )}
            >
              <span className={cn('flex-shrink-0', active ? 'text-white' : 'text-neutral-500')}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </div>

      {/* User */}
      <div className="px-3 py-3 border-t border-neutral-800">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">
              {user.email ?? 'Account'}
            </p>
            <p className="text-2xs text-neutral-500">Free plan</p>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            className="text-neutral-500 hover:text-neutral-300 transition-colors flex-shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex w-56 flex-shrink-0 h-full flex-col bg-neutral-900 dark:bg-neutral-950 border-r border-neutral-800">
        {navContent}
      </nav>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14 bg-neutral-900 border-b border-neutral-800">
        <Link href="/hub" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-brand-600 flex items-center justify-center flex-shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-white">Application Hub</span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="text-neutral-400 hover:text-white p-1"
          aria-label="Open menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Mobile offset so content doesn't hide under top bar */}
      <div className="md:hidden h-14 flex-shrink-0" aria-hidden />

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Scrim */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <nav className="relative w-72 max-w-[85vw] flex flex-col h-full bg-neutral-900 border-r border-neutral-800 shadow-2xl">
            <div className="flex items-center justify-end px-4 py-3 border-b border-neutral-800">
              <button
                onClick={() => setMobileOpen(false)}
                className="text-neutral-400 hover:text-white p-1"
                aria-label="Close menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {navContent}
          </nav>
        </div>
      )}

      {/* Spacer for main content below mobile top bar — handled in layout via pt */}
    </>
  )
}
