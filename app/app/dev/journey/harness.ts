import { notFound } from 'next/navigation'

/** The journey dev harness exists only outside production builds. */
export function assertHarnessAllowed(): void {
  if (process.env.NODE_ENV === 'production') notFound()
}

export const HARNESS_ENV_BASE = '/dev/journey'
