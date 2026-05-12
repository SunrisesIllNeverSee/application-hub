'use client'

import React from 'react'
import { createClient } from '@/lib/supabase/client'

interface Toast {
  id: string
  amount: number
  eventType: string
}

export function CreditToast({ userId }: { userId: string }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  React.useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`credit_events_toast:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'credit_events',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { id: string; amount: number; event_type: string }
          const toast: Toast = {
            id: row.id ?? crypto.randomUUID(),
            amount: row.amount,
            eventType: row.event_type,
          }
          setToasts((prev) => [...prev, toast])
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== toast.id))
          }, 3500)
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-xl text-sm font-medium animate-in slide-in-from-right-4 fade-in duration-300"
        >
          <span className="text-amber-400 dark:text-amber-600 text-base">§</span>
          <span>
            <span className="font-bold text-amber-400 dark:text-amber-600">+{toast.amount}</span>
            {' '}day{toast.amount !== 1 ? 's' : ''} of Pro earned
          </span>
        </div>
      ))}
    </div>
  )
}
