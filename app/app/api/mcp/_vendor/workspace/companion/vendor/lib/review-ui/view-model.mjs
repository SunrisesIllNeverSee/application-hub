// VENDORED from application-hub-mcp-server/src/vendor/companion/vendor/lib/review-ui/view-model.mjs. Do not edit: change the source and run
// `npm run vendor:hosted` in application-hub-mcp-server/ (CI checks these copies).
// VENDORED from aqua-companion/vendor/lib/review-ui/view-model.mjs. Do not edit: change the source and run
// `npm run vendor:companion` in application-hub-mcp-server/ (CI checks these copies).
// VENDORED FILE: DO NOT EDIT. Regenerate with: node aqua-companion/scripts/vendor.mjs
// source: app/lib/review-ui/view-model.ts
// source-sha256: d3f0e8b1b0a3f6082f2b29982980360a08038d2758fc8c7734484c41c816af28
// body-sha256: 1ebc0ed7cfc9545c41130e983f577822446ba11f6e3cd57d8d4fa5efab1b8149
// generator: v2; types stripped (node:module stripTypeScriptTypes, strip mode); .ts imports point at .mjs.
// M09 W5 — evidence-based review interface: PURE view-model derivation.
//
// Everything the review card, the review board and the HTML review export
// render comes from these functions, so the in-app card and the offline file
// can never disagree about what a version's status, hash or evidence is.
// No storage, no crypto, no clock (callers pass `now`). Relative imports only
// so node type-stripping can run the tests (tests/review-ui.test.mjs).
//
// Separation rule (directive §7): the four signals below are NEVER merged
// into one badge —
//   status          derived question status (status.ts deriveQuestionStatus)
//   recommendation  agent/system advice (Direct/Adapt/Gap, suggestions)
//   human review    latest human review decision on the displayed version
//   approval        live, hash-bound human approval of the displayed version

import { approvalGate, REOPENING_REVIEW_DECISIONS } from '../aqua-local/status.mjs'
                                                                                 
import { charCount, wordCount } from '../aqua-local/classify.mjs'
                                                                                 
import { similarityScore } from '../aqua-local/match.mjs'
             
                 
                       
                 
               
                
                
                                
                                                                        
                                                                                 

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

                                                                        

export const STATUS_LABEL                                     = {
  gap: 'Gap — no answer yet',
  suggested: 'Suggested',
  needs_evidence: 'Needs evidence',
  needs_revision: 'Needs revision',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
  superseded: 'Superseded',
  included_in_packet: 'Included in packet',
}

export const STATUS_TONE                                   = {
  gap: 'danger',
  suggested: 'info',
  needs_evidence: 'warning',
  needs_revision: 'warning',
  under_review: 'neutral',
  approved: 'success',
  rejected: 'danger',
  superseded: 'neutral',
  included_in_packet: 'success',
}

export const REVIEW_DECISION_LABEL                                 = {
  under_review: 'Under review',
  needs_evidence: 'Needs evidence',
  needs_revision: 'Needs revision',
  rejected: 'Rejected',
  superseded: 'Superseded',
  evidence_requested: 'Evidence requested',
  help_requested: 'Help requested',
}

export const METHOD_LABEL                                = {
  manual: 'Written by you',
  byok: 'AI draft · your key',
  app_provider: 'AI draft · hosted provider',
  imported: 'Imported',
}

/** M09 hardening (W8): drafts the companion's agent tool wrote are stored as
    method 'byok' with an 'agent: drafted through aqua-companion …' provenance
    note — label them for what they are, not as the user's own AI draft. */
export const AGENT_DRAFT_LABEL = 'Drafted by agent (companion)'
export function isCompanionAgentDraft(v                                              )          {
  const p = typeof v.provenance === 'string' ? v.provenance.trim() : ''
  return v.method === 'byok' && (/^agent:/i.test(p) || /aqua-companion/i.test(p))
}
export function versionMethodLabel(v                                              )         {
  if (isCompanionAgentDraft(v)) return AGENT_DRAFT_LABEL
  return METHOD_LABEL[v.method] ?? v.method
}

/** M09 hardening M2/M3: where a comment came from, when it is not this browser's own. */
export const COMMENT_SOURCE_LABEL = {
  decision_file: 'Imported from decision file',
  companion: 'From companion — review',
}         
export function commentSource(c                                              )                                           {
  if (c.via === 'decision_file') return 'decision_file'
  if (c.via === 'companion' || c.actor_class === 'agent') return 'companion'
  return null
}

