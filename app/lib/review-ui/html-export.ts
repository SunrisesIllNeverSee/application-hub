// M09 W5 — self-contained offline review HTML. PURE string builder.
//
// The file renders every review card (context, answer, evidence,
// recommendation, status, hashes) from the same ReviewCardVM the app uses.
// Its decision controls only fill a downloadable decision file — the page
// says so in a banner that is always visible, and it has NO network
// capability (CSP default-src 'none'; no external assets). Everything is
// inline: CSS (light/dark, responsive) and one small script.

import type { ReviewCardVM, Tone } from './view-model.ts'
import { DECISION_BUILDER_JS } from './decision-file.ts'

export interface ReviewHtmlInput {
  instance_id: string
  program_name: string | null
  org_name: string | null
  exported_at: string
  /** Random per-export nonce (also recorded, hashed, in the vault) — lets import recognise this export. */
  export_nonce?: string | null
  cards: ReviewCardVM[]
}

export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const e = escapeHtml

/** Only http(s) links become anchors; anything else is shown as text. */
function safeHref(url: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

function pill(label: string, tone: Tone, title?: string): string {
  return `<span class="pill t-${tone}"${title ? ` title="${e(title)}"` : ''}>${e(label)}</span>`
}

function list(items: string[], empty: string): string {
  if (items.length === 0) return `<p class="muted">${e(empty)}</p>`
  return `<ul>${items.map((i) => `<li>${e(i)}</li>`).join('')}</ul>`
}

function approvalTone(state: ReviewCardVM['approval']['state']): Tone {
  return state === 'approved' ? 'success' : state === 'revoked' ? 'danger' : state === 'approved_older' ? 'warning' : 'neutral'
}

function cardHtml(c: ReviewCardVM, index: number): string {
  const a = c.answer
  const ctx = c.context
  const rec = c.recommendation
  const ev = c.evidence
  const limits = a?.limits
  const counts = limits
    ? `${limits.word_count}${limits.word_limit ? ` / ${limits.word_limit}` : ''} words · ${limits.char_count}${limits.char_limit ? ` / ${limits.char_limit}` : ''} characters`
    : ''
  const over = limits?.over_limit
    ? `<p class="warn">Over limit${limits.over_word_by ? ` by ${limits.over_word_by} words` : ''}${limits.over_char_by ? `${limits.over_word_by ? ' and' : ' by'} ${limits.over_char_by} characters` : ''}.</p>`
    : ''

  const evidenceItems = ev.items.length
    ? `<ul class="evidence">${ev.items
        .map((it) => {
          const href = safeHref(it.url)
          return `<li><div class="ev-head"><strong>${e(it.title)}</strong> <span class="tag">${e(it.kind)}</span> ${pill(it.verification_label, it.verification === 'unverified' ? 'warning' : 'success')} <span class="muted">${e(it.freshness_label)}</span></div>${
            it.excerpt ? `<blockquote>${e(it.excerpt)}</blockquote>` : ''
          }${href ? `<p><a href="${e(href)}" rel="noopener noreferrer" target="_blank">${e(it.url)}</a></p>` : it.url ? `<p class="mono">${e(it.url)}</p>` : ''}<p class="mono muted">content sha256 ${e(it.content_sha_prefix)}…</p></li>`
        })
        .join('')}</ul>`
    : `<p class="gap">No evidence linked to this version.</p>`

  const lineage = ev.lineage.length
    ? `<ol class="lineage">${ev.lineage
        .map(
          (l) =>
            `<li${l.is_governing ? ' class="current"' : ''}><span class="mono">v${l.number}</span> · ${e(l.method_label)} · ${e(l.created_at.slice(0, 16).replace('T', ' '))} · <span class="mono">sha256 ${e(l.sha_prefix)}…</span>${
              l.parent_number ? ` · child of v${l.parent_number}` : ''
            }${l.approved ? ' · <strong>approved</strong>' : ''}${l.is_governing ? ' · <em>displayed</em>' : ''}${
              l.decisions.length ? `<ul>${l.decisions.map((d) => `<li>${e(d.label)} · ${e(d.at.slice(0, 16).replace('T', ' '))}${d.restored ? ' · restored (does not count)' : ''}${d.hash_matches ? '' : ' · hash mismatch (does not count)'}${d.note ? ` — “${e(d.note)}”` : ''}</li>`).join('')}</ul>` : ''
            }</li>`,
        )
        .join('')}</ol>`
    : '<p class="muted">No versions yet.</p>'

  const derived = ev.derived_from
    ? `<p>Started from another answer: version <span class="mono">${e(ev.derived_from.version_id.slice(0, 8))}…</span> (sha256 <span class="mono">${e(ev.derived_from.version_sha256.slice(0, 12))}…</span>)${
        ev.derived_from.title ? ` “${e(ev.derived_from.title)}”` : ''
      }${ev.derived_from.question_occurrence_id ? ` for question <span class="mono">${e(ev.derived_from.question_occurrence_id)}</span>` : ''}. Approval never transfers.</p>`
    : ''

  const claims = ev.uncertain_claims.length
    ? `<ul>${ev.uncertain_claims.map((u) => `<li>${e(u.text)} <span class="tag">${u.source === 'agent' ? 'flagged by agent' : 'challenged by you'}</span></li>`).join('')}</ul>`
    : '<p class="muted">No claims flagged.</p>'

  const comments = c.comments.total
    ? `<section class="sec"><h4>Discussion (${c.comments.total})</h4>${c.comments.threads
        .map(
          (t) =>
            `<div class="thread">${t.comments
              .map((cm) => `<div class="cm${cm.parent_comment_id ? ' reply' : ''}"><span class="tag">${e(cm.on_label)}</span>${cm.source_label ? ` <span class="tag">${e(cm.source_label)}</span>` : ''} <span class="muted">${e(cm.at.slice(0, 16).replace('T', ' '))}</span><p>${e(cm.body)}</p></div>`)
              .join('')}</div>`,
        )
        .join('')}</section>`
    : ''

  const decision = a
    ? `<fieldset class="decide" data-occ="${e(c.question_occurrence_id)}" data-version="${e(a.version_id)}" data-sha="${e(a.sha256)}">
  <legend>Your decision for v${a.version_number} <span class="muted">(offline — fills the decision file only)</span></legend>
  <p class="mono small">version ${e(a.version_id)}<br>sha256 ${e(a.sha256)}</p>
  <div class="choices">
    <label><input type="radio" name="d-${index}" value="approve"> Approve this exact version</label>
    <label><input type="radio" name="d-${index}" value="needs_revision"> Needs revision</label>
    <label><input type="radio" name="d-${index}" value="needs_evidence"> Needs evidence</label>
    <label><input type="radio" name="d-${index}" value="" checked> No decision</label>
  </div>
  <label class="block">Comment or instruction (optional)<textarea rows="3" name="c-${index}"></textarea></label>
</fieldset>`
    : `<p class="muted">No version to decide on yet.</p>`

  return `<article class="card" id="q-${index + 1}">
<header class="card-head">
  <h2><span class="qn">Q${index + 1}</span> ${e(ctx.original_question ?? c.question_occurrence_id)}</h2>
  <div class="pills">
    ${pill(`Status: ${c.status.label}`, c.status.tone)}
    ${pill(c.recommendation_badge.label, 'info', 'Advice only — not evidence, not approval')}
    ${pill(`Human review: ${c.human_review.label}`, c.human_review.decision ? 'warning' : 'neutral')}
    ${pill(`Approval: ${c.approval.label}`, approvalTone(c.approval.state))}
  </div>
</header>
<section class="sec"><h3>Question context</h3>
  <dl>
    <dt>Program</dt><dd>${e(ctx.program_name ?? '—')}${ctx.org_name ? ` · ${e(ctx.org_name)}` : ''}</dd>
    <dt>Original question</dt><dd>${e(ctx.original_question ?? 'Wording unavailable')}</dd>
    <dt>Canonical question</dt><dd>${ctx.canonical_question_id ? `<span class="mono">${e(ctx.canonical_question_id)}</span>${ctx.canonical_text ? ` — ${e(ctx.canonical_text)}` : ''}` : 'Not matched'}</dd>
    <dt>Requirements</dt><dd>${e(ctx.requirements.join(' · '))}</dd>
    <dt>Deadline</dt><dd>${e(ctx.deadline_label ?? '—')}</dd>
  </dl>
</section>
<section class="sec"><h3>Proposed final answer</h3>
${
  a
    ? `<p class="meta">v${a.version_number} of ${a.version_count} · ${e(a.method_label)}${a.provider ? ` · ${e(a.provider)}${a.model ? ` / ${e(a.model)}` : ''}` : ''} · last edited ${e(a.created_at.slice(0, 16).replace('T', ' '))}</p>
<p class="meta">${e(counts)}</p>${over}
${a.title ? `<h4>${e(a.title)}</h4>` : ''}<div class="answer">${a.paragraphs.map((p) => `<p>${e(p)}</p>`).join('')}</div>
<p class="mono small">version ${e(a.version_id)} · sha256 ${e(a.sha256)}</p>
<p>${pill(c.approval.label, approvalTone(c.approval.state))} <span class="muted">${e(c.approval.detail)}</span></p>`
    : '<p class="gap">No answer has been written for this question yet.</p>'
}
</section>
<section class="sec"><h3>Evidence</h3>
${evidenceItems}
${ev.missing_ids.length ? `<p class="warn">${ev.missing_ids.length} cited evidence record(s) are missing from the vault.</p>` : ''}
<h4>Unsupported or uncertain claims</h4>${claims}
<h4>Version lineage</h4>${derived}${lineage}
</section>
<section class="sec rec"><h3>Agent recommendation <span class="rec-label">Recommendation — not evidence, not approval</span></h3>
<p><strong>${e(rec.classification_label)}</strong></p>
${rec.classification_reasons.length ? list(rec.classification_reasons, '') : ''}
<h4>Why this answer</h4>${list(rec.why, 'No rationale recorded.')}
<h4>Closeness to the question</h4><p>${e(rec.closeness?.label ?? 'Not computed.')}</p>
<h4>Potential weaknesses</h4>${list(rec.weaknesses, 'None detected.')}
<h4>Missing evidence</h4>${list(rec.missing_evidence, 'None detected.')}
<h4>Conflicts with your facts</h4>${list(rec.fact_conflicts.map((f) => f.message), 'No conflicts detected (heuristic check).')}
<h4>Suggested improvements</h4>${list(rec.improvements, 'None.')}
</section>
${comments}
${decision}
</article>`
}

const CSS = `
:root{--banner:#fffbeb;--btnfg:#fff;--bg:#fff;--fg:#171717;--muted:#737373;--card:#fff;--border:#e5e5e5;--sec:#fafafa;--brand:#0369a1;--rec:#f0f9ff;--rec-b:#7dd3fc;--ok:#15803d;--okb:#f0fdf4;--warn:#b45309;--warnb:#fffbeb;--bad:#dc2626;--badb:#fef2f2;--info:#0284c7;--infob:#f0f9ff;--neu:#525252;--neub:#f5f5f5}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--banner:#3a2208;--btnfg:#0a0a0a;--bg:#0a0a0a;--fg:#fafafa;--muted:#a3a3a3;--card:#171717;--border:#262626;--sec:#1c1c1c;--brand:#38bdf8;--rec:#0c4a6e33;--rec-b:#075985;--ok:#4ade80;--okb:#14532d55;--warn:#fbbf24;--warnb:#78350f55;--bad:#f87171;--badb:#7f1d1d55;--info:#38bdf8;--infob:#0c4a6e55;--neu:#d4d4d4;--neub:#262626}}
:root[data-theme=dark]{--banner:#3a2208;--btnfg:#0a0a0a;--bg:#0a0a0a;--fg:#fafafa;--muted:#a3a3a3;--card:#171717;--border:#262626;--sec:#1c1c1c;--brand:#38bdf8;--rec:#0c4a6e33;--rec-b:#075985;--ok:#4ade80;--okb:#14532d55;--warn:#fbbf24;--warnb:#78350f55;--bad:#f87171;--badb:#7f1d1d55;--info:#38bdf8;--infob:#0c4a6e55;--neu:#d4d4d4;--neub:#262626}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.banner{position:sticky;top:0;z-index:5;background:var(--banner);color:var(--warn);border-bottom:1px solid var(--border);padding:10px 16px;font-weight:600;font-size:14px}
.intro{background:var(--warnb);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:13px;margin:12px 0}
main{max-width:920px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:8px 0 4px}h2{font-size:17px;margin:0 0 8px}h3{font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin:0 0 8px}h4{font-size:14px;margin:12px 0 4px}
.muted{color:var(--muted)}.small{font-size:12px}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;overflow-wrap:anywhere}
.summary{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;margin:16px 0}
.card-head{border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:10px}.qn{color:var(--muted);font-weight:500;margin-right:4px}
.pills{display:flex;flex-wrap:wrap;gap:6px}
.pill{display:inline-block;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600;border:1px solid var(--border)}
.t-success{color:var(--ok);background:var(--okb)}.t-warning{color:var(--warn);background:var(--warnb)}.t-danger{color:var(--bad);background:var(--badb)}.t-info{color:var(--info);background:var(--infob)}.t-neutral{color:var(--neu);background:var(--neub)}
.tag{display:inline-block;font-size:11px;border:1px solid var(--border);border-radius:6px;padding:0 6px;color:var(--muted)}
.sec{background:var(--sec);border:1px solid var(--border);border-radius:10px;padding:12px;margin:10px 0}
.rec{background:var(--rec);border:2px dashed var(--rec-b)}.rec-label{display:inline-block;margin-left:6px;text-transform:none;letter-spacing:0;font-size:12px;color:var(--info);border:1px solid var(--rec-b);border-radius:6px;padding:0 6px}
dl{display:grid;grid-template-columns:150px 1fr;gap:4px 12px;margin:0}dt{color:var(--muted);font-size:13px}dd{margin:0}
@media (max-width:560px){dl{grid-template-columns:1fr}dt{margin-top:6px}main{padding:12px}.card{padding:12px}.banner{font-size:13px;padding:8px 12px}.footer{padding:8px 12px}.footer #count{width:100%;font-size:12px}}
.answer p{margin:0 0 10px}.meta{color:var(--muted);font-size:13px;margin:2px 0}
.warn{color:var(--warn);font-weight:600}.gap{color:var(--bad);font-weight:600}
blockquote{margin:6px 0;padding:6px 10px;border-left:3px solid var(--border);color:var(--fg)}
ul,ol{padding-left:20px;margin:4px 0}.lineage li.current{font-weight:600}
.evidence{list-style:none;padding:0}.evidence>li{border:1px solid var(--border);border-radius:8px;padding:8px;margin:6px 0;background:var(--card)}
a{color:var(--brand)}
.thread{border-left:2px solid var(--border);padding-left:8px;margin:6px 0}.cm.reply{margin-left:14px}.cm p{margin:2px 0 6px}
.decide{border:2px solid var(--brand);border-radius:10px;padding:12px;margin-top:12px}.decide legend{font-weight:600;padding:0 4px}
.choices{display:flex;flex-wrap:wrap;gap:8px 16px;margin:8px 0}.choices label{display:flex;gap:6px;align-items:center;min-height:32px}
label.block{display:block;font-size:13px;color:var(--muted)}
textarea{display:block;width:100%;margin-top:4px;background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:8px;padding:8px;font:inherit}
input:focus-visible,textarea:focus-visible,button:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
.footer{position:sticky;bottom:0;background:var(--card);border-top:1px solid var(--border);padding:12px 16px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}
button{font:inherit;font-weight:600;border-radius:8px;padding:8px 14px;border:1px solid var(--border);background:var(--brand);color:var(--btnfg);cursor:pointer;min-height:40px}
button.secondary{background:var(--sec);color:var(--fg)}
`

// No user content is ever interpolated into the script: ids and timestamps
// travel in escaped data-* attributes.
const SCRIPT = `
${DECISION_BUILDER_JS}
(function(){
  var meta = { instance_id: document.body.getAttribute('data-instance'), review_exported_at: document.body.getAttribute('data-exported'), export_nonce: document.body.getAttribute('data-nonce') || null };
  function collect(){
    var sets = document.querySelectorAll('fieldset.decide');
    var entries = [];
    for (var i = 0; i < sets.length; i++) {
      var f = sets[i];
      var checked = f.querySelector('input[type=radio]:checked');
      var ta = f.querySelector('textarea');
      entries.push({ question_occurrence_id: f.getAttribute('data-occ'), version_id: f.getAttribute('data-version'), version_sha256: f.getAttribute('data-sha'), decision: checked && checked.value ? checked.value : null, comment: ta ? ta.value : null });
    }
    return aquaBuildDecisionFile(meta, entries, new Date().toISOString());
  }
  function update(){ var n = collect().decisions.length; document.getElementById('count').textContent = n + (n === 1 ? ' decision' : ' decisions') + ' in the decision file (not applied to AQUA)'; }
  document.addEventListener('change', update); document.addEventListener('input', update); update();
  document.getElementById('download').addEventListener('click', function(){
    var file = collect();
    var blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'aqua-decisions-' + meta.instance_id + '-' + file.created_at.slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 0);
  });
  document.getElementById('theme').addEventListener('click', function(){
    var r = document.documentElement; var dark = r.getAttribute('data-theme') === 'dark' || (!r.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    r.setAttribute('data-theme', dark ? 'light' : 'dark');
  });
})();
`

export function buildReviewHtml(input: ReviewHtmlInput): string {
  const approved = input.cards.filter((c) => c.approval.state === 'approved').length
  const gaps = input.cards.filter((c) => !c.answer).length
  const title = `AQUA review — ${input.program_name ?? input.instance_id}`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex">
<title>${e(title)}</title>
<style>${CSS}</style>
</head>
<body data-instance="${e(input.instance_id)}" data-exported="${e(input.exported_at)}"${input.export_nonce ? ` data-nonce="${e(input.export_nonce)}"` : ''}>
<div class="banner" role="note">Offline review file — clicking here does NOT update AQUA.</div>
<main>
<p class="intro"><strong>How this file works.</strong> Your choices below only build a decision file. Download it, then import it in AQUA (Review board → Import decisions) and confirm there — nothing changes until you do. This file contains your private answers in plain text; keep it somewhere safe.</p>
<h1>${e(input.program_name ?? 'Application review')}</h1>
<p class="muted">${input.org_name ? `${e(input.org_name)} · ` : ''}instance <span class="mono">${e(input.instance_id)}</span> · exported ${e(input.exported_at.slice(0, 16).replace('T', ' '))} UTC</p>
<div class="summary">${pill(`${input.cards.length} questions`, 'neutral')}${pill(`${approved} approved`, 'success')}${pill(`${gaps} without an answer`, gaps ? 'danger' : 'neutral')}</div>
${input.cards.map((c, i) => cardHtml(c, i)).join('\n')}
</main>
<div class="footer"><span id="count" class="muted" aria-live="polite"></span><span><button type="button" class="secondary" id="theme">Toggle light/dark</button> <button type="button" id="download">Download decision file</button></span></div>
<script>${SCRIPT}</script>
</body>
</html>
`
}
