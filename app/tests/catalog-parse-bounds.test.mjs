// Parse-cost bounds for attacker-controlled catalog input: the HTML parser
// and the robots.txt matcher must stay linear and capped on crafted input.
// Synthetic input only. Run: node --test tests/catalog-parse-bounds.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseHtml, htmlToText, HTML_LIMITS } from '../lib/catalog/html.ts'
import { extractFromHtml } from '../lib/catalog/extract.ts'
import {
  robotsDisallows,
  robotsPatternMatches,
  ROBOTS_MAX_RULES,
  ROBOTS_MAX_PATTERN,
  ROBOTS_MAX_WILDCARDS,
} from '../lib/catalog/fetch-public.ts'

// Generous: the old implementation took seconds to minutes on these inputs.
const BUDGET_MS = 1500
const TWO_MB = 2 * 1024 * 1024

function timed(fn) {
  const t0 = performance.now()
  const out = fn()
  return { out, ms: performance.now() - t0 }
}

function maxDepth(el) {
  let best = 0
  const stack = [[el, 0]]
  while (stack.length) {
    const [n, d] = stack.pop()
    if (d > best) best = d
    for (const c of n.children) if (typeof c !== 'string') stack.push([c, d + 1])
  }
  return best
}

function countElements(el) {
  let k = 0
  const stack = [el]
  while (stack.length) {
    const n = stack.pop()
    for (const c of n.children) if (typeof c !== 'string') { k++; stack.push(c) }
  }
  return k
}

const fill = (unit, bytes) => unit.repeat(Math.ceil(bytes / unit.length))

// ─── HTML parser ─────────────────────────────────────────────────────────────

const HOSTILE_HTML = {
  'unmatched close tags': (() => { const n = 150_000; return '<b>'.repeat(n) + '</i>'.repeat(n) })(),
  'deep nesting': fill('<div>', TWO_MB),
  'unterminated tags': fill('<a b ', TWO_MB),
  'unterminated quotes': fill('<a b="', TWO_MB),
  'bogus declarations': fill('<!', TWO_MB),
  'bogus processing instructions': fill('<?', TWO_MB),
  'broken end tags': fill('</a ', TWO_MB),
  'many attributes': '<input ' + fill('a=1 ', TWO_MB) + '>',
  'element flood': fill('<i></i>', TWO_MB),
  'label fan-out': '<p id=big>' + fill('word ', 400_000) + '</p>' + fill('<input aria-labelledby="big big big">', 1_500_000),
  'unclosed comment + text': 'x'.repeat(1000) + '<!--' + fill('y', TWO_MB),
}

for (const [name, html] of Object.entries(HOSTILE_HTML)) {
  test(`parseHtml + extractFromHtml stay under budget: ${name} (${Math.round(html.length / 1024)} KB)`, () => {
    const { out: root, ms } = timed(() => parseHtml(html))
    const { ms: ms2 } = timed(() => extractFromHtml(html))
    const { ms: ms3 } = timed(() => htmlToText(root))
    assert.ok(ms < BUDGET_MS, `parse took ${ms.toFixed(0)} ms`)
    assert.ok(ms2 < BUDGET_MS * 2, `extract took ${ms2.toFixed(0)} ms`)
    assert.ok(ms3 < BUDGET_MS, `htmlToText took ${ms3.toFixed(0)} ms`)
    assert.ok(maxDepth(root) <= HTML_LIMITS.maxDepth + 1)
    assert.ok(countElements(root) <= HTML_LIMITS.maxElements)
  })
}

test('parseHtml: unmatched-close cost grows linearly, not quadratically', () => {
  const run = (n) => timed(() => parseHtml('<b>'.repeat(n) + '</i>'.repeat(n))).ms
  run(20_000) // warm up
  const small = Math.max(Math.min(run(20_000), run(20_000), run(20_000)), 2)
  const large = Math.min(run(160_000), run(160_000))
  // 8x the input; quadratic would be ~64x. Allow wide noise margin.
  assert.ok(large < small * 24, `8x input took ${(large / small).toFixed(1)}x the time`)
})

