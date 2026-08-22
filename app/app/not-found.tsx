import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Not Found',
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-20">
        <p className="font-mono text-sm font-semibold tracking-[0.2em] text-brand-300">404</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-6xl">That AQUA resource is not here.</h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-300">
          The requested path does not exist. Use one of the public discovery surfaces below to recover instead of guessing at another route.
        </p>

        <section className="mt-10 border-t border-neutral-800 pt-8">
          <h2 className="text-lg font-semibold">Where to look next</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 hover:border-brand-700" href="/">Home</Link>
            <a className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 hover:border-brand-700" href="/llms.txt">Agent guidance</a>
            <a className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 hover:border-brand-700" href="/sitemap.xml">Sitemap</a>
            <Link className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 hover:border-brand-700" href="/about">About AQUA</Link>
            <Link className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 hover:border-brand-700" href="/contact">Contact</Link>
            <Link className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 hover:border-brand-700" href="/privacy">Privacy</Link>
          </div>
        </section>
      </main>
    </div>
  )
}
