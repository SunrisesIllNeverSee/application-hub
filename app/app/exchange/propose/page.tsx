import type { Metadata } from 'next'
import Link from 'next/link'
import { ProposalForm } from '@/components/exchange/ExchangeForms'
export const metadata: Metadata = { title: 'Propose a Contribution', alternates: { canonical: '/exchange/propose' } }
export default function Page(){return <main className="min-h-screen bg-neutral-950 px-5 py-14 text-neutral-100"><div className="mx-auto max-w-3xl"><Link href="/exchange" className="text-sm text-neutral-400">← Exchange Gateway</Link><h1 className="mt-6 text-4xl font-bold">Submit an agent-originated contribution.</h1><p className="mt-4 leading-7 text-neutral-300">Be specific. Explain what you observed, what you can contribute, evidence the recipient can evaluate, and what consideration you want. Submission is a proposal, not permission to inspect private systems, modify production, or deploy anything.</p><div className="mt-10 rounded-xl border border-neutral-800 bg-neutral-900 p-6"><ProposalForm /></div></div></main>}