test('parseHtml caps: depth, element count, text, attributes; root.truncated set', () => {
  const deep = parseHtml('<div>'.repeat(1000) + 'leaf')
  assert.equal(deep.truncated, true)
  assert.ok(maxDepth(deep) <= HTML_LIMITS.maxDepth + 1)
  assert.match(htmlToText(deep), /leaf/, 'content past the depth cap is kept, flattened')

  const many = parseHtml('<i>x</i>'.repeat(50), { maxElements: 10 })
  assert.equal(countElements(many), 10)
  assert.equal(many.truncated, true)

  const text = parseHtml('<p>' + 'a'.repeat(500) + '</p><p>' + 'b'.repeat(500) + '</p>', { maxTextChars: 600 })
  assert.equal(htmlToText(text).replace(/\s/g, '').length, 600)
  assert.equal(text.truncated, true)

  const attrs = parseHtml('<input ' + Array.from({ length: 100 }, (_, i) => `a${i}=1`).join(' ') + '>')
  assert.equal(Object.keys(attrs.children[0].attrs).length, HTML_LIMITS.maxAttrs)

  const normal = parseHtml('<form><label for=a>Name</label><input id=a></form>')
  assert.equal(normal.truncated, undefined, 'ordinary pages are not truncated')
})

test('extractFromHtml warns when the page was truncated', () => {
  const r = extractFromHtml('<div>'.repeat(400) + '<label>Why us?<textarea></textarea></label>')
  assert.ok(r.warnings.some((w) => /parse limits/.test(w)))
})

test('parseHtml keeps the tolerant behaviour on ordinary malformed markup', () => {
  const ser = (n) => typeof n === 'string' ? JSON.stringify(n) : `<${n.tag}${Object.keys(n.attrs).length ? ' ' + JSON.stringify(n.attrs) : ''}>[${n.children.map(ser).join(',')}]`
  const cases = [
    ['<p>a<p>b<div>c</div>', '<#document>[<p>["a"],<p>["b"],<div>["c"]]'],
    ['<b>x</i>y</b>', '<#document>[<b>["x","y"]]'],
    ['<a href="x>y">t</a>', '<#document>[<a {"href":"x>y"}>["t"]]'],
    ['<!-- c --><![CDATA[x]]>z<?pi?>w<!doctype html>', '<#document>["z","w"]'],
    ['<script>var a="</div>"</script>after', '<#document>["after"]'],
    ['<textarea>a<b>c</textarea>d', '<#document>[<textarea>["a<b>c"],"d"]'],
    ['a < b > c', '<#document>["a < b > c"]'],
    ['<a b="unterminated', '<#document>["<a b=\\"unterminated"]'],
    ['</ div>x', '<#document>["x"]'],
    ['<div   class = "c"  >y</div  >', '<#document>[<div {"class":"c"}>["y"]]'],
    ['<p a=b/>z', '<#document>[<p {"a":"b/"}>["z"]]'],
    ['<a b c=d e>', '<#document>[<a {"b":"","c":"d","e":""}>[]]'],
    ['x &amp; &#x41; y', '<#document>["x & A y"]'],
    ['<!--x', '<#document>[]'],
  ]
  for (const [html, want] of cases) assert.equal(ser(parseHtml(html)), want, html)
})

// ─── robots.txt ──────────────────────────────────────────────────────────────

/** The previous regex-based matcher, kept here as the semantic reference. */
function regexReference(path, pattern) {
  if (!pattern) return false
  const anchored = pattern.endsWith('$')
  const body = anchored ? pattern.slice(0, -1) : pattern
  const re = new RegExp('^' + body.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + (anchored ? '$' : ''))
  return re.test(path)
}

test('robotsPatternMatches: parity with the regex semantics on fixed cases', () => {
  const cases = [
    ['/private/x', '/private'], ['/private', '/private/'], ['/files/form.pdf', '/*.pdf$'], ['/files/form.pdf?x', '/*.pdf$'],
    ['/files/form.pdf?x', '/*.pdf'], ['/a/b/c', '/a*c'], ['/a/b/c', '/a*c$'], ['/a/b/cd', '/a*c$'], ['/', '/'], ['/x', '/$'],
    ['/', '/$'], ['/abc', '*'], ['/abc', '*$'], ['/abc', '/a**c'], ['/a.c', '/a.c'], ['/abc', '/a.c'], ['/a$b', '/a$b'],
    ['/a(b)', '/a(b)'], ['/a?q=1', '/a?q='], ['/aXbXc', '/a*b*c*'], ['/acb', '/a*b*c'], ['/abab', '/*ab$'], ['/ab', '/ab*ab'],
  ]
  for (const [path, pat] of cases) assert.equal(robotsPatternMatches(path, pat), regexReference(path, pat), `${pat} vs ${path}`)
})