export const VERIFICATION_LABEL                                       = {
  unverified: 'Unverified',
  user_confirmed: 'Confirmed by you',
  source_checked: 'Source checked',
}

export const CLASSIFICATION_LABEL = {
  direct: 'Direct — an approved answer already fits',
  adapt: 'Adapt — related answer needs revision',
  gap: 'Gap — no suitable answer in your bank',
}         

export const STATUS_REASON_LABEL                         = {
  no_version: 'No answer has been written for this question.',
  evidence_gap_suggested: 'An evidence gap was flagged for this answer.',
  suggestion_without_version: 'A suggestion exists but no answer version yet.',
  newer_version_not_approved: 'An older version is approved; the newest version is not.',
  human_rejected: 'You rejected this version.',
  approval_not_latest_decision: 'A later decision overrides the approval.',
  human_under_review: 'You marked this version as under review.',
  human_needs_evidence: 'You asked for evidence on this version.',
  human_needs_revision: 'You asked for a revision of this version.',
  human_superseded: 'You marked this version as superseded.',
  human_evidence_requested: 'You requested supporting evidence.',
  human_help_requested: 'You asked for help or an explanation.',
  agent_needs_evidence: 'An agent review flagged missing evidence (advisory).',
  agent_needs_revision: 'An agent review suggested revision (advisory).',
  agent_under_review: 'An agent review is pending (advisory).',
  agent_superseded: 'An agent marked this as superseded (advisory).',
  agent_evidence_requested: 'An agent requested evidence (advisory).',
  agent_help_requested: 'An agent requested help (advisory).',
  agent_rejected: 'An agent flagged this version (advisory).',
  evidence_required_none_linked: 'Evidence is required and none is linked.',
  agent_recommended: 'An agent recommended this version — not a human approval.',
  provider_generated: 'Drafted by an AI provider — needs your review.',
  reused_from_other_answer: 'Reused from another answer — needs your review.',
  named_by_suggestion: 'Proposed by a suggestion — needs your review.',
  awaiting_human_decision: 'Waiting for your decision.',
}

export function shaPrefix(sha                           , n = 12)         {
  return sha ? sha.slice(0, n) : ''
}

// ---------------------------------------------------------------------------
// Counting / limits
// ---------------------------------------------------------------------------

                             
                    
                    
                           
                           
                      
                      
                     
 

export function checkLimits(body        , wordLimit                           , charLimit                           )             {
  const word_count = wordCount(body)
  const char_count = charCount(body)
  const wl = wordLimit ?? null
  const cl = charLimit ?? null
  const over_word_by = wl != null && word_count > wl ? word_count - wl : 0
  const over_char_by = cl != null && char_count > cl ? char_count - cl : 0
  return { word_count, char_count, word_limit: wl, char_limit: cl, over_word_by, over_char_by, over_limit: over_word_by > 0 || over_char_by > 0 }
}

export function requirementsOf(q   
                    
                            
                            
 )           {
  const out           = [q.required ? 'Required' : 'Optional']
  if (q.word_limit) out.push(`Max ${q.word_limit} words`)
  if (q.char_limit) out.push(`Max ${q.char_limit} characters`)
  if (!q.word_limit && !q.char_limit) out.push('No stated length limit')
  return out
}

/** Paragraphs for readable rendering (blank-line separated; single newlines kept). */
export function paragraphsOf(body        )           {
  return body
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
}

