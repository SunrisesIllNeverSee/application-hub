import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Scoring & Intelligence',
  description:
    'How AQUA computes significance scores, fit scores, and program value signals.',
}

interface ScoreCard {
  id: string
  name: string
  description: string
  formula: string
  accentColor: string
  doesntMean: string
  provisional?: boolean
}

const SCORE_CARDS: ScoreCard[] = [
  {
    id: 'significance',
    name: 'Significance Score',
    description:
      'How important a question is across the universe of programs. A high significance score means the question appears frequently, commands longer answers, and aligns with high-prestige themes.',
    formula: 'asked_by_count x word_limit_weight x theme_prestige x universal_bonus',
    accentColor: 'border-l-brand-500',
    doesntMean:
      "This score says nothing about the quality of your answer. It measures the question's structural importance — how much the ecosystem cares about this category of question.",
  },
  {
    id: 'fit',
    name: 'Fit Score',
    description:
      "How well your current profile aligns to a specific program's DNA. It measures four dimensions: how much of the program's question surface you have covered, how closely your answer themes match what the program emphasizes, how well your stated criteria match the program's focus, and a quality signal derived from answer completeness.",
    formula:
      '(coverage_pct x 0.40) + (theme_alignment x 0.35)\n+ (criteria_match x 0.15) + (quality_signal x 0.10)',
    accentColor: 'border-l-success-500',
    doesntMean:
      "A fit score is not a prediction of acceptance. Programs admit founders for reasons that live outside any formula — timing, team dynamics, the partner reading your application that week. This score tells you where you are prepared relative to what the program measures.",
  },
  {
    id: 'composite',
    name: 'Composite Score',
    description:
      "A single opportunity signal that combines your fit with a program against that program's estimated value. Used to rank programs in the Hub when you are logged in. Programs where you fit well and that carry high opportunity value surface first.",
    formula: 'fit_score x program_value_score / 100',
    accentColor: 'border-l-purple-500',
    doesntMean:
      'A composite score does not rank you against other founders. It ranks programs against each other, for you specifically. Two people viewing the same Hub see a different sort order.',
  },
  {
    id: 'heat',
    name: 'Heat Score',
    description:
      'A program desirability signal based on prestige markers, cohort size, follow-on funding rate, and structural indicators from the archive. Heat is used to surface programs when no personalized fit data is available.',
    formula: 'f(prestige_weight, cohort_size, follow_on_rate)',
    accentColor: 'border-l-warning-500',
    provisional: true,
    doesntMean:
      'Heat is not real-time competition data. It reflects structural signals in our archive, not live applicant volume or this-cycle acceptance rates. Heat scores are marked provisional until we have sufficient longitudinal data to validate the model.',
  },
  {
    id: 'program-value',
    name: 'Program Value Score',
    description:
      'An estimated opportunity value for a program, derived from brand weight, network quality, check size, and equity terms. Used as a multiplier in composite scoring. Higher value scores amplify good fit.',
    formula: 'f(brand_weight, network_quality, check_size, equity_factor)',
    accentColor: 'border-l-orange-500',
    doesntMean:
      'This is not an objective ranking of programs against each other. It is a structural estimate, not an editorial opinion. A program with a lower value score is not a worse program — it may simply serve a different stage or sector where our current signals are thinner.',
  },
]

function ScoreCardItem({ card }: { card: ScoreCard }) {
  return (
    <div id={card.id} className={`card p-6 border-l-4 ${card.accentColor} scroll-mt-24`}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
            {card.name}
          </h3>
          {card.provisional && (
            <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-md text-xs font-medium bg-warning-50 dark:bg-warning-500/10 text-warning-700 dark:text-warning-400">
              Provisional
            </span>
          )}
        </div>
        <a
          href={`#${card.id}`}
          className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors flex-shrink-0 mt-1 font-mono"
          aria-label={`Permalink to ${card.name}`}
        >
          #
        </a>
      </div>

      <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed mb-4">
        {card.description}
      </p>

      <div className="mb-4">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
          Formula
        </p>
        <pre className="bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-lg px-4 py-3 text-xs font-mono text-neutral-700 dark:text-neutral-300 overflow-x-auto whitespace-pre-wrap">
          {card.formula}
        </pre>
      </div>

      <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1.5">
          What it does not mean
        </p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
          {card.doesntMean}
        </p>
      </div>
    </div>
  )
}

function SectionLabel({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-8">
      <p className="text-xs uppercase tracking-wider text-brand-600 dark:text-brand-400 font-semibold mb-2">
        {label}
      </p>
      <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white tracking-tight">
        {title}
      </h2>
    </div>
  )
}

