import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'AQUA Privacy',
  description: 'Privacy and data-handling overview for AQUA Application Hub.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <nav className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-6">
          <Link href="/" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">AQUA</Link>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">Privacy</span>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <section className="mb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">Last updated August 21, 2026</p>
          <h1 className="mb-6 text-4xl font-semibold tracking-tight md:text-5xl">AQUA Privacy</h1>
          <p className="max-w-3xl text-xl leading-relaxed text-neutral-600 dark:text-neutral-300">
            AQUA Application Hub is operated by Ello Cello LLC. This page summarizes the main information the product handles and the controls reflected in the current application architecture.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">Information used by the product</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            AQUA may process account identity needed to authenticate a user, profile information the user supplies, application questions and source material the user imports, answers and answer-version history, review and stress-test records, opportunity-fit data, and billing or subscription state when paid features are used. The system also handles ordinary request and operational metadata required to run a web application.
          </p>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            Application answers and answer history are sensitive user data. Users should avoid placing passwords, private API keys, authentication tokens, or unrelated secrets inside application-answer text or other fields intended for ordinary application content.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">Storage, access, and credentials</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            Supabase is the current system of record for the application. User-scoped information is protected through authentication and row-level access controls. Bring-your-own-key provider credentials are intended to remain server-side and are encrypted when persisted. Service-role keys, webhook signing secrets, and integration encryption keys are server-side secrets and must not be exposed to frontend code.
          </p>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            The product preserves answer versions and review history so users can retain lineage between source material and later variants. That history is operational product data and should be handled with the same care as the current answer bank.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">Providers and user choices</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            AQUA supports bring-your-own-key model providers. When a user enables one of those providers, selected drafting or review material may be sent to that provider under the provider&apos;s own terms and privacy practices. Billing flows may use Stripe. Hosting, authentication, database, email, and delivery infrastructure may process the information necessary to provide their respective services.
          </p>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            AQUA&apos;s application and scoring features are intended to help a user prepare and organize their own material. Public program records and internal fit signals should not be read as permission to disclose another user&apos;s answers or private profile data.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">Privacy requests</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            For privacy, access, correction, or deletion questions, contact <a className="underline decoration-neutral-400 underline-offset-4" href="mailto:burnmydays@proton.me">burnmydays@proton.me</a>. Include the account email or other identifier necessary to locate the relevant account, but do not send passwords, private API keys, or authentication tokens. Business contact information and the mailing address are published on the Contact page.
          </p>
        </section>

        <div className="flex flex-wrap gap-4 border-t border-neutral-200 pt-8 text-sm dark:border-neutral-800">
          <Link href="/about" className="btn-secondary">About</Link>
          <Link href="/contact" className="btn-secondary">Contact</Link>
          <a href="/llms.txt" className="btn-secondary">Agent guidance</a>
        </div>
      </main>
    </div>
  )
}
