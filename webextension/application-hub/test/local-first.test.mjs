// LF-13 — Node test harness for the local-first gating functions.
// Run: node webextension/application-hub/test/local-first.test.mjs

import {
  ALLOWED_HUB_HOSTS,
  buildConsentRecord,
  evaluateGenerateConsent,
  hubSyncOptedIn,
  isAllowedHubUrl,
  isAllowedSenderOrigin,
  isLocalhostUrl,
  localFirstEnabled,
  stripCaptureAnswerBodies,
} from '../local-first.js'

let passed = 0
let failed = 0

function check(name, cond) {
  if (cond) { passed++; console.log(`  ok   ${name}`) }
  else { failed++; console.log(`  FAIL ${name}`) }
}

console.log('origin gates')
check('aquaidp.xyz hub allowed', isAllowedHubUrl('https://aquaidp.xyz'))
check('subdomain allowed', isAllowedHubUrl('https://app.aquaidp.xyz'))
check('localhost dev allowed', isAllowedHubUrl('http://localhost:3000'))
check('127.0.0.1 dev allowed', isAllowedHubUrl('http://127.0.0.1:4317'))
check('http aquaidp.xyz rejected', !isAllowedHubUrl('http://aquaidp.xyz'))
check('foreign https rejected', !isAllowedHubUrl('https://evil.example.com'))
check('lookalike rejected', !isAllowedHubUrl('https://aquaidp.xyz.evil.com'))
check('garbage rejected', !isAllowedHubUrl('not-a-url'))
check('localhost url helper', isLocalhostUrl('http://localhost:3000/x'))
check('non-localhost helper', !isLocalhostUrl('https://aquaidp.xyz'))

console.log('sender origin gate')
check('aquaidp.xyz sender ok', isAllowedSenderOrigin('https://aquaidp.xyz'))
check('localhost sender ok', isAllowedSenderOrigin('http://localhost:5173'))
check('extension page sender ok', isAllowedSenderOrigin('chrome-extension://abc123/sidepanel.html'))
check('funder site rejected', !isAllowedSenderOrigin('https://apply.techstars.com'))
check('empty sender rejected', !isAllowedSenderOrigin(''))
check('null sender rejected', !isAllowedSenderOrigin(null))

console.log('local-first flag')
check('default ON when unset', localFirstEnabled({}))
check('explicit true ON', localFirstEnabled({ localFirst: true }))
check('explicit false OFF', !localFirstEnabled({ localFirst: false }))
check('hub sync default OFF', !hubSyncOptedIn({}))
check('hub sync only on true', hubSyncOptedIn({ syncToHub: true }))
check('hub sync truthy rejected', !hubSyncOptedIn({ syncToHub: 'yes' }))

console.log('capture stripping')
const capture = {
  title: 'YC Application',
  url: 'https://apply.example.com/app',
  questions: [
    { fieldId: 'f1', label: 'Why you?', value: 'secret answer body', selector: '[data-x]' },
    { fieldId: 'f2', label: 'Team?', value: '', selector: '[data-y]' },
  ],
  content: '# YC\n\n## Why you?\n\nsecret answer body',
}
const stripped = stripCaptureAnswerBodies(capture)
check('values emptied', stripped.questions.every((q) => q.value === ''))
check('labels kept', stripped.questions[0].label === 'Why you?')
check('redacted flag on filled field', stripped.questions[0].redacted === true)
check('unfilled field not flagged', stripped.questions[1].redacted === false)
check('redactedAnswers counted', stripped.redactedAnswers === 1)
check('content has no body', !stripped.content.includes('secret answer body'))
check('content keeps label', stripped.content.includes('Why you?'))
check('original untouched', capture.questions[0].value === 'secret answer body')
check('null capture safe', stripCaptureAnswerBodies(null) === null)

console.log('generate consent')
check('allowed w/ confirm under LF',
  evaluateGenerateConsent({ settings: {}, confirmEgress: true }).allowed)
check('refused w/o confirm under LF',
  !evaluateGenerateConsent({ settings: {}, confirmEgress: undefined }).allowed)
check('refused on falsy confirm',
  !evaluateGenerateConsent({ settings: {}, confirmEgress: 'yes' }).allowed)
check('refusal reason honest',
  evaluateGenerateConsent({ settings: {}, confirmEgress: false }).reason === 'consent_required')
check('LF off bypasses consent',
  evaluateGenerateConsent({ settings: { localFirst: false }, confirmEgress: undefined }).allowed)

console.log('consent record')
const rec = buildConsentRecord({ provider: 'anthropic', model: 'claude-sonnet-4-6', kind: 'generate', questionText: 'Q?' })
check('provider recorded', rec.provider === 'anthropic')
check('model recorded', rec.model === 'claude-sonnet-4-6')
check('kind recorded', rec.kind === 'generate')
check('timestamp present', typeof rec.ts === 'string' && rec.ts.length > 0)
check('preview truncated', buildConsentRecord({ questionText: 'x'.repeat(200) }).questionPreview.length === 80)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
