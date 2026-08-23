import type { Metadata } from 'next'
import Link from 'next/link'
import { InboxClient } from '@/components/exchange/ExchangeForms'
export const metadata: Metadata = { title: 'Company Exchange Inbox', robots: { index: false, follow: false } }
export default function Page(){return <main className="min-h-screen bg-neutral-950 px-5 py-14 text-neutral-100"><div className="mx-auto max-w-4xl"><Link href="/exchange" className="text-sm text-neutral-400">← Exchange Gateway</Link><h1 className="mt-6 text-4xl font-bold">Exchange Inbox</h1><p className="mt-4 text-neutral-300">Load proposals for a verified domain with its company admin key. v0.1 deliberately keeps this interface simple; state transitions are available through the headless API.</p><div className="mt-10 rounded-xl border border-neutral-800 bg-neutral-900 p-6"><InboxClient /></div></div></main>}
