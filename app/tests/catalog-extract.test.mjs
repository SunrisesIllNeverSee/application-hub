// M09 W2 — deterministic extraction (HTML forms, text, Markdown, records).
// Synthetic fixtures only. Run: node --test tests/catalog-extract.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractFromHtml,
  extractFromText,
  extractFromRecords,
  extractApplication,
  parseDeadline,
  readRobotsMeta,
  detectFormat,
} from '../lib/catalog/extract.ts'
import { classifyQALine } from '../lib/intake-extract-shared.ts'

const FORM = `<!doctype html>
<html><head>
  <title>Example Accelerator — Apply</title>
  <meta property="og:site_name" content="Example Ventures">
  <meta name="description" content="A twelve-week program for early-stage teams.">
  <meta name="robots" content="index, noai">
  <script>window.secret = "do not read me"</script>
  <style>.x{}</style>
</head>
<body>
  <h1>Example Accelerator Spring 2027</h1>
  <p>Applications close March 1, 2027 at 11:59 PM PT.</p>
  <a href="/apply">Apply now</a>
  <form action="/apply/submit" method="post">
    <h2>Company</h2>
    <label for="cname">Company name</label>
    <input id="cname" name="company_name" required>
    <label for="prob">What problem are you solving? (Maximum 250 words)</label>
    <p>Be concrete about who has the problem.</p>
    <textarea id="prob" name="problem" maxlength="1500"></textarea>
    <div role="heading" id="wn">Why now?</div>
    <textarea name="whynow" aria-labelledby="wn" aria-required="true"></textarea>
    <fieldset>
      <legend>Stage</legend>
      <label><input type="radio" name="stage" value="idea"> Idea</label>
      <label><input type="radio" name="stage" value="mvp" checked> MVP</label>
    </fieldset>
    <h2>Team</h2>
    <fieldset>
      <legend>Founders</legend>
      <label>How long have the founders known each other? <input type="text" name="known" maxlength="200"></label>
      <select name="ft" aria-label="Are you full-time?"><option>Select…</option><option>Yes</option><option selected>No</option></select>
      <label for="deck">Upload your pitch deck (optional)</label><input type="file" id="deck" name="deck">
    </fieldset>
    <input type="hidden" name="csrf" value="tok">
    <input type="password" name="pw" aria-label="Password">
    <button type="submit">Submit</button>
  </form>
</body></html>`

test('HTML form: questions in order with exact wording, sections, limits, required', () => {
  const r = extractFromHtml(FORM, { baseUrl: 'https://accelerator.example.org/apply' })
  const asked = r.occurrences.map((o) => o.asked_as)
  assert.deepEqual(asked, [
    'Company name',
    'What problem are you solving? (Maximum 250 words)',
    'Why now?',
    'Stage',
    'How long have the founders known each other?',
    'Are you full-time?',
    'Upload your pitch deck (optional)',
  ])
  assert.deepEqual(r.occurrences.map((o) => o.order_index), [0, 1, 2, 3, 4, 5, 6])
  const [name, prob, why, stage, known, ft, deck] = r.occurrences
  assert.equal(name.section, 'Company')
  assert.equal(name.requirements.required, true)
  assert.equal(prob.requirements.word_limit, 250)
  assert.equal(prob.requirements.char_limit, 1500, 'maxlength → char_limit')
  assert.equal(prob.description, 'Be concrete about who has the problem.')
  assert.equal(why.requirements.required, true, 'aria-required')
  assert.equal(stage.field.kind, 'radio')
  assert.deepEqual(stage.field.options, ['Idea', 'MVP'])
  assert.equal(stage.filled_value, 'MVP', 'checked radio is a filled value')
  assert.equal(stage.section, 'Company', 'single-group fieldset legend is the prompt, not a section')
  assert.equal(known.section, 'Founders')
  assert.equal(known.requirements.char_limit, 200)
  assert.equal(ft.field.kind, 'select')
  assert.deepEqual(ft.field.options, ['Yes', 'No'])
  assert.equal(ft.filled_value, 'No')
  assert.equal(deck.field.kind, 'file')
  assert.equal(deck.requirements.optional, true)
  assert.ok(!asked.some((a) => /password|csrf|submit/i.test(a)), 'hidden/password/buttons skipped')
})

test('HTML form: program identity hints', () => {
  const r = extractFromHtml(FORM, { baseUrl: 'https://accelerator.example.org/apply' })
  assert.equal(r.program.title, 'Example Accelerator — Apply', 'wording preserved (no dash folding)')
  assert.equal(r.program.organization, 'Example Ventures')
  assert.equal(r.program.description, 'A twelve-week program for early-stage teams.')
  assert.deepEqual(r.program.deadlines, [{ text: 'Applications close March 1, 2027 at 11:59 PM PT.', date: '2027-03-01', time: '23:59', timezone: 'PT' }])
  assert.ok(r.program.apply_urls.includes('https://accelerator.example.org/apply'))
  assert.ok(r.program.apply_urls.includes('https://accelerator.example.org/apply/submit'))
})

test('HTML: script/style contents are never extracted', () => {
  const r = extractFromHtml(FORM)
  assert.ok(!JSON.stringify(r).includes('do not read me'))
})

