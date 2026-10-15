'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

// d3 / M08-PRD-002: on narrow viewports the program list stacks above the
// detail panel — scroll it into view when the user selects a program.
export function ScrollDetailOnSelect() {
  const params = useSearchParams()
  const selected = params.get('selected')
  const prev = useRef<string | null>(null)
  useEffect(() => {
    if (!selected || selected === prev.current) {
      prev.current = selected
      return
    }
    prev.current = selected
    if (window.innerWidth >= 768) return
    document
      .getElementById('program-detail')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selected])
  return null
}
