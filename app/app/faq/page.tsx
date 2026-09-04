import type { Metadata } from 'next'
import Link from 'next/link'
import { BREADCRUMBS, faqPage } from '@/lib/jsonld'

export const metadata: Metadata = {
  title: 'FAQ — AQUA Application Hub',
  description:
    'Answers to common questions about AQUA Application Hub: what it is, how answer reuse works, what Smart Matcher does, what fit score means, and how the MCP server works.',
  alternates: { canonical: '/faq' },
}

const FAQS: { question: string; answer: string }[] = [
  {
    question: 'What is AQUA Application Hub?',
    answer:
      'AQUA Application Hub is a platform for reusable application infrastructure. It turns recurring application questions, reusable answers, opportunity-fit signals, and review history into a portable application graph. The current public wedge is founder and startup opportunity applications — accelerators, fellowships, grants, and jobs.',
  },
  {
    question: 'Is AQUA an admissions oracle?',
    answer:
      'No. AQUA does not decide who is admitted, funded, hired, or selected. Its scores are decision-support and preparation signals, not acceptance probabilities, external rankings, or endorsements from any organization represented in the archive. AQUA helps you prepare; it does not predict outcomes.',
  },
  {
    question: 'How does answer reuse work?',
    answer:
      'Many accelerators, fellowships, grants, jobs, and schools ask different versions of the same underlying questions. AQUA treats questions and answers as reusable assets. You write a strong answer once, improve it over time, create variants for different destinations, and keep those variants connected to the source material that produced them. When a new application asks a similar question, AQUA surfaces the best existing answer instead of making you start from scratch.',
  },
  {
    question: 'What is Smart Matcher?',
    answer:
      'Smart Matcher is an AQUA feature that compares your current profile against a program question surface and identifies how well your existing answers align. It measures coverage (how much of the program questions you have already answered), theme alignment, criteria match, and answer completeness. Smart Matcher helps you prioritize programs where you are already strong and identify gaps before you start drafting.',
  },
  {
    question: 'What is fit score?',
    answer:
      'Fit score measures how well your current profile aligns to a specific program. It combines four dimensions: coverage of the program question surface (40%), theme alignment (35%), criteria match (15%), and a quality signal from answer completeness (10%). A fit score is not a prediction of acceptance — it tells you where you are prepared relative to what the program measures.',
  },
  {
    question: 'What is significance score?',
    answer:
      'Significance score measures how important a question is across the universe of programs. A high significance score means the question appears frequently, commands longer answers, and aligns with high-prestige themes. It does not grade the quality of your answer — it measures the question structural importance in the ecosystem.',
  },
  {
    question: 'What is the application graph?',
    answer:
      'The application graph is the data structure that connects your questions, answers, applications, fit signals, review loops, and reusable identity material. Instead of treating each application as an isolated document, the graph links related questions and answers across programs so that improving one answer benefits all applications that touch the same underlying question.',
  },
  {
    question: 'What is answer lineage?',
    answer:
      'Answer lineage is the connection between an answer variant and its source material. When you create a variant of an answer for a different program, AQUA tracks the relationship back to the original answer and its supporting evidence. This means you can trace why an answer says what it says, update the source, and see which variants are affected.',
  },
  {
    question: 'Is AQUA free?',
    answer:
      'AQUA is operated by Ello Cello LLC and is part of the broader MO§ES product family. The web application at mos2es.xyz is the canonical public product surface. Pricing details are available on the platform. The local MCP server and developer resources are publicly accessible.',
  },
  {
    question: 'How does the MCP server work?',
    answer:
      'AQUA ships a local MCP server (Model Context Protocol) that exposes answer retrieval, ranking, review-context, stress-test, and write-back capabilities for power users operating through agent environments. The MCP server runs locally via stdio — install it with npx aqua-mcp-server. There is no hosted public MCP endpoint at mos2es.xyz; the server is designed for local use alongside your agent client.',
  },
  {
    question: 'What is the Appfeeder extension?',
    answer:
      'Appfeeder is a browser extension that lets you capture application questions and draft answers directly from program websites. It feeds captured content into your AQUA answer bank so you can refine and reuse it across applications. Appfeeder is part of the AQUA ecosystem for reducing manual data entry.',
  },
  {
    question: 'Does AQUA rank applicants?',
    answer:
      'No. AQUA does not rank founders against each other. Scores are personal — your composite score tells you how you fit a program, not how you compare to other people applying to that program. AQUA never exposes inter-founder comparisons. The Hub ranks programs for you, not you against other applicants.',
  },
  {
    question: 'Does AQUA influence admissions decisions?',
    answer:
      'No. AQUA has no relationship with any program admissions process. No score AQUA surfaces influences any decision made by YC, Techstars, NSF, or any other program. AQUA surfaces signal that helps you prepare. What programs do with what you submit is entirely outside the AQUA scope.',
  },
  {
    question: 'What is the Contribution Exchange?',
    answer:
      'The Contribution Exchange is an agent-facing protocol that allows AI agents to propose or request contributions through a central Steward. It has moved to signalaf.com — see signalaf.com/agents.md for the full agent carry guide. Agents interact with the Steward at signalaf.com/api/exchange/steward/mos2es.xyz.',
  },
  {
    question: 'How do I get started with AQUA?',
    answer:
      'Visit mos2es.xyz and create an account. Build your answer bank by importing existing application answers or capturing new ones with the Appfeeder extension. Use Smart Matcher to find programs where your profile aligns. Check the Hub for ranked opportunities. Developers can install the MCP server with npx aqua-mcp-server for agent-based workflows.',
  },
]

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMBS.faq).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPage(FAQS)).replace(/</g, '\\u003c') }}
      />
      <nav className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-6">
          <Link href="/" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">AQUA</Link>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">FAQ</span>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <section className="mb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">Help center</p>
          <h1 className="mb-6 text-4xl font-semibold tracking-tight md:text-5xl">Frequently Asked Questions</h1>
          <p className="max-w-3xl text-xl leading-relaxed text-neutral-600 dark:text-neutral-300">
            Answers to the most common questions about AQUA Application Hub — what it is, how answer reuse works, what the scores mean, and how to get started.
          </p>
        </section>

        <section className="space-y-8">
          {FAQS.map((faq) => (
            <div key={faq.question} className="border-b border-neutral-200 pb-6 dark:border-neutral-800">
              <h2 className="mb-3 text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">
                {faq.question}
              </h2>
              <p className="leading-7 text-neutral-600 dark:text-neutral-300">
                {faq.answer}
              </p>
            </div>
          ))}
        </section>

        <div className="flex flex-wrap gap-4 border-t border-neutral-200 pt-8 text-sm dark:border-neutral-800">
          <Link href="/about" className="btn-secondary">About AQUA</Link>
          <Link href="/about/scoring" className="btn-secondary">Scoring methodology</Link>
          <Link href="/developers" className="btn-secondary">Developer portal</Link>
          <Link href="/contact" className="btn-secondary">Contact</Link>
        </div>
      </main>
    </div>
  )
}
