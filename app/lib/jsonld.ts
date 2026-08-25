/**
 * lib/jsonld.ts — Schema.org JSON-LD builders for AQUA Application Hub.
 *
 * Each builder returns a plain object that gets serialized into an
 * `application/ld+json` script tag. The shapes target both classic search
 * (Google rich results) and generative engines (ChatGPT / Perplexity /
 * Claude / AI Overviews).
 *
 * All URLs are absolute (SITE_ORIGIN) — relative URLs don't work in
 * structured data per the Schema.org spec.
 */

const SITE_ORIGIN = 'https://mos2es.xyz'
const ORG_ID = `${SITE_ORIGIN}/#organization`
const SITE_ID = `${SITE_ORIGIN}/#website`

/** BreadcrumbList — add to sub-pages for SEO + GEO. */
export function breadcrumbList(trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: `${SITE_ORIGIN}${t.path}`,
    })),
  }
}

/** FAQPage — high-value for AI citation. Each Q&A becomes a citable answer. */
export function faqPage(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  }
}

/** DefinedTerm — for glossary/concept pages. AI engines cite these. */
export function definedTerm(term: string, definition: string, path: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: term,
    description: definition,
    url: `${SITE_ORIGIN}${path}`,
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      name: 'AQUA Application Hub Scoring Concepts',
      url: `${SITE_ORIGIN}/about/scoring`,
    },
  }
}

/** ItemList — for list pages (programs, features, etc.). */
export function itemList(name: string, path: string, items: { name: string; url?: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    url: `${SITE_ORIGIN}${path}`,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      ...(item.url ? { url: item.url } : {}),
    })),
  }
}

/** HowTo — for guide pages. AI engines cite step-by-step instructions. */
export function howTo(name: string, description: string, path: string, steps: { name: string; text: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    description,
    url: `${SITE_ORIGIN}${path}`,
    step: steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  }
}

/** Article — for comparison pages. */
export function comparisonArticle(headline: string, description: string, path: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    url: `${SITE_ORIGIN}${path}`,
    publisher: { '@id': ORG_ID },
    isPartOf: { '@id': SITE_ID },
  }
}

/** Common breadcrumb trails for AQUA pages. */
export const BREADCRUMBS = {
  about: breadcrumbList([
    { name: 'Home', path: '/' },
    { name: 'About', path: '/about' },
  ]),
  scoring: breadcrumbList([
    { name: 'Home', path: '/' },
    { name: 'About', path: '/about' },
    { name: 'Scoring', path: '/about/scoring' },
  ]),
  contact: breadcrumbList([
    { name: 'Home', path: '/' },
    { name: 'Contact', path: '/contact' },
  ]),
  privacy: breadcrumbList([
    { name: 'Home', path: '/' },
    { name: 'Privacy', path: '/privacy' },
  ]),
  developers: breadcrumbList([
    { name: 'Home', path: '/' },
    { name: 'Developers', path: '/developers' },
  ]),
  agents: breadcrumbList([
    { name: 'Home', path: '/' },
    { name: 'Agent Guide', path: '/agents' },
  ]),
  faq: breadcrumbList([
    { name: 'Home', path: '/' },
    { name: 'FAQ', path: '/faq' },
  ]),
  // Concept pages
  conceptAnswerReuse: breadcrumbList([
    { name: 'Home', path: '/' },
    { name: 'Application Infrastructure', path: '/application-infrastructure' },
    { name: 'Answer Reuse', path: '/concepts/answer-reuse' },
  ]),
  conceptFitScore: breadcrumbList([
    { name: 'Home', path: '/' },
    { name: 'Application Infrastructure', path: '/application-infrastructure' },
    { name: 'Fit Score', path: '/concepts/fit-score' },
  ]),
  conceptApplicationGraph: breadcrumbList([
    { name: 'Home', path: '/' },
    { name: 'Application Infrastructure', path: '/application-infrastructure' },
    { name: 'Application Graph', path: '/concepts/application-graph' },
  ]),
  conceptAnswerLineage: breadcrumbList([
    { name: 'Home', path: '/' },
    { name: 'Application Infrastructure', path: '/application-infrastructure' },
    { name: 'Answer Lineage', path: '/concepts/answer-lineage' },
  ]),
  conceptSmartMatcher: breadcrumbList([
    { name: 'Home', path: '/' },
    { name: 'Application Infrastructure', path: '/application-infrastructure' },
    { name: 'Smart Matcher', path: '/concepts/smart-matcher' },
  ]),
  // Guide pages
  guideReuseAnswers: breadcrumbList([
    { name: 'Home', path: '/' },
    { name: 'Guides', path: '/guides' },
    { name: 'Reuse Application Answers', path: '/guides/how-to-reuse-application-answers' },
  ]),
  guideCompareFit: breadcrumbList([
    { name: 'Home', path: '/' },
    { name: 'Guides', path: '/guides' },
    { name: 'Compare Accelerator Fit', path: '/guides/how-to-compare-accelerator-fit' },
  ]),
  guideBuildAnswerBank: breadcrumbList([
    { name: 'Home', path: '/' },
    { name: 'Guides', path: '/guides' },
    { name: 'Build an Answer Bank', path: '/guides/how-to-build-an-answer-bank' },
  ]),
  // Comparison pages
  vsFounderApp: breadcrumbList([
    { name: 'Home', path: '/' },
    { name: 'Comparisons', path: '/vs' },
    { name: 'AQUA vs FounderApp', path: '/vs/founderapp' },
  ]),
  vsManualTracking: breadcrumbList([
    { name: 'Home', path: '/' },
    { name: 'Comparisons', path: '/vs' },
    { name: 'AQUA vs Manual Tracking', path: '/vs/manual-application-tracking' },
  ]),
  vsSpreadsheets: breadcrumbList([
    { name: 'Home', path: '/' },
    { name: 'Comparisons', path: '/vs' },
    { name: 'AQUA vs Spreadsheets', path: '/vs/spreadsheets-for-applications' },
  ]),
  // Topic hub
  applicationInfrastructure: breadcrumbList([
    { name: 'Home', path: '/' },
    { name: 'Application Infrastructure', path: '/application-infrastructure' },
  ]),
}

/** DefinedTerm entries for the 5 scoring concepts on /about/scoring. */
export const SCORING_TERMS = [
  definedTerm(
    'Significance Score',
    'How important a question is across the universe of programs. A high significance score means the question appears frequently, commands longer answers, and aligns with high-prestige themes. It does not grade the quality of an individual user answer.',
    '/about/scoring#significance',
  ),
  definedTerm(
    'Fit Score',
    'How well a user current profile aligns to a specific program DNA. Measures four dimensions: coverage of the program question surface, theme alignment, criteria match, and answer completeness quality signal. A fit score is not a prediction of acceptance.',
    '/about/scoring#fit',
  ),
  definedTerm(
    'Composite Score',
    'A single opportunity signal that combines personal fit with a program against that program estimated value. Used to rank programs in the Hub for a specific user. Does not rank users against each other.',
    '/about/scoring#composite',
  ),
  definedTerm(
    'Heat Score',
    'A program desirability signal based on prestige markers, cohort size, follow-on funding rate, and structural indicators from the archive. Used to surface programs when no personalized fit data is available. Provisional until sufficient longitudinal data exists.',
    '/about/scoring#heat',
  ),
  definedTerm(
    'Program Value Score',
    'An estimated opportunity value for a program, derived from brand weight, network quality, check size, and equity terms. Used as a multiplier in composite scoring. Not an objective ranking of programs against each other.',
    '/about/scoring#program-value',
  ),
]
