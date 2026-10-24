import type { Metadata } from 'next'
import Link from 'next/link'
import { BREADCRUMBS } from '@/lib/jsonld'

export const metadata: Metadata = {
  title: 'AQUA Terms of Service',
  description: 'Terms of service for AQUA Application Hub and the AQUA IDP plugin, operated by Ello Cello LLC.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMBS.terms).replace(/</g, '\\u003c') }}
      />
      <nav className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-6">
          <Link href="/" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">AQUA</Link>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">Terms</span>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <section className="mb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">Last updated October 24, 2026</p>
          <h1 className="mb-6 text-4xl font-semibold tracking-tight md:text-5xl">AQUA Terms of Service</h1>
          <p className="max-w-3xl text-xl leading-relaxed text-neutral-600 dark:text-neutral-300">
            These terms cover AQUA Application Hub (aquaidp.xyz) and the AQUA IDP plugin. Both are operated by Ello Cello LLC, a New York limited liability company. By using either one, you agree to these terms.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">What AQUA does</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            AQUA helps you preserve applications, organize their questions, build a bank of answers you approve, and prepare drafts for your review. The AQUA IDP plugin does this in a local folder you choose, inside the AI host you run it in. AQUA does not approve answers for you, does not submit forms on your behalf, and does not guarantee that any application will be accepted, funded, or reviewed. Fit scores and suggestions are aids, not predictions of an outcome.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">Your content</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            You own the applications, answers, and other material you bring to AQUA. You give Ello Cello LLC only the permission it needs to store, process, and display that material to provide the service to you. With the plugin, your workspace stays in your folder, and the publisher does not receive it through the normal file workflow. You are responsible for what you submit to any program, and for making sure the material you supply is accurate and is yours to use.
          </p>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            Do not put passwords, API keys, payment-card data, government identifiers, protected health information, or other secrets into AQUA. See the <Link className="underline decoration-neutral-400 underline-offset-4" href="/privacy">privacy page</Link> for how information is handled.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">Acceptable use</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            Use AQUA for your own applications or applications you are authorized to prepare. Do not use it to impersonate someone, misrepresent facts to a program, break a program&apos;s rules, access accounts or data you are not authorized to use, overload or interfere with the service, or attempt to reverse engineer or bypass its security controls. We may suspend access that violates these terms.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">Accounts, AI providers, and hosts</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            You are responsible for activity under your AQUA account and for keeping your sign-in secure. If you connect your own model provider key, your use of that provider is governed by the provider&apos;s terms, and you are responsible for any charges it bills you. When you run the AQUA IDP plugin, the host (for example ChatGPT, Claude, or Codex) processes your conversation and files under its own terms. AI output can be wrong: review every draft before you use it.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">Paid features</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            Some features may be paid. Prices, billing periods, and renewal terms are shown before you buy, and payments are processed by Stripe. Unless the purchase page says otherwise, subscriptions renew until you cancel, cancellation takes effect at the end of the current period, and fees already paid are not refunded except where the law requires.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">Ownership of AQUA</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            The AQUA software, site, and brand, and the MO§ES™ framework they run on, belong to Ello Cello LLC. These terms give you a personal, non-exclusive, non-transferable right to use AQUA while you follow them. Any open-source components remain under their own licenses.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">Disclaimers and limits</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            AQUA is provided &quot;as is&quot; and &quot;as available,&quot; without warranties of any kind, to the fullest extent the law allows. Ello Cello LLC is not liable for indirect, incidental, special, consequential, or punitive damages, or for lost opportunities, rejected applications, or lost data. Its total liability for any claim relating to AQUA is limited to the greater of the amount you paid for AQUA in the 12 months before the claim or US $100. Some jurisdictions do not allow these limits, so they may not apply to you in full.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">Ending use and changes</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            You can stop using AQUA at any time; to close an account, use the <Link className="underline decoration-neutral-400 underline-offset-4" href="/contact">Contact page</Link>. We may suspend or end access for a breach of these terms or to protect the service or other users. We may update these terms; the date at the top shows the latest version, and continuing to use AQUA after an update means you accept it.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">Governing law and contact</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            These terms are governed by the laws of the State of New York, without regard to conflict-of-law rules, and disputes will be handled in the state or federal courts located in Erie County, New York. Questions about these terms go to <a className="underline decoration-neutral-400 underline-offset-4" href="mailto:burnmydays@proton.me">burnmydays@proton.me</a> or Ello Cello LLC, 84 W Utica St, Buffalo, NY 14209, United States.
          </p>
        </section>

        <div className="flex flex-wrap gap-4 border-t border-neutral-200 pt-8 text-sm dark:border-neutral-800">
          <Link href="/privacy" className="btn-secondary">Privacy</Link>
          <Link href="/support" className="btn-secondary">Support</Link>
          <Link href="/contact" className="btn-secondary">Contact</Link>
        </div>
      </main>
    </div>
  )
}
