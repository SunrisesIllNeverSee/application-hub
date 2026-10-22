// VENDORED FILE: DO NOT EDIT. Regenerate with: node aqua-companion/scripts/vendor.mjs
// source: app/lib/aqua-local/placeholders.ts
// source-sha256: 6199d25c93634791b4bf17a6d11846ced6b940ca53c64a1f197c7565806f112a
// body-sha256: 0947762914555bd2f5b52e1020a6653653e4873ded38ff8548f3902af2bb579e
// generator: v2; types stripped (node:module stripTypeScriptTypes, strip mode); .ts imports point at .mjs.
// NETWORK-BOUNDARY: no fetch/import of remote APIs allowed in aqua-local
//
// Unfilled-placeholder detection. PURE, dependency-free, and the ONE
// implementation every surface uses: the vault writes (repo.ts
// recordHistoryAttestation and the normal approval path), the /history
// confirm screen (history-review.ts) and the companion importer (vendored
// through history.ts). A body that trips any rule can never be approved.
//
// Text is canonicalized before matching so look-alike spellings cannot slip
// past: NFKC (fullwidth ［CONFIRM］ → [CONFIRM]), format/control characters and
// combining marks removed (TO​DO → TODO), common Cyrillic/Greek
// confusables folded to Latin (Cyrillic ТODO → TODO) and whitespace collapsed
// (so a {{…}} slot or [ASSET  NEEDED] split across lines still matches).

                                  
            
               
            
 

/** Latin look-alikes for the Cyrillic / Greek letters that render identically. */
const CONFUSABLES                         = {
  // Cyrillic
  'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X', 'У': 'Y',
  'Ѕ': 'S', 'І': 'I', 'Ј': 'J', 'Ԁ': 'D', 'Ԛ': 'Q', 'Ԝ': 'W',
  'а': 'a', 'с': 'c', 'е': 'e', 'о': 'o', 'р': 'p', 'х': 'x', 'у': 'y', 'ѕ': 's', 'і': 'i', 'ј': 'j', 'ԁ': 'd', 'һ': 'h',
  'ԛ': 'q', 'ԝ': 'w', 'ӏ': 'l',
  // Greek
  'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M', 'Ν': 'N', 'Ο': 'O', 'Ρ': 'P', 'Τ': 'T',
  'Υ': 'Y', 'Χ': 'X', 'ο': 'o', 'ν': 'v', 'ρ': 'p', 'ι': 'i', 'κ': 'k', 'χ': 'x', 'υ': 'u',
}
const CONFUSABLE_RE = new RegExp(`[${Object.keys(CONFUSABLES).join('')}]`, 'gu')

/** Invisible or filler characters with no visible glyph (beyond \p{Cf}). */
const INVISIBLE_RE = /[\p{Cf}\p{M}\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009Fᅟᅠㅤﾠ]/gu

/**
 * Canonical form used for placeholder matching only (never stored or shown).
 * NFKC → NFD → drop marks/format/control → fold confusables → collapse
 * whitespace.
 */
export function normalizeForPlaceholderScan(text        )         {
  return String(text ?? '')
    .normalize('NFKC')
    .normalize('NFD')
    .replace(INVISIBLE_RE, '')
    .replace(CONFUSABLE_RE, (c) => CONFUSABLES[c] ?? c)
    .replace(/\s+/g, ' ')
}

/**
 * Unfilled-placeholder patterns, matched against the canonical form. Kept
 * deliberately narrow so ordinary prose does not trip them:
 * - bracket markers: the M09 drafting conventions ([CONFIRM…], [ASSET
 *   NEEDED…]), generic fill-ins ([insert …], [your …], [company name] …) and
 *   ALL-CAPS slot names of 4+ letters ([NAME], [COMPANY NAME]);
 * - TODO / TBD / XXX as whole words, plus UPPERCASE spaced or dotted forms
 *   (TO DO, T.B.D., X X X) — lower-case "to do" in prose is not one;
 * - angle placeholders start with a letter or an ellipsis right after `<`
 *   (`<company name>`, `<…>`; `a < b` is not one);
 * - `{{…}}` template slots, "lorem ipsum" filler, `___` blanks, and a
 *   free-standing `??` (not "really??").
 */
export const PLACEHOLDER_RULES                             = [
  { id: 'confirm', label: '[CONFIRM…] marker', re: /\[ ?CONFIRM/i },
  { id: 'asset_needed', label: '[ASSET NEEDED…] marker', re: /\[ ?ASSET ?NEEDED/i },
  { id: 'todo', label: 'TODO', re: /\b[Tt][Oo][Dd][Oo]\b|\bT[ ._-]?O[ ._-]?D[ ._-]?O\b/ },
  { id: 'tbd', label: 'TBD', re: /\b[Tt][Bb][Dd]\b|\bT[ ._-]?B[ ._-]?D\b|\b[Tt]\. ?[Bb]\. ?[Dd]\b/ },
  { id: 'xxx', label: 'XXX', re: /\b[Xx]{3,}\b|\bX(?:[ ._-]X){2,}\b/ },
  { id: 'bracket', label: '[…] fill-in marker', re: /\[ ?(?:insert|your|add|enter|fill(?: in)?|placeholder|replace|tbc|tk|name|company(?: name)?|founder(?: name)?|date|number|amount|link|url|x{2,})\b[^\]\n]{0,80}\](?!\()/i },
  { id: 'caps_slot', label: '[ALL CAPS] slot', re: /\[ ?(?!CONFIRM|ASSET ?NEEDED|TODO\b)(?:[A-Z][ _\/&'-]?){4,40}\](?!\()/ },
  { id: 'angle', label: '<…> placeholder', re: /<(?:…|\.{2,}|[A-Za-z_][^<>\n]{0,80})>/ },
  { id: 'mustache', label: '{{…}} template slot', re: /\{\{[^{}]{0,200}\}\}/ },
  { id: 'lorem', label: 'lorem ipsum filler', re: /\blorem ipsum\b/i },
  { id: 'blank', label: '___ blank', re: /_{3,}/ },
  { id: 'question_marks', label: '?? marker', re: /(?:^|[\s([{$#:=/])\?{2,}(?=$|[\s)\]}.,;:%!/])/ },
]

/** Ids of every placeholder rule the text trips (empty = clean). */
export function findPlaceholders(text        )           {
  const s = normalizeForPlaceholderScan(text)
  return PLACEHOLDER_RULES.filter((r) => r.re.test(s)).map((r) => r.id)
}

/** True when the text carries any unfilled placeholder. */
export function hasPlaceholders(text        )          {
  return findPlaceholders(text).length > 0
}

/** Human-readable reason for a list of placeholder ids. */
export function describePlaceholders(ids                   )         {
  const labels = ids.map((id) => PLACEHOLDER_RULES.find((r) => r.id === id)?.label ?? id)
  return labels.length ? `Contains an unfilled placeholder (${labels.join(', ')}). Fill it in before confirming.` : ''
}
