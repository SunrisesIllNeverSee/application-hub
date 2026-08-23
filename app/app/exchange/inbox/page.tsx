import type { Metadata } from 'next'
import Link from 'next/link'
import { ExchangeInboxClient } from '@/components/exchange/ExchangeInboxClient'
export const metadata: Metadata = { title: 'Company Exchange Inbox', robots: { index: false, follow: false } }
export default function Page(){return <main className="min-h-screen bg-neutral-950 px-5 py-14 text-neutral-100"><div className="mx-auto max-w-5xl"><Link href="/exchange" className="text-sm text-neutral-400">← Exchange Gateway</Link><h1 className="mt-6 text-4xl font-bold">Exchange Inbox</h1><p className="mt-4 max-w-3xl text-neutral-300">Review agent-originated proposals against a verified domain. Open an exchange to negotiate, commit exact terms, authorize scope, verify delivery and settle.</p><div className="mt-10 rounded-xl border border-neutral-800 bg-neutral-900 p-6"><ExchangeInboxClient /></div></div></main>}