export default function ScoringPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50">
      <nav className="border-b border-neutral-200 dark:border-neutral-800 sticky top-0 z-30 bg-white/80 dark:bg-neutral-950/80 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors text-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M19 12H5M12 5l-7 7 7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            AQUA
          </Link>
          <span className="text-neutral-300 dark:text-neutral-600 text-sm">/</span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">Scoring</span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Hero */}
        <section className="mb-20">
          <p className="text-xs uppercase tracking-wider text-brand-600 dark:text-brand-400 font-semibold mb-4">
            How it works
          </p>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1] text-neutral-900 dark:text-white mb-6">
            Scoring &amp; Intelligence
          </h1>
          <p className="text-xl text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-2xl mb-5">
            We measure signal, not truth.
          </p>
          <p className="text-base text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-2xl">
            Every number on this platform is derived from a defined formula applied
            consistently to structured data. Scores are mathematically formulated
            internally — not editorial opinions, not committee judgments, not external
            rankings. The math is the same for everyone. What changes is the input.
          </p>
        </section>

        {/* Score cards */}
        <section className="mb-20">
          <SectionLabel label="The metrics" title="Five signals, each with a defined scope" />
          <div className="space-y-5">
            {SCORE_CARDS.map((card) => (
              <ScoreCardItem key={card.id} card={card} />
            ))}
          </div>
        </section>

        {/* Source-aware principle */}
        <section className="mb-20">
          <SectionLabel label="Signal depth" title="The same answer, two different scores" />
          <div className="card p-8">
            <blockquote className="border-l-4 border-brand-500 pl-5 mb-6">
              <p className="text-lg font-medium text-neutral-800 dark:text-neutral-100 leading-relaxed">
                Two founders can give identical answers and receive different scores —
                because the meaning of words comes from their source.
              </p>
            </blockquote>
            <div className="space-y-4 text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
              <p>
                A fit score is not purely about what you wrote. It is about what you wrote
                in the context of who wrote it — your profile, your history, the answers you
                have built over time, the themes your work touches.
              </p>
              <p>
                This is the foundation of deeper signal analysis coming in future updates.
                As you build your answer bank, the system develops a more complete picture of
                your signal. A sparse profile produces shallow scores. A complete one produces
                scores that reflect real alignment.
              </p>
              <p className="text-neutral-400 dark:text-neutral-500 text-xs pt-3 border-t border-neutral-100 dark:border-neutral-800">
                The source-awareness layer is currently derived from profile completeness and
                theme coverage. More granular founder context signals are in development.
              </p>
            </div>
          </div>
        </section>

        {/* What we don't do */}
        <section className="mb-20">
          <SectionLabel label="Boundaries" title="What we do not do" />
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                title: 'We do not decide who gets in',
                body: "AQUA has no relationship with any program's admissions process. No score we surface influences any decision made by YC, Techstars, NSF, or any other program.",
              },
              {
                title: 'We do not rank founders against each other',
                body: 'Scores are personal. Your composite score tells you how you fit a program — not how you compare to other people applying to that program. We never expose inter-founder comparisons.',
              },
              {
                title: 'We do not sell answers',
                body: 'Your answer bank is row-level-secured to your account. We do not aggregate, train on, or surface individual answers to anyone. Your capital stays yours.',
              },
              {
                title: 'We are not the arbiters of truth',
                body: 'The decision belongs to the programs, not us. We surface signal that helps you prepare. What programs do with what you submit is entirely outside our scope — and we intend to keep it that way.',
              },
            ].map((item) => (
              <div key={item.title} className="card p-5">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Coming next */}
        <section className="mb-16">
          <SectionLabel label="In development" title="Signals we are building toward" />
          <div className="card p-6">
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600 mt-2" />
                <div>
                  <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-1">
                    MoatScore
                  </p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    A commitment conservation signal. Measures how consistently a
                    founder&apos;s stated direction holds across applications over time.
                    Applicants who drift lose signal — those who maintain a clear thesis gain it.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600 mt-2" />
                <div>
                  <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-1">
                    FundScore
                  </p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    An answer fidelity extension to the fit model. Evaluates whether the
                    quality and specificity of answers matches the signal weight the question
                    carries — not just that the question was answered.
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-6 pt-5 border-t border-neutral-100 dark:border-neutral-800 text-xs text-neutral-400 dark:text-neutral-500">
              Both extend the current signal framework. No timelines — they ship when the data supports them.
            </p>
          </div>
        </section>

        {/* CTA strip */}
        <div className="flex flex-wrap items-center gap-4 pt-6 border-t border-neutral-100 dark:border-neutral-800">
          <Link href="/applications" className="btn-primary text-sm">
            Go to Hub
          </Link>
          <Link href="/login" className="btn-secondary text-sm">
            Sign in
          </Link>
          <span className="text-xs text-neutral-400 dark:text-neutral-500">
            Scores are computed from your live profile data.
          </span>
        </div>
      </main>

      <footer className="border-t border-neutral-200 dark:border-neutral-800 mt-12">
        <div className="max-w-4xl mx-auto px-6 py-8 flex items-center justify-between text-xs text-neutral-400 dark:text-neutral-500">
          <p>
            <Link
              href="/"
              className="hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            >
              AQUA
            </Link>
            {' '}&middot; Ello Cello LLC
          </p>
          <Link
            href="/about/scoring"
            className="hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          >
            Scoring &amp; Intelligence
          </Link>
        </div>
      </footer>
    </div>
  )
}
