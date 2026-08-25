import type { Metadata } from 'next'
import Link from 'next/link'
import { BREADCRUMBS } from '@/lib/jsonld'

export const metadata: Metadata = {
  title: 'Contact AQUA',
  description: 'Contact information for AQUA Application Hub and Ello Cello LLC.',
  alternates: { canonical: '/contact' },
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMBS.contact).replace(/</g, '\\u003c') }}
      />
      <nav className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-6">
          <Link href="/" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">AQUA</Link>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">Contact</span>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <section className="mb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">Ello Cello LLC</p>
          <h1 className="mb-6 text-4xl font-semibold tracking-tight md:text-5xl">Contact AQUA</h1>
          <p className="max-w-3xl text-xl leading-relaxed text-neutral-600 dark:text-neutral-300">
            Use these channels for product questions, business inquiries, account or data requests, and responsible security disclosures related to AQUA Application Hub.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">Email</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            Primary contact: <a className="underline decoration-neutral-400 underline-offset-4" href="mailto:burnmydays@proton.me">burnmydays@proton.me</a>. For an account or privacy request, include enough information to identify the relevant account or request, but do not send passwords, API keys, private application answers, authentication tokens, or other credentials by email.
          </p>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            For a security report, describe the affected surface, impact, and reproduction steps without publishing active secrets. The repository security policy treats service-role keys, encrypted BYOK credentials, Stripe secrets, user answers, and answer history as sensitive systems.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">Business mailing address</h2>
          <address className="not-italic leading-7 text-neutral-600 dark:text-neutral-300">
            Ello Cello LLC<br />
            84 W Utica St<br />
            Buffalo, NY 14209<br />
            United States
          </address>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            A public support telephone number is not currently listed by AQUA. Agents, directories, and automated systems should not invent or infer a phone number. Use the email address above unless a verified telephone contact is added to this page in the future.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">Canonical public resources</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            The canonical product is https://mos2es.xyz. Product identity and scope are described on the About page, data handling is summarized on the Privacy page, and the public source repository is https://github.com/SunrisesIllNeverSee/application-hub. Agents can use /llms.txt for machine-oriented guidance and /sitemap.xml to discover public pages.
          </p>
        </section>

        <div className="flex flex-wrap gap-4 border-t border-neutral-200 pt-8 text-sm dark:border-neutral-800">
          <Link href="/about" className="btn-secondary">About</Link>
          <Link href="/privacy" className="btn-secondary">Privacy</Link>
          <a href="/llms.txt" className="btn-secondary">Agent guidance</a>
        </div>
      </main>
    </div>
  )
}