test('HTML: filled textarea/input values are captured separately (private)', () => {
  const r = extractFromHtml('<label for=a>Tell us about your team</label><textarea id=a>We are two engineers.</textarea><label for=b>Email</label><input id=b type=email value="a@b.example">')
  assert.equal(r.occurrences[0].asked_as, 'Tell us about your team')
  assert.equal(r.occurrences[0].filled_value, 'We are two engineers.')
  assert.equal(r.occurrences[1].filled_value, 'a@b.example')
})

test('HTML: static page listing questions (no controls) yields occurrences', () => {
  const r = extractFromHtml('<h2>Application questions</h2><ol><li>What are you building?</li><li>Describe your traction in the last 12 months (500 characters max)</li></ol><p>Questions? Email us.</p>')
  assert.deepEqual(r.occurrences.map((o) => o.asked_as), ['What are you building?', 'Describe your traction in the last 12 months (500 characters max)'])
  assert.equal(r.occurrences[0].section, 'Application questions')
  assert.equal(r.occurrences[1].requirements.char_limit, 500)
})

test('readRobotsMeta lists directives', () => {
  assert.deepEqual(readRobotsMeta(FORM), ['index', 'noai'])
})

const MD = `# Example Fellowship 2027
Deadline: April 15, 2027 23:59 UTC
Apply at https://fellowship.example.org/apply

## About you
Full name:
1. Tell us about yourself (max 200 words)
2. Why do you want to join, and why now?
I have wanted this for years.
It matters to me.

## Project
### What are you building?
- Describe traction in the last 12 months (500 characters max)
`

test('Markdown: headings → sections, numbered/bulleted prompts, answer prose captured as following_text', () => {
  const r = extractFromText(MD)
  assert.equal(r.format, 'markdown')
  assert.deepEqual(r.occurrences.map((o) => [o.asked_as, o.section]), [
    ['Full name', 'About you'],
    ['Tell us about yourself (max 200 words)', 'About you'],
    ['Why do you want to join, and why now?', 'About you'],
    ['What are you building?', 'Project'],
    ['Describe traction in the last 12 months (500 characters max)', 'Project'],
  ])
  assert.equal(r.occurrences[1].requirements.word_limit, 200)
  assert.equal(r.occurrences[2].following_text, 'I have wanted this for years.\nIt matters to me.')
  assert.ok(r.occurrences[2].requirements.qualifiers.some((q) => /why now/i.test(q)))
  assert.equal(r.occurrences[4].requirements.char_limit, 500)
  assert.equal(r.program.title, 'Example Fellowship 2027')
  assert.deepEqual(r.program.deadlines[0], { text: 'Deadline: April 15, 2027 23:59 UTC', date: '2027-04-15', time: '23:59', timezone: 'UTC' })
  assert.deepEqual(r.program.apply_urls, ['https://fellowship.example.org/apply'])
})

test('plain text Q:/A: shapes reuse the shared line grammar', () => {
  const r = extractFromText('Q: What is your company called?\nA: Synthetic Co.\n\nQuestion: Who are your users?\nAnswer: Small teams.\n')
  assert.deepEqual(r.occurrences.map((o) => o.asked_as), ['What is your company called?', 'Who are your users?'])
  assert.equal(r.occurrences[0].following_text, 'Synthetic Co.')
  assert.equal(classifyQALine('3) Why now?').kind, 'question')
  assert.equal(classifyQALine('A: because').kind, 'answer_label')
})

test('plain text "Label: value" lines are fields with private filled values', () => {
  const r = extractFromText('Company name: Synthetic Co\nWebsite: https://synthetic.example\nWhat do you do?\n')
  assert.equal(r.occurrences[0].asked_as, 'Company name')
  assert.equal(r.occurrences[0].filled_value, 'Synthetic Co')
  assert.ok(!r.occurrences.some((o) => o.asked_as === 'Website'), 'hint keys are not questions')
  assert.equal(r.occurrences[1].asked_as, 'What do you do?')
})

test('records (CSV/JSON rows) keep explicit limits and sections', () => {
  const r = extractFromRecords([{ question: 'What problem are you solving?', word_limit: 250, section: 'Company', required: true }, { question: '' }])
  assert.equal(r.occurrences.length, 1)
  assert.equal(r.occurrences[0].requirements.word_limit, 250)
  assert.equal(r.occurrences[0].requirements.required, true)
  assert.equal(r.occurrences[0].section, 'Company')
})

test('parseDeadline formats and time zones', () => {
  assert.deepEqual(parseDeadline('Due 2027-01-31T17:00 UTC+2'), { text: 'Due 2027-01-31T17:00 UTC+2', date: '2027-01-31', time: '17:00', timezone: 'UTC+2' })
  assert.equal(parseDeadline('Closes 5 June 2027, noon ET').date, '2027-06-05')
  assert.equal(parseDeadline('Closes 5 June 2027, noon ET').time, '12:00')
  assert.equal(parseDeadline('Closes 5 June 2027, noon ET').timezone, 'ET')
  const amb = parseDeadline('Deadline 03/04/2027')
  assert.equal(amb.ambiguous, true)
  assert.equal(parseDeadline('no date here'), null)
})

test('detectFormat + dispatcher', () => {
  assert.equal(detectFormat('<form><input></form>'), 'html')
  assert.equal(detectFormat('# Title\n\ntext'), 'markdown')
  assert.equal(detectFormat('just text?'), 'text')
  assert.equal(extractApplication({ content: '<label for=x>Why?</label><input id=x>' }).occurrences[0].asked_as, 'Why?')
})
