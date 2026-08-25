import type { Metadata } from 'next'
import Link from 'next/link'
import { BREADCRUMBS, definedTerm } from '@/lib/jsonld'

export const metadata: Metadata = {
  title: 'Answer Reuse — AQUA Application Hub',
  description:
    'Answer reuse is the practice of carrying strong answers across applications that ask the same underlying question, so you improve one answer and every program benefits.',
  alternates: { canonical: '/concepts/answer-reuse' },
}

export default function AnswerReusePage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMBS.conceptAnswerReuse).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            definedTerm(
              'Answer Reuse',
              'The practice of writing a strong answer to a recurring application question once, then carrying that answer — and its variants — across every program that asks a version of the same underlying question. Answer reuse treats questions and answers as reusable assets rather than disposable, per-application text.',
              '/concepts/answer-reuse',
            ),
          ).replace(/</g, '\\u003c'),
        }}
      />
      <nav className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-6">
          <Link href="/" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">AQUA</Link>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <Link href="/application-infrastructure" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">Application Infrastructure</Link>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">Answer Reuse</span>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <section className="mb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">Concept</p>
          <h1 className="mb-6 text-4xl font-semibold tracking-tight md:text-5xl">What is answer reuse in applications?</h1>
          <p className="max-w-3xl text-xl leading-relaxed text-neutral-600 dark:text-neutral-300">
            Answer reuse is the practice of writing a strong answer to a recurring application question once, then carrying that answer — and its variants — across every program that asks a version of the same underlying question. Accelerators, fellowships, grants, and jobs routinely ask different phrasings of the same core prompts: tell us about your team, describe your traction, what problem are you solving. Answer reuse treats those questions and answers as reusable assets rather than disposable, per-application text. AQUA Application Hub is built around this idea — it maintains an answer bank, tracks variants, and preserves lineage so every improvement to a source answer propagates to the programs that depend on it.
          </p>
        </section>

        <section className="space-y-12">
          <div>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">Why answer reuse matters</h2>
            <p className="leading-7 text-neutral-600 dark:text-neutral-300">
              Most application questions are not unique. A founder applying to Y Combinator, Techstars, an NSF grant, and a fellowship will answer near-identical prompts about team, problem, market, and traction four times over. Writing each from scratch wastes effort and produces inconsistent quality. Answer reuse lets you invest once in a strong, well-evidenced answer, then adapt it for each destination — preserving the substance while tuning the framing. The result is higher-quality applications with less manual work and a single source of truth you can keep improving.
            </p>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">How AQUA implements answer reuse</h2>
            <p className="mb-4 leading-7 text-neutral-600 dark:text-neutral-300">
              AQUA implements answer reuse through three connected mechanisms:
            </p>
            <ul className="ml-6 list-disc space-y-3 leading-7 text-neutral-600 dark:text-neutral-300">
              <li><strong className="text-neutral-900 dark:text-white">Answer bank.</strong> A central store of your strongest answers to recurring questions, indexed by the underlying question rather than by program. When a new application asks a similar question, AQUA surfaces the best existing answer instead of a blank field.</li>
              <li><strong className="text-neutral-900 dark:text-white">Variants.</strong> Each program may need a different framing of the same answer. AQUA lets you create variants tuned to a specific destination while keeping them linked to the source answer, so you never lose the relationship between an adapted answer and the material that produced it.</li>
              <li><strong className="text-neutral-900 dark:text-white">Lineage.</strong> Every variant traces back to its source answer and supporting evidence. When you update the source, AQUA can show which variants are affected and which programs depend on them.</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">What answer reuse is not</h2>
            <p className="leading-7 text-neutral-600 dark:text-neutral-300">
              Answer reuse is not plagiarism. You are reusing your own answers to your own questions, not copying someone else&apos;s work. It is also not copy-paste without adaptation. A strong reused answer is tailored to each program&apos;s framing, word limits, and evaluation criteria — the substance carries over, but the presentation is adapted. Answer reuse is a structured workflow for compounding quality over time, not a shortcut for submitting identical text everywhere.
            </p>
          </div>
        </section>

        <div className="flex flex-wrap gap-4 border-t border-neutral-200 pt-8 text-sm dark:border-neutral-800">
          <Link href="/concepts/answer-lineage" className="btn-secondary">Answer Lineage</Link>
          <Link href="/concepts/smart-matcher" className="btn-secondary">Smart Matcher</Link>
          <Link href="/guides/how-to-reuse-application-answers" className="btn-secondary">Guide: Reuse Answers</Link>
          <Link href="/faq" className="btn-secondary">FAQ</Link>
        </div>
      </main>
    </div>
  )
}
