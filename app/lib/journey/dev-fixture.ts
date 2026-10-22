// M09 W6 — SYNTHETIC catalog fixture for the dev harness (/dev/journey) and
// tests. Fictional programs on reserved example domains; no real data.

import type { JourneyCatalog } from './review-model.ts'

export const DEV_JOURNEY_CATALOG: JourneyCatalog = {
  programs: [
    {
      id: 'prog-example-accel',
      slug: 'example-accelerator',
      name: 'Example Accelerator',
      organization: 'Example Ventures',
      apply_url: 'https://accelerator.example.org/apply',
      deadline_at: '2027-03-02T07:59:00Z',
      cycle: { cycle_id: 'cyc-example-w27', cycle_name: 'Winter 2027', opens_at: '2026-11-01T00:00:00Z', closes_at: '2027-03-02T07:59:00Z', apply_url: 'https://accelerator.example.org/apply' },
      questions: [
        { id: 'pq-ex-1', canonical_question_id: 'aq-problem', canonical_text: 'What problem are you solving?', asked_as: 'What problem are you solving?', word_limit: 150, char_limit: null, required: true, order_index: 0, section: 'Company' },
        { id: 'pq-ex-2', canonical_question_id: 'aq-team', canonical_text: 'Tell us about your team.', asked_as: 'Tell us about your team.', word_limit: 200, char_limit: null, required: true, order_index: 1, section: 'Team' },
        { id: 'pq-ex-3', canonical_question_id: 'aq-why-now', canonical_text: 'Why now?', asked_as: 'Why is now the right time for this company?', word_limit: null, char_limit: 500, required: false, order_index: 2, section: 'Company' },
      ],
    },
    {
      id: 'prog-sample-fund',
      slug: 'sample-seed-fund',
      name: 'Sample Seed Fund',
      organization: 'Sample Capital',
      apply_url: 'https://fund.example.net/apply',
      deadline_at: null,
      cycle: null,
      questions: [
        { id: 'pq-sf-1', canonical_question_id: 'aq-problem', canonical_text: 'What problem are you solving?', asked_as: 'What problem are you solving, and why does it matter?', word_limit: 250, char_limit: null, required: true, order_index: 0, section: null },
        { id: 'pq-sf-2', canonical_question_id: 'aq-market', canonical_text: 'How big is the market?', asked_as: 'How big is the market?', word_limit: 300, char_limit: null, required: true, order_index: 1, section: null },
      ],
    },
  ],
}

/** Synthetic public application page served (stubbed) for the URL path. */
export const DEV_URL_PAGE_HTML = `<!doctype html><html><head><title>Example Accelerator — Winter 2027 application</title>
<meta name="description" content="Apply to the Example Accelerator Winter 2027 batch."></head><body>
<h1>Example Accelerator</h1>
<p>Applications close March 1, 2027 at 11:59 PM PT.</p>
<form>
<label for="a">What problem are you solving? (Maximum 150 words) *</label><textarea id="a" required></textarea>
<label for="b">Tell us about your team (max 200 words) *</label><textarea id="b" required></textarea>
<label for="c">Tell us about your team.</label><textarea id="c"></textarea>
<label for="d">What traction do you have in the last 12 months? (optional, 100 words max)</label><textarea id="d"></textarea>
<label for="e">Contact email</label><input id="e" type="email" value="founder@example.com">
</form></body></html>`

export const DEV_URL = 'https://accelerator.example.org/apply'

/** Synthetic pasted application (path c). */
export const DEV_PASTE_TEXT = `Northwind Civic Fellowship 2027
Deadline: April 15, 2027 5:00 PM ET

1. What problem are you solving? (Maximum 150 words)
2. Describe a project you led in the last two years. (300 words max) *
3. What would you do with the fellowship stipend? (optional)
`

/** Synthetic Word document paragraphs (path d) — the browser test zips these into a .docx. */
export const DEV_DOCX_PARAGRAPHS: Array<{ text: string; style?: string }> = [
  { text: 'Harbor Arts Micro-Grant 2027', style: 'Title' },
  { text: 'Applications due June 30, 2027 at 11:59 PM UTC.' },
  { text: 'Project', style: 'Heading1' },
  { text: '1. Describe the project you want to fund. (Maximum 200 words) *' },
  { text: '2. Who will benefit from this work? (500 characters max)' },
  { text: '3. What problem are you solving? (Maximum 150 words)' },
]
