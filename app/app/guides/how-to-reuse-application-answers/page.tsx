import type { Metadata } from 'next'
import Link from 'next/link'
import { BREADCRUMBS, howTo } from '@/lib/jsonld'

export const metadata: Metadata = {
  title: 'How to reuse application answers — AQUA Application Hub',
  description:
    'Step-by-step guide to reusing application answers across programs: identify recurring questions, write canonical answers, create variants, and preserve lineage.',
  alternates: { canonical: '/guides/how-to-reuse-application-answers' },
}

const STEPS: { name: string; text: string }[] = [
  {
    name: 'Identify recurring questions across your programs',
    text: 'Review the applications you have already completed and the programs in the Hub. Group questions by their underlying type — team background, traction, market size, why this program, failure and resilience. Most accelerators, fellowships, and grants ask different phrasings of the same handful of questions. AQUA surfaces these recurring patterns so you can treat each question type as a reusable asset rather than a one-off prompt.',
  },
  {
    name: 'Write canonical answers for each question type',
    text: 'For every recurring question type, draft one strong canonical answer. This is the version you will reuse and improve over time. Write it to be complete and specific — include concrete numbers, named outcomes, and real examples. A canonical answer is not a template with blanks; it is the best version of that answer you can produce, written to be adapted later.',
  },
  {
    name: 'Create variants for different program contexts',
    text: 'Each program frames questions differently and weighs different criteria. Create a variant of your canonical answer tailored to each destination — adjust emphasis, length, and framing to match what that program measures. AQUA keeps every variant linked to its parent canonical answer so you never lose track of where a version came from or why it diverged.',
  },
  {
    name: 'Preserve lineage back to source material',
    text: 'Every variant should trace back to the source material that produced it — the original answer, the evidence behind it, and the program context that shaped it. Answer lineage lets you update the source and see which variants are affected, so improving one answer benefits every application that touches the same underlying question. Never copy an answer without keeping the connection to its origin.',
  },
  {
    name: 'Use Smart Matcher to find programs where your answers align',
    text: 'Run Smart Matcher against programs in the Hub to see how well your existing answer bank covers each program question surface. Smart Matcher measures coverage, theme alignment, criteria match, and answer completeness. It surfaces programs where you are already strong and flags gaps before you start drafting, so you spend effort where it matters.',
  },
  {
    name: 'Review and refine before submitting',
    text: 'Before you submit any application, review the variants you are using against the specific program questions. Check that each variant still fits, that the framing matches the program criteria, and that no source material has changed since the variant was written. Refine weak answers and update the canonical version so the improvement propagates to future applications.',
  },
]

export default function HowToReuseApplicationAnswersPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMBS.guideReuseAnswers).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howTo(
          'How to reuse application answers across programs',
          'Step-by-step guide to reusing application answers across programs: identify recurring questions, write canonical answers, create variants, preserve lineage, and use Smart Matcher.',
          '/guides/how-to-reuse-application-answers',
          STEPS,
        )).replace(/</g, '\\u003c') }}
      />
      <nav className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-6">
          <Link href="/" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">AQUA</Link>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <Link href="/guides" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">Guides</Link>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">Reuse Application Answers</span>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <section className="mb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">Guide</p>
          <h1 className="mb-6 text-4xl font-semibold tracking-tight md:text-5xl">How to reuse application answers</h1>
          <p className="max-w-3xl text-xl leading-relaxed text-neutral-600 dark:text-neutral-300">
            Answer reuse is a core capability of AQUA Application Hub. Many accelerators, fellowships, grants, and jobs ask different versions of the same underlying questions. This guide walks you through identifying recurring questions, writing canonical answers, creating program-specific variants, preserving lineage, and using Smart Matcher to find programs where your answers already align.
          </p>
        </section>

        <section className="space-y-10">
          {STEPS.map((step, i) => (
            <div key={step.name} className="border-b border-neutral-200 pb-8 dark:border-neutral-800">
              <h2 className="mb-4 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">
                <span className="mr-3 text-brand-600 dark:text-brand-400">{i + 1}.</span>
                {step.name}
              </h2>
              <p className="leading-7 text-neutral-600 dark:text-neutral-300">
                {step.text}
              </p>
            </div>
          ))}
        </section>

        <div className="mt-12 flex flex-wrap gap-4 border-t border-neutral-200 pt-8 text-sm dark:border-neutral-800">
          <Link href="/concepts/answer-reuse" className="btn-secondary">Answer reuse concept</Link>
          <Link href="/concepts/answer-lineage" className="btn-secondary">Answer lineage concept</Link>
          <Link href="/concepts/smart-matcher" className="btn-secondary">Smart Matcher concept</Link>
          <Link href="/faq" className="btn-secondary">FAQ</Link>
        </div>
      </main>
    </div>
  )
}
