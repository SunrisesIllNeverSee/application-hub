import type { Metadata } from 'next'
import Link from 'next/link'
import { BREADCRUMBS, comparisonArticle } from '@/lib/jsonld'

export const metadata: Metadata = {
  title: 'AQUA vs FounderApp — Application Infrastructure Comparison',
  description:
    'AQUA Application Hub vs FounderApp: lineage tracking, fit scoring, MCP integration, and an application graph versus universal profile autofill across forms.',
  alternates: { canonical: '/vs/founderapp' },
}

const ROWS: { dimension: string; aqua: string; founderApp: string }[] = [
  {
    dimension: 'What it is',
    aqua: 'Reusable application infrastructure — an answer bank, application graph, fit signals, and review loops for accelerators, fellowships, grants, and jobs.',
    founderApp: 'A universal profile that autofills application forms across many destinations.',
  },
  {
    dimension: 'Answer reuse',
    aqua: 'First-class. Questions and answers are reusable assets with variants kept connected to source material.',
    founderApp: 'Profile-driven autofill; one profile reused across forms rather than answer-level reuse.',
  },
  {
    dimension: 'Lineage tracking',
    aqua: 'Yes. Each answer variant traces back to its source answer and supporting evidence, so updates propagate to affected variants.',
    founderApp: 'No lineage concept. The profile is the single source; variants are not tracked.',
  },
  {
    dimension: 'Fit scoring',
    aqua: 'Yes. Fit score combines coverage, theme alignment, criteria match, and answer completeness for a specific program.',
    founderApp: 'No program-level fit score. Autofill is form-completion oriented, not fit-oriented.',
  },
  {
    dimension: 'Opportunity matching',
    aqua: 'Smart Matcher compares your current profile against a program question surface and identifies coverage gaps before drafting.',
    founderApp: 'Profile-to-form matching; surfaces forms the profile can fill, not programs you fit.',
  },
  {
    dimension: 'MCP / agent integration',
    aqua: 'Ships a local MCP server exposing answer retrieval, ranking, review-context, stress-test, and write-back for agent environments.',
    founderApp: 'No MCP server. Browser-based autofill is the primary interaction model.',
  },
  {
    dimension: 'Cross-program coverage',
    aqua: 'Accelerators, fellowships, grants, and jobs share one question surface and answer graph.',
    founderApp: 'Broad form coverage, but treated as independent autofill targets rather than a connected graph.',
  },
  {
    dimension: 'Open source',
    aqua: 'Public source repository available on GitHub so technical users and agents can inspect the shipped architecture.',
    founderApp: 'Closed source product.',
  },
  {
    dimension: 'Pricing model',
    aqua: 'Operated by Ello Cello LLC; web app at mos2es.xyz is the canonical surface, local MCP server and developer resources are publicly accessible.',
    founderApp: 'Commercial SaaS pricing on its own surface.',
  },
]

export default function VsFounderAppPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMBS.vsFounderApp).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            comparisonArticle(
              'AQUA Application Hub vs FounderApp',
              'A comparison of AQUA Application Hub and FounderApp across answer reuse, lineage tracking, fit scoring, opportunity matching, MCP integration, cross-program coverage, open source, and pricing.',
              '/vs/founderapp',
            ),
          ).replace(/</g, '\\u003c'),
        }}
      />
      <nav className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-6">
          <Link href="/" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">AQUA</Link>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <Link href="/vs" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">Comparisons</Link>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">AQUA vs FounderApp</span>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <section className="mb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">Comparison</p>
          <h1 className="mb-6 text-4xl font-semibold tracking-tight md:text-5xl">AQUA Application Hub vs FounderApp</h1>
          <p className="max-w-3xl text-xl leading-relaxed text-neutral-600 dark:text-neutral-300">
            Application infrastructure is the layer that connects reusable answers, source lineage, fit signals, and review loops across many programs. AQUA Application Hub is built around that layer; FounderApp is built around universal profile autofill. This comparison breaks down where the two overlap and where they diverge.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">Where they overlap</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            Both tools reduce repetitive data entry across applications. Both let you maintain a persistent profile instead of retyping the same facts into every form. If your only goal is filling in name, role, and company fields faster, either tool helps.
          </p>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">Where they diverge</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            AQUA treats each answer as a reusable asset with lineage. When you adapt an answer for a new program, the variant stays connected to its source answer and supporting evidence, so updating the source shows you which variants are affected. FounderApp treats the profile as the single source and autofills from it, without tracking answer-level variants or their provenance.
          </p>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            AQUA also adds fit scoring and Smart Matcher — signals that tell you how well your current profile aligns to a specific program before you start drafting. FounderApp is form-completion oriented: it surfaces forms your profile can fill, not programs you are prepared for. AQUA additionally ships a local MCP server for agent-based workflows, while FounderApp is a closed-source browser product.
          </p>
        </section>

        <section className="mb-14">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">Feature comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th className="py-3 pr-4 font-semibold text-neutral-900 dark:text-white">Dimension</th>
                  <th className="py-3 pr-4 font-semibold text-neutral-900 dark:text-white">AQUA Application Hub</th>
                  <th className="py-3 font-semibold text-neutral-900 dark:text-white">FounderApp</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.dimension} className="border-b border-neutral-200 dark:border-neutral-800">
                    <td className="py-3 pr-4 font-medium text-neutral-900 dark:text-white">{row.dimension}</td>
                    <td className="py-3 pr-4 leading-6 text-neutral-600 dark:text-neutral-300">{row.aqua}</td>
                    <td className="py-3 leading-6 text-neutral-600 dark:text-neutral-300">{row.founderApp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-14 space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">When to pick which</h2>
          <p className="leading-7 text-neutral-600 dark:text-neutral-300">
            Choose FounderApp if your primary need is fast, universal profile autofill across many unrelated forms and you do not need answer lineage, fit scoring, or agent integration. Choose AQUA if you apply to many programs that ask variations of the same underlying questions, you want to preserve why each answer says what it says, and you want fit signals that tell you where you are prepared before you draft.
          </p>
        </section>

        <div className="flex flex-wrap gap-4 border-t border-neutral-200 pt-8 text-sm dark:border-neutral-800">
          <Link href="/concepts/answer-reuse" className="btn-secondary">Answer reuse</Link>
          <Link href="/concepts/answer-lineage" className="btn-secondary">Answer lineage</Link>
          <Link href="/concepts/smart-matcher" className="btn-secondary">Smart Matcher</Link>
          <Link href="/faq" className="btn-secondary">FAQ</Link>
        </div>
      </main>
    </div>
  )
}