test('robotsPatternMatches: parity with the regex semantics on random small inputs', () => {
  let seed = 12345
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n }
  const alpha = ['/', 'a', 'b', '.', '?', '$', '*']
  for (let i = 0; i < 5000; i++) {
    const path = '/' + Array.from({ length: rnd(8) }, () => alpha[rnd(5)]).join('')
    const pat = '/' + Array.from({ length: rnd(6) }, () => alpha[rnd(alpha.length)]).join('')
    assert.equal(robotsPatternMatches(path, pat), regexReference(path, pat), `${pat} vs ${path}`)
  }
})

test('robotsPatternMatches: pathological wildcard patterns run in linear time', () => {
  const path = '/' + 'a'.repeat(2047)
  for (const pat of ['/*a*a*a*a*b', '/*a*a*a*a*a*a*a*a*a*a*a*a*a*a*b', '/' + '*a'.repeat(200) + '*b$', '/' + '*a'.repeat(200) + 'b']) {
    const { out, ms } = timed(() => robotsPatternMatches(path, pat))
    assert.equal(out, false)
    assert.ok(ms < 50, `${pat.slice(0, 30)}… took ${ms.toFixed(1)} ms`)
  }
})

test('robotsDisallows: a hostile robots.txt evaluates under budget', () => {
  const path = '/' + 'a'.repeat(2047)
  const lines = ['User-agent: *']
  for (let i = 0; i < ROBOTS_MAX_RULES - 1; i++) lines.push('Allow: /' + '*a'.repeat(ROBOTS_MAX_WILDCARDS) + '*b')
  const txt = lines.join('\n')
  assert.ok(txt.length < 256 * 1024)
  const { out, ms } = timed(() => robotsDisallows(txt, path))
  assert.equal(out, false)
  assert.ok(ms < BUDGET_MS, `took ${ms.toFixed(0)} ms`)
})

test('robotsDisallows caps: too many rules, over-long or over-wildcarded rules resolve conservatively', () => {
  const tooMany = 'User-agent: *\n' + 'Allow: /x\n'.repeat(ROBOTS_MAX_RULES + 1)
  assert.equal(robotsDisallows(tooMany, '/apply'), true, 'more rules than the cap → treated as disallowed')

  const longDisallow = `User-agent: *\nDisallow: /${'z'.repeat(ROBOTS_MAX_PATTERN)}\n`
  assert.equal(robotsDisallows(longDisallow, '/apply'), true, 'unevaluable Disallow counts as disallowing')

  const starDisallow = `User-agent: *\nDisallow: /${'*q'.repeat(ROBOTS_MAX_WILDCARDS + 1)}\n`
  assert.equal(robotsDisallows(starDisallow, '/apply'), true)

  const longAllow = `User-agent: *\nDisallow: /apply\nAllow: /apply${'*'.repeat(1)}${'z'.repeat(ROBOTS_MAX_PATTERN)}\n`
  assert.equal(robotsDisallows(longAllow, '/apply'), true, 'unevaluable Allow is ignored')

  const otherGroup = `User-agent: someotherbot\nDisallow: /${'z'.repeat(ROBOTS_MAX_PATTERN)}\n\nUser-agent: *\nAllow: /\n`
  assert.equal(robotsDisallows(otherGroup, '/apply'), false, 'limits only apply to the group we evaluate')

  // runs of '*' count once
  assert.equal(robotsDisallows(`User-agent: *\nDisallow: /a${'*'.repeat(40)}z\n`, '/apply'), false)
})

test('robotsDisallows: existing semantics unchanged (groups, longest match, Allow override, $)', () => {
  const txt = 'User-agent: *\nDisallow: /private\nAllow: /private/apply\nDisallow: /*.pdf$\n'
  assert.equal(robotsDisallows(txt, '/apply'), false)
  assert.equal(robotsDisallows(txt, '/private/x'), true)
  assert.equal(robotsDisallows(txt, '/private/apply'), false)
  assert.equal(robotsDisallows(txt, '/files/form.pdf'), true)
  assert.equal(robotsDisallows(txt, '/files/form.pdf?dl=1'), false)
  assert.equal(robotsDisallows('User-agent: aqua\nDisallow: /\n\nUser-agent: *\nAllow: /\n', '/apply'), true)
  assert.equal(robotsDisallows('User-agent: *\nDisallow:\n', '/apply'), false)
})
