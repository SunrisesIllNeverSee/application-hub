import type { Metadata } from 'next'
import Link from 'next/link'
import { BREADCRUMBS } from '@/lib/jsonld'

export const metadata: Metadata = {
  title: 'AQUA IDP Support',
  description: 'Get help with the AQUA IDP plugin, application archives, question review, answer reuse, and beta reports.',
  alternates: { canonical: '/support' },
}

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMBS.support).replace(/</g, '\\u003c') }}
      />
      <nav className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-6">
          <Link href="/" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">AQUA</Link>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">IDP Support</span>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <section className="mb-14">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">Applications · Questions · Answers · Submit</p>
          <h1 className="mb-6 text-4xl font-semibold tracking-tight md:text-5xl">AQUA IDP Support</h1>
          <p className="max-w-3xl text-xl leading-relaxed text-neutral-600 dark:text-neutral-300">
            AQUA keeps the original application, helps you understand what each question asks, and preserves answers you choose to reuse. If a step feels stuck, start with the workspace record so we can find the actual gap.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">Find your place</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            Open <code>PROGRESS.md</code> in your AQUA folder for the next action, then <code>Run-Status.csv</code> for the phase of each application. <code>waiting_for_QU</code> means question interpretation is next; <code>waiting_for_answers</code> means answer review is next. These labels do not mean the feature is unavailable. Keep the entire folder if you want your bank to carry into another session.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
              <h3 className="font-semibold">A · Application</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">Check that the source copy, entity, program, and every original question are present. A missing field is a capture gap, not a reason to invent an answer.</p>
            </div>
            <div className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
              <h3 className="font-semibold">QU · Questions</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">Review what each question seeks. Related wording can point to the same concept, but context may make two similar questions different.</p>
            </div>
            <div className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
              <h3 className="font-semibold">A · Answers</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">An old submitted answer is a candidate, not automatically your current approved answer. Confirm facts and approve new or changed wording before reuse.</p>
            </div>
            <div className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
              <h3 className="font-semibold">S · Submit</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">A Markdown draft is ready for review and copy/paste. It does not mean an external form was filled, submitted, or accepted.</p>
            </div>
          </div>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">Get help or report a problem</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            Email <a className="underline decoration-neutral-400 underline-offset-4" href="mailto:burnmydays@proton.me?subject=AQUA%20IDP%20support">burnmydays@proton.me</a> with the plugin version, the phase shown in <code>Run-Status.csv</code>, what you expected, and what happened. A report ID from <code>Beta Reports/</code> can help locate a technical issue. Please do not email application answers, source files, passwords, API keys, government IDs, or other sensitive records. We may ask for a redacted example if needed.
          </p>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            Local beta reports stay in your folder. Automatic metadata delivery is optional and can be turned off with <code>beta-reporting --disable</code>. If your host cannot keep local files, export the AQUA folder before ending the session; conversation memory alone is not a durable answer bank.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">Security and privacy</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            For a suspected security issue, email the same address with the affected surface and reproduction steps, without sending live credentials or private answer content. Ello Cello LLC will assess the report, contain any confirmed issue, preserve relevant evidence, and determine any required notifications. See the <Link className="underline decoration-neutral-400 underline-offset-4" href="/privacy">privacy page</Link> for the plugin&apos;s data handling and user controls. For website account or business questions, use the <Link className="underline decoration-neutral-400 underline-offset-4" href="/contact">contact page</Link>.
          </p>
        </section>

        <div className="flex flex-wrap gap-4 border-t border-neutral-200 pt-8 text-sm dark:border-neutral-800">
          <Link href="/privacy" className="btn-secondary">Privacy</Link>
          <Link href="/contact" className="btn-secondary">Contact</Link>
        </div>
      </main>
    </div>
  )
}