function daysBetween(fromIso        , toIso        )         {
  return Math.floor((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000)
}

export function freshnessLabel(checkedAt               , now        )                                    {
  if (!checkedAt) return { label: 'Never checked', stale: true }
  const d = daysBetween(checkedAt, now)
  if (d <= 0) return { label: 'Checked today', stale: false }
  if (d === 1) return { label: 'Checked yesterday', stale: false }
  return { label: `Checked ${d} days ago`, stale: d > 180 }
}

export function deadlineLabel(deadline                           , now        )                {
  if (!deadline) return null
  const t = Date.parse(deadline)
  if (!Number.isFinite(t)) return deadline
  const d = Math.ceil((t - Date.parse(now)) / 86_400_000)
  const date = deadline.slice(0, 10)
  if (d < 0) return `${date} (passed)`
  if (d === 0) return `${date} (today)`
  return `${date} (${d} day${d === 1 ? '' : 's'} left)`
}

// ---------------------------------------------------------------------------
// Fact conflicts (heuristic, local, advisory)
// ---------------------------------------------------------------------------

                               
                  
                    
                                              
                  
                 
 

const KEY_NOISE = new Set(['org', 'organization', 'personal', 'project', 'company', 'my', 'the', 'of', 'in', 'count', 'num', 'number', 'total'])

function keyTerms(key        )           {
  return key
    .toLowerCase()
    .split(/[._:-]+/)
    .filter((t) => t.length >= 3 && !KEY_NOISE.has(t))
}

function sentencesOf(body        )           {
  return body
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function escapeRegExp(t        )         {
  return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Plain numbers in a sentence; percentages are rates, not counts — skipped. */
function numbersIn(s        )           {
  return [...s.matchAll(/\d[\d,]*(?:\.\d+)?(?!\s*%|[\d.,])/g)].map((m) => m[0].replace(/,/g, ''))
}

/**
 * Compare the answer against the user's recorded facts. A fact `key` like
 * `org.employees` contributes the term "employees"; a sentence mentioning a
 * term but stating a different number (or not stating the recorded value)
 * is reported. Advisory only — shown under "Agent recommendation".
 */
export function detectFactConflicts(body        , facts            )                 {
  const out                 = []
  const sentences = sentencesOf(body)
  for (const f of facts) {
    if (f.retracted || !f.value) continue
    const value = f.value.trim()
    if (!value || value.length > 80) continue
    const terms = keyTerms(f.key)
    if (terms.length === 0) continue
    const valueNorm = value.toLowerCase()
    const valueNum = /^\d[\d,]*(?:\.\d+)?$/.test(value) ? value.replace(/,/g, '') : null
    for (const s of sentences) {
      const lower = s.toLowerCase()
      const term = terms.find((t) => new RegExp('\\b' + escapeRegExp(t), 'i').test(lower))
      if (!term) continue
      if (lower.includes(valueNorm)) continue
      if (valueNum) {
        const isYear = (n        ) => /^(19|20)\d\d$/.test(n)
        const nums = [...new Set(numbersIn(s))].filter((n) => isYear(valueNum) || !isYear(n))
        if (nums.length > 0 && !nums.includes(valueNum)) {
          out.push({
            fact_key: f.key,
            fact_value: value,
            kind: 'number_mismatch',
            sentence: s,
            message: `Mentions "${term}" with ${nums.join(', ')}, but your fact ${f.key} = ${value}.`,
          })
          break
        }
      } else {
        out.push({
          fact_key: f.key,
          fact_value: value,
          kind: 'value_not_stated',
          sentence: s,
          message: `Mentions "${term}" but not your recorded value for ${f.key} ("${value}").`,
        })
        break
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Card view model
// ---------------------------------------------------------------------------

                                    
                                
                                      
                                                                   
                     
                                                            
                                
                           
                           
                   
                            
 

                            
                     
                             
                         
                         
                             
                                           
                           
                             
                         
                                                 
                                              
                                                                                            
                                                                       
                                                   
                                                                      
                    
                      
                          
                                         
                                 
                        
                  
          
                          
                                 
                               
                         
                   
                        
                                                                
                                            
                                                                               
                                         
             
 

                             
                                                                                                    
               
                
                                                                         
                                 
                                        
                   
                    
 

                                   
            
                
                
                    
                    
                       
                      
                                  
                              
                                        
                       
                   
                    
                                              
                 
                       
              
                      
                     
                         
                       
    
 

                                 
                     
              
               
                        
                    
                                    
                            
                         
                
                     
                            
 

                            
                    
                   
                                  
              
                     
            
                    
                               
                  
                             
                                                                                                       
                                                  
                             
 

                               
                     
                                
            
                               
                           
                                    
                                        
                                 
                          
                             
                             
                           
                                 
                             
   
                  
                      
                  
                      
                          
                         
                 
                
                        
                      
                         
                        
                           
                        
                      
                                    
   
                                                                                                               
                      
                                                                                                          
                                                                                            
             
                           
                         
                
                                                                            
                               
                                                    
   
                   
                                                     
                                
                                    
                                                                
                 
                                                      
                        
                              
                                  
                          
                                                                                                                                
   
                                                                                           
 

function sortVersions(vs                 )                  {
  return [...vs].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
}

function seqOrder(a                              , b                              )         {
  if (a.seq != null && b.seq != null) return a.seq - b.seq
  if (a.seq != null) return 1
  if (b.seq != null) return -1
  return a.at.localeCompare(b.at)
}

function reasonText(r             )         {
  return r.message
}

function improvementFor(r             )                {
  switch (r.code) {
    case 'over_word_limit':
      return `Trim about ${r.over_by} word${r.over_by === 1 ? '' : 's'} to fit the ${r.limit}-word limit.`
    case 'over_char_limit':
      return `Cut about ${r.over_by} character${r.over_by === 1 ? '' : 's'} to fit the ${r.limit}-character limit.`
    case 'mentions_other_program':
      return `Remove or replace references to ${(r.names ?? []).join(', ') || 'another program'}.`
    case 'dated_year':
      return `Update dated year references (${(r.years ?? []).join(', ')}).`
    case 'different_question_qualifier':
      return `Address the question's extra qualifiers: ${(r.qualifiers ?? []).join(', ')}.`
    case 'different_question':
      return 'Re-check that the answer responds to this exact question.'
    default:
      return null
  }
}

export function buildCardViewModel(input           )               {
  const versions = sortVersions(input.versions)
  const numberOf = new Map(versions.map((v, i) => [v.id, i + 1]))
  const governing = versions.at(-1) ?? null
  const notes = input.review_notes ?? {}

  // ---- version history / lineage ------------------------------------------
  const lineage                     = versions.map((v) => {
    const gate = approvalGate(v, input.approvals, input.reviews)
    const decisions                                = [
      ...input.approvals
        .filter((a) => a.version_id === v.id)
        .map((a) => ({
          row: a                                ,
          d: {
            kind: (a.decision === 'approved' ? 'approval' : 'revocation')                             ,
            label:
              a.decision === 'approved'
                ? a.actor_class === 'human'
                  ? 'Approved by human'
                  : 'Agent approval row (advisory, never counts)'
                : a.actor_class === 'human'
                  ? 'Approval revoked / rejected by human'
                  : 'Agent rejection (advisory)',
            actor_class: a.actor_class,
            at: a.at,
            via: a.via ?? null,
            restored: a.restored_from_backup === true,
            hash_matches: a.version_sha256 === v.sha256,
            note: null,
          },
        })),
      ...input.reviews
        .filter((r) => r.version_id === v.id)
        .map((r) => ({
          row: r                                ,
          d: {
            kind: 'review'         ,
            label: `${REVIEW_DECISION_LABEL[r.decision]}${r.actor_class === 'agent' ? ' (agent, advisory)' : ''}`,
            actor_class: r.actor_class,
            at: r.at,
            via: null,
            restored: r.restored_from_backup === true,
            hash_matches: r.version_sha256 === v.sha256,
            note: notes[r.review_id] ?? null,
          },
        })),
    ]
      .sort((a, b) => seqOrder(a.row, b.row))
      .map((x) => x.d)
    return {
      id: v.id,
      number: numberOf.get(v.id) ,
      sha256: v.sha256,
      sha_prefix: shaPrefix(v.sha256),
      created_at: v.created_at,
      method: v.method,
      method_label: versionMethodLabel(v),
      parent_version_id: v.parent_version_id,
      parent_number: v.parent_version_id ? numberOf.get(v.parent_version_id) ?? null : null,
      derived_from_version_id: v.derived_from?.version_id ?? null,
      is_governing: governing?.id === v.id,
      approved: gate.approved,
      decisions,
    }
  })

  // ---- approval -------------------------------------------------------------
  let approval            
  if (!governing) {
    approval = { state: 'no_version', label: 'Nothing to approve', detail: 'No answer version exists yet.', bound_sha_prefix: null, approved_version_number: null, at: null, via: null }
  } else {
    const gate = approvalGate(governing, input.approvals, input.reviews)
    const older = [...lineage].reverse().find((l) => !l.is_governing && l.approved) ?? null
    const governingHumanRows = input.approvals
      .filter((a) => a.version_id === governing.id && a.actor_class === 'human')
      .sort(seqOrder)
    const latestHuman = governingHumanRows.at(-1) ?? null
    if (gate.approved && gate.approval) {
      approval = {
        state: 'approved',
        label: `Approved by you — v${numberOf.get(governing.id)}`,
        detail: `Bound to sha256 ${shaPrefix(gate.approval.version_sha256)}… — any edit creates a new version that needs a new approval.`,
        bound_sha_prefix: shaPrefix(gate.approval.version_sha256),
        approved_version_number: numberOf.get(governing.id) ,
        at: gate.approval.at,
        via: gate.approval.via ?? null,
      }
    } else if (latestHuman && latestHuman.decision === 'rejected' && !latestHuman.restored_from_backup) {
      approval = { state: 'revoked', label: 'Not approved — revoked / rejected', detail: 'Your latest approval decision on this version is a rejection.', bound_sha_prefix: null, approved_version_number: null, at: latestHuman.at, via: latestHuman.via ?? null }
    } else if (older) {
      approval = {
        state: 'approved_older',
        label: `Not approved — v${older.number} was approved, v${numberOf.get(governing.id)} is not`,
        detail: `The approval of v${older.number} (sha256 ${older.sha_prefix}…) does not carry over to edited versions.`,
        bound_sha_prefix: null,
        approved_version_number: older.number,
        at: null,
        via: null,
      }
    } else if (governingHumanRows.some((a) => a.restored_from_backup)) {
      approval = { state: 'restored_only', label: 'Not approved — restored decision only', detail: 'A decision restored from a backup never counts. Approve again to bind it on this device.', bound_sha_prefix: null, approved_version_number: null, at: null, via: null }
    } else if (gate.blocked_by_review) {
      approval = { state: 'not_approved', label: 'Not approved — review reopened', detail: 'A later review decision reopened this version; approve again if it is ready.', bound_sha_prefix: null, approved_version_number: null, at: null, via: null }
    } else {
      approval = { state: 'not_approved', label: 'Not approved', detail: 'Only your explicit approval of this exact version counts.', bound_sha_prefix: null, approved_version_number: null, at: null, via: null }
    }
  }

  // ---- human review ---------------------------------------------------------
  const humanReviews = governing
    ? input.reviews
        .filter((r) => r.version_id === governing.id && r.actor_class === 'human' && !r.restored_from_backup && r.version_sha256 === governing.sha256)
        .sort(seqOrder)
    : []
  const lastReview = humanReviews.at(-1) ?? null
  const human_review = lastReview
    ? { decision: lastReview.decision, label: REVIEW_DECISION_LABEL[lastReview.decision], at: lastReview.at, note: notes[lastReview.review_id] ?? null }
    : { decision: null, label: 'No human review decision yet', at: null, note: null }

  // ---- evidence -------------------------------------------------------------
  const items                   = input.evidence.map((e) => {
    const fresh = freshnessLabel(e.freshness_checked_at, input.now)
    return {
      evidence_id: e.evidence_id,
      kind: e.kind,
      title: e.title,
      excerpt: e.excerpt,
      url: e.url,
      verification: e.verification,
      verification_label: VERIFICATION_LABEL[e.verification] ?? e.verification,
      freshness_label: fresh.label,
      stale: fresh.stale,
      captured_at: e.captured_at,
      content_sha_prefix: shaPrefix(e.content_sha256),
    }
  })
  const forGoverning = input.suggestions.filter((s) => !s.candidate_version_id || s.candidate_version_id === governing?.id)
  const uncertain                                               = []
  for (const s of forGoverning) {
    for (const line of (s.unsupported_claims ?? '').split('\n').map((l) => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean)) {
      uncertain.push({ text: line, source: 'agent' })
    }
  }
  for (const r of humanReviews) {
    const note = notes[r.review_id]
    if (r.decision === 'evidence_requested' && note && /^challenged claim:/i.test(note)) {
      uncertain.push({ text: note.replace(/^challenged claim:\s*/i, ''), source: 'challenge' })
    }
  }

  // ---- recommendation -------------------------------------------------------
  const cls = input.classification
  const why           = []
  const weaknesses           = []
  const improvements           = []
  const missing_evidence           = []
  if (governing) {
    if (governing.derived_from) why.push('Started from another answer in your bank (provenance recorded, approval not transferred).')
    if (governing.method === 'byok' || governing.method === 'app_provider') why.push('Drafted by an AI provider at your request.')
    if (governing.method === 'manual' && !governing.derived_from) why.push('Written or edited by you.')
  }
  for (const s of forGoverning) {
    if (s.kind === 'recommendation' || s.kind === 'draft') why.push(s.explanation)
    if (s.weaknesses) weaknesses.push(...s.weaknesses.split('\n').map((l) => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean))
  }
  const self = input.self_check
  if (self) {
    for (const r of self.reasons) {
      if (r.code === 'unapproved' || r.code === 'no_related_answer') continue
      weaknesses.push(reasonText(r))
      const imp = improvementFor(r)
      if (imp) improvements.push(imp)
    }
  }
  let closeness                                              = null
  if (governing && input.governing && input.question.text) {
    const score = similarityScore(input.question.text, input.governing.body)
    closeness = {
      score,
      label: `${Math.round(score * 100)}% term overlap with the question (${score >= 0.55 ? 'high' : score >= 0.3 ? 'medium' : 'low'}). Local word-overlap check, not AI and not a quality score — good answers often use different words.`,
    }
  }
  if (governing && items.length === 0) {
    missing_evidence.push('No evidence linked to this version.')
    improvements.push('Attach a note, link, passage or file excerpt that supports the key claims.')
  }
  const unverified = items.filter((i) => i.verification === 'unverified').length
  if (unverified > 0) missing_evidence.push(`${unverified} linked evidence item${unverified === 1 ? ' is' : 's are'} unverified.`)
  const staleCount = items.filter((i) => i.stale).length
  if (staleCount > 0) missing_evidence.push(`${staleCount} evidence item${staleCount === 1 ? ' has' : 's have'} not been checked recently.`)
  for (const s of forGoverning.filter((x) => x.kind === 'evidence_gap')) missing_evidence.push(s.explanation)
  if (uncertain.length > 0) missing_evidence.push(`${uncertain.length} claim${uncertain.length === 1 ? '' : 's'} flagged as unsupported or challenged.`)
  if ((input.missing_evidence_ids ?? []).length > 0) missing_evidence.push(`${input.missing_evidence_ids .length} cited evidence record(s) are missing from the vault.`)

  const fact_conflicts = input.governing ? detectFactConflicts(input.governing.body, input.facts) : []
  for (const c of fact_conflicts) improvements.push(`Reconcile with your fact ${c.fact_key} (${c.fact_value}).`)

  const limits = input.governing ? checkLimits(input.governing.body, input.question.word_limit, input.question.char_limit) : null

  // ---- comments -------------------------------------------------------------
  const threads = new Map                     ()
  for (const c of [...input.comments].sort((a, b) => a.seq - b.seq)) {
    const n = numberOf.get(c.version_id) ?? null
    const vm            = {
      comment_id: c.comment_id,
      thread_id: c.thread_id,
      parent_comment_id: c.parent_comment_id,
      body: c.body,
      actor_class: c.actor_class,
      at: c.at,
      version_id: c.version_id,
      version_number: n,
      on_label: n ? `on v${n}` : 'on an unknown version',
      on_current_version: c.version_id === governing?.id,
      source: commentSource(c),
      source_label: (() => { const k = commentSource(c); return k ? COMMENT_SOURCE_LABEL[k] : null })(),
    }
    threads.set(c.thread_id, [...(threads.get(c.thread_id) ?? []), vm])
  }

  const statusKind = input.status.status
  return {
    instance_id: input.instance_id,
    question_occurrence_id: input.question.question_occurrence_id,
    context: {
      program_name: input.program_name,
      org_name: input.org_name,
      original_question: input.question.text,
      canonical_question_id: input.question.canonical_question_id,
      canonical_text: input.question.canonical_text ?? null,
      requirements: requirementsOf(input.question),
      word_limit: input.question.word_limit,
      char_limit: input.question.char_limit,
      deadline: input.deadline,
      deadline_label: deadlineLabel(input.deadline, input.now),
      section_id: input.question.section_id ?? null,
    },
    answer:
      governing && input.governing && limits
        ? {
            version_id: governing.id,
            sha256: governing.sha256,
            sha_prefix: shaPrefix(governing.sha256),
            version_number: numberOf.get(governing.id) ,
            version_count: versions.length,
            title: input.governing.title,
            body: input.governing.body,
            paragraphs: paragraphsOf(input.governing.body),
            limits,
            method: governing.method,
            method_label: versionMethodLabel(governing),
            provider: input.provenance?.[governing.id]?.provider ?? null,
            model: input.provenance?.[governing.id]?.model ?? null,
            created_at: governing.created_at,
            parent_version_id: governing.parent_version_id,
          }
        : null,
    status: {
      kind: statusKind,
      label: STATUS_LABEL[statusKind],
      tone: STATUS_TONE[statusKind],
      reasons: input.status.reasons.map((r) => STATUS_REASON_LABEL[r] ?? r),
      decided_by: input.status.decided_by,
    },
    approval,
    human_review,
    recommendation_badge: {
      classification: cls?.classification ?? null,
      label: cls ? `Agent recommendation: ${cls.classification === 'direct' ? 'Direct' : cls.classification === 'adapt' ? 'Adapt' : 'Gap'}` : 'No agent recommendation',
    },
    evidence: {
      items,
      missing_ids: input.missing_evidence_ids ?? [],
      gap: items.length === 0,
      uncertain_claims: uncertain,
      lineage,
      derived_from: input.derived_source ?? null,
    },
    recommendation: {
      classification: cls?.classification ?? null,
      classification_label: cls ? CLASSIFICATION_LABEL[cls.classification] : 'Not classified (question wording unavailable)',
      classification_reasons: cls ? cls.reasons.map(reasonText) : [],
      candidate: cls?.candidate_version_id ? { version_id: cls.candidate_version_id, similarity: cls.similarity } : null,
      why: [...new Set(why)],
      closeness,
      weaknesses: [...new Set(weaknesses)],
      missing_evidence: [...new Set(missing_evidence)],
      fact_conflicts,
      improvements: [...new Set(improvements)],
      agent_notes: forGoverning.map((s) => ({ kind: s.kind, explanation: s.explanation, provider: s.provider ?? null, model: s.model ?? null, created_at: s.created_at })),
    },
    comments: {
      threads: [...threads.entries()].map(([thread_id, comments]) => ({ thread_id, comments })),
      total: input.comments.length,
    },
  }
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

                                                                                         

export const FILTER_LABEL                            = {
  all: 'All',
  attention: 'Needs attention',
  gaps: 'Gaps',
  ready: 'Ready',
  approved: 'Approved',
  in_packet: 'In packet',
}

const ATTENTION                       = ['suggested', 'needs_evidence', 'needs_revision', 'under_review', 'rejected', 'superseded']

                                
                                
               
                     
                   
                           
                           
                        
                                            
                        
                                                       
 

                             
                                
               
                     
                   
                            
                      
            
                                                   
                           
                           
                           
                           
                     
                        
                       
                   
                          
                         
 

export function boardRowVM(row               , counts                                          )             {
  const s = row.status.status
  const over =
    counts != null &&
    ((row.word_limit != null && counts.words > row.word_limit) || (row.char_limit != null && counts.chars > row.char_limit))
  const categories              = ['all']
  if (ATTENTION.includes(s) || (over && (s === 'approved' || s === 'included_in_packet'))) categories.push('attention')
  if (s === 'gap' || (s === 'needs_evidence' && row.versions.length === 0)) categories.push('gaps')
  if (row.status.freeze_eligible && !over) categories.push('ready')
  if (s === 'approved' || s === 'included_in_packet') categories.push('approved')
  if (s === 'included_in_packet') categories.push('in_packet')
  return {
    question_occurrence_id: row.question_occurrence_id,
    order: row.order,
    text: row.text,
    required: row.required,
    status: s,
    status_label: STATUS_LABEL[s],
    tone: STATUS_TONE[s],
    classification: row.classification?.classification ?? null,
    word_count: counts?.words ?? null,
    char_count: counts?.chars ?? null,
    word_limit: row.word_limit,
    char_limit: row.char_limit,
    over_limit: over,
    evidence_count: row.evidence_ids.length,
    version_count: row.versions.length,
    approved: s === 'approved' || s === 'included_in_packet',
    freeze_eligible: row.status.freeze_eligible,
    categories,
  }
}

                                  
               
                  
                   
               
                   
              
                        
                           
                                   
 

export function progressSummary(rows              )                  {
  const counts = { all: 0, attention: 0, gaps: 0, ready: 0, approved: 0, in_packet: 0 }                             
  for (const r of rows) for (const c of r.categories) counts[c]++
  const required = rows.filter((r) => r.required)
  return {
    total: rows.length,
    approved: counts.approved,
    in_packet: counts.in_packet,
    ready: counts.ready,
    attention: counts.attention,
    gaps: counts.gaps,
    required_total: required.length,
    required_approved: required.filter((r) => r.approved).length,
    counts,
  }
}

/** Reopening decisions re-exported for UI copy ("does this reopen review?"). */
export const REOPENING = REOPENING_REVIEW_DECISIONS
