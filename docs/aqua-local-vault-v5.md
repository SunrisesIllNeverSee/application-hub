---
type: Reference
title: aqua-local vault v5 — workspace, evidence, review, approval
description: Schema v5 of the local-first encrypted vault (M09 W4) — stores, encryption, status precedence, Direct/Adapt/Gap rules, and approval authority.
tags: [documentation, docs, aqua-local, vault, local-first]
timestamp: 2026-10-22
---

# aqua-local vault v5

Vault v5 adds the private application workspace and the data behind the
evidence-based review interface (M09 directive sections 5–7) to the existing
local-first vault (`app/lib/aqua-local/`). The LF-04 authority boundary still
holds. Everything below lives only in the user's IndexedDB vault
(`aqua-local-<uid>`), never reaches Supabase or analytics, and stays inside
`NETWORK-BOUNDARY` (no network imports in `lib/aqua-local/`).

## Migration

- `DB_VERSION` goes from 4 to 5. `MIGRATIONS[4]` is **additive only**. It
  creates the six new stores (with their indexes) when they are missing and
  never touches an existing store or row. Re-running it is a no-op.
- v4 rows stay byte-identical. New optional fields (`evidence_ids` on
  versions, `actor_id` and `via` on approvals) are absent on v4 rows, and
  readers treat absence as "pre-v5".
- `openVaultDb` now closes its connection on `versionchange`, so a tab still
  on v4 cannot block another tab's upgrade.
- Sign-out and account switch close the underlying connections
  (`session.ts` `invalidateVaultIdentity`) as well as revoking handles.

## Stores

Every free-text field is stored as `*_enc`, a serialized AES-GCM-256
`EncryptedBlob` under the vault secret (PBKDF2-SHA256, 210k iterations,
per-field salt and IV, via `crypto.ts` `encryptField`). Plaintext is limited
to ids, enums, hashes, timestamps and identifier-shaped keys.

| Store | Key | Purpose | Encrypted fields |
|---|---|---|---|
| `app_instances` | `instance_id` | Private application instance. `AI-…` = catalog-backed (ids only: `program_id`, `ap_serial`, `cycle_id`, `template_revision_sha`, `question_refs`). `LA-…` = local-only, with the full template (title, org, cycle, deadline, sections, exact question wording, limits, required flags) encrypted. Local questions keep stable `LQ-` ids. `application_id` is the answer-scope key and defaults to `instance_id`. | `local_template_enc`, `source.ref_enc` |
| `facts` | `fact_version_id` | Immutable personal, organization and project fact versions. A revision is a new row with `supersedes`; a delete is a `retracted` tombstone. At most one live fact per (kind, key). `key` must match `^[a-z0-9][a-z0-9_.:-]{0,63}$`. | `value_enc` |
| `evidence` | `evidence_id` | Supporting material (`document`, `url`, `passage`, `note`) with `content_sha256`, `verification` (`unverified`, `user_confirmed`, `source_checked`), `freshness_checked_at`, and `links` to a version, fact or claim. Links and verification are mutable metadata. | `title_enc`, `excerpt_enc`, `url_enc` |
| `reviews` | `review_id` | Append-only review decisions bound to `version_id` and `version_sha256`: `under_review`, `needs_evidence`, `needs_revision`, `rejected`, `superseded`, `evidence_requested`, `help_requested`. There is no `approved` review decision. Each row takes a `seq` from the events ledger. | `rationale_enc` |
| `comments` | `comment_id` | Discussion bound to an exact version and its sha. Has `thread_id` and an optional `parent_comment_id` (a reply must be on the same answer). | `body_enc` |
| `suggestions` | `suggestion_id` | Agent and system recommendations (`reuse`, `draft`, `recommendation`, `evidence_gap`) with optional `classification` (`direct`, `adapt`, `gap`), candidate version and sha, plaintext `reason_codes` (identifiers only), and provider/model. | `explanation_enc`, `weaknesses_enc`, `unsupported_claims_enc` |

Changes to existing records:

- `VersionRecord.evidence_ids?` holds evidence cited when the version was
  written. It is **not** part of the content hash (`sha256` still covers
  only title and body). Evidence linked later goes on the evidence record,
  because versions are immutable.
- `ApprovalRecord.actor_id?` and `via?` (`review_ui`, `decision_file`,
  `legacy`) are written on every new approvals-ledger row.

Ledger events (`review_decision`, `comment_added`, `approval_decision`)
carry ids, hashes, enums and actor ids only. They never carry free text.

## Approval rules

1. `recordHumanApproval({version_id, expected_sha256, actor_id, via})` is the
   only approval API. It re-reads the stored version **inside** the write
   transaction and refuses (`VaultApprovalMismatchError`) when the stored
   sha256 differs from the hash the human was shown. It always writes
   `actor_class: 'human'` and takes no actor-class input. Passing `secret`
   also decrypts and rehashes the plaintext before writing.
   `recordHumanRevocation` writes a hash-bound human `rejected` row the same
   way.
2. Agents recommend through `recordSuggestion`, which writes only to
   `suggestions`. No v5 code path writes an agent-class `approved` row. The
   pre-v5 `approveVersion` primitive is kept for existing callers and tests.
   It is marked deprecated and writes `via: 'legacy'`. The freeze gate still
   ignores its agent rows.
3. An edit is `createChildVersion`: a new immutable version on the same
   answer with `parent_version_id` set. Approvals bind version ids, so
   nothing carries forward. The child starts unapproved, and the parent and
   its decisions stay readable.
4. **Freeze gate** (`status.ts` `approvalGate`, shared by
   `freezeApplicationPacket` and status derivation). All rules fail closed:
   - the latest approvals row for the version decides (ordered by `seq`;
     legacy rows by `(at, id)`);
   - that row must be `human`, must not be `restored_from_backup`, and must
     carry the stored version's sha256;
   - **v5 (stricter only):** a later human, hash-bound, non-restored review
     decision that reopens review (`under_review`, `needs_evidence`,
     `needs_revision`, `rejected`, `superseded`) blocks the approval until a
     fresh human approval. `evidence_requested` and `help_requested` never
     reopen.
   - Agent reviews, comments and suggestions can neither satisfy nor block
     the gate.

   Packet manifest hashing and the signed-packet format are unchanged.

5. **Submitted history (M09b).** OWNER rule 2026-10-22: answers the user
   actually submitted count as approved as of their submission date, once
   the user confirms them. `recordHistoryAttestation(storage, secret,
   {version_id, expected_sha256, effective_at, statement, actor_id})` writes a
   human approval with `via: 'history_attestation'`, `effective_at` (the
   submission date, YYYY-MM-DD or ISO date-time, never in the future) and the
   user's statement encrypted as `attestation_enc`. Before writing it refuses
   a version that is not an imported history record (`history: true`), text
   that does not hash to `expected_sha256` (checked again inside the write
   transaction), and a body with an unfilled placeholder (`history.ts`
   `findPlaceholders`: `[CONFIRM`, `[ASSET NEEDED`, `TODO`, `TBD`, `XXX`,
   `<...>`, `{{...}}`; `VaultPlaceholderError`). The placeholder rule lives in
   this vault write, not only in the UI. The approval gate accepts these rows
   as human approvals bound to the hash only when both `effective_at` and
   `attestation_enc` are present; `recordHumanApproval` cannot write them.
   History versions carry `history: true` and `history_enc` (encrypted
   `HistoryMeta`: program, exact question, submission date and its source,
   source file sha256, importer placeholder scan). The browser screen
   (`/history`, `history-review.ts`) lists them; nothing is preselected.

   **History metadata hash (G18, owner-approved 2026-10-24).** `HistoryMeta`
   carries `meta_sha256`: sha256 (hex) of `canonicalJson` (sorted keys) of
   `{domain: 'aqua-history-meta/v1', version_id, version_sha256, format,
   program, question, submitted_at, date_source, flags (sorted),
   source_sha256, source_file, placeholder {found, markers (sorted)},
   imported_at, importer, parse_confidence, parse_notes}` (`history.ts`
   `computeHistoryMetaHash`; absent optional fields normalize to null / empty,
   `meta_sha256` itself is not hashed). It binds the metadata to the version
   it describes by id and by the version's content sha256, so metadata cannot
   be edited or copied onto another version unnoticed. The companion importer
   writes it (`history.mjs`) and it travels inside `history_enc`. Verified
   by `verifyHistoryMeta` (`repo.ts`): `recordHistoryAttestation` refuses
   with `VaultHistoryMetaMismatchError` before writing anything when a
   recorded hash does not match (or the metadata cannot be decrypted/read);
   `importVault` and the companion's `import-backup` refuse a backup with a
   mismatching or unreadable hashed history record; the review model gives
   each item `meta_hash_status` (`verified`, `legacy`, `mismatch`), disables
   mismatching items with a user-facing reason and shows none of their
   (untrusted) details. **Legacy records** (imported before G18: no
   `meta_sha256`, or no metadata) are `legacy`: still listed and
   confirmable, never reported as verified, and `/history` shows a note that
   their date and source cannot be verified. Limits: the hash is tamper
   evidence, not authentication: someone holding the vault secret can
   re-seal edited metadata with a fresh hash, and removing the hash turns a
   record into `legacy`. Packets do not carry history metadata, so packet
   verification is unchanged.

## Status precedence

`deriveQuestionStatus(input)` is a pure function. The **latest** version
(by `created_at`, then `id`) governs, and the first matching rule wins:

| # | Condition | Status |
|---|---|---|
| 0 | No versions: `evidence_gap` suggestion / any non-gap suggestion / nothing | `needs_evidence` / `suggested` / `gap` |
| 1 | Governing version passes `approvalGate` and appears in a frozen packet for the application | `included_in_packet` |
| 1 | Governing version passes `approvalGate` | `approved` |
| 2 | Latest human decision (approvals rows and reopening reviews, seq-ordered): rejected / superseded / needs_revision / needs_evidence / under_review | same name (`rejected` covers both an approval revocation and a review rejection) |
| 2 | A human approval exists but the gate fails (a later agent row, etc.) | `under_review` |
| 3 | Latest human request: `evidence_requested` / `help_requested` | `needs_evidence` / `under_review` |
| 4 | Latest agent review (advisory): needs_evidence and evidence_requested / needs_revision and rejected / superseded / under_review and help_requested | `needs_evidence` / `needs_revision` / `superseded` / `under_review` |
| 5 | `evidence_gap` suggestion for the version, or `evidence_required` with no linked evidence | `needs_evidence` |
| 6 | Legacy agent approval row, `byok` or `app_provider` method, `derived_from` set, or a suggestion naming the version | `suggested` |
| 7 | Otherwise (a human draft awaiting a decision) | `under_review` |

The output also reports `approved_version_id` (the newest version with a
live approval, which may be older than the governing one; see reason
`newer_version_not_approved`), `freeze_eligible` (which matches `approved`
and `included_in_packet` exactly), `decided_by`, and reason codes.
Restored and hash-mismatched decisions never govern.

## Direct / Adapt / Gap

`classifyReuse(occurrence, candidates, opts)` is pure. It runs on decrypted
plaintext held in memory and never approves anything.

- **Direct** requires all of these: the same question (equal
  `canonical_question_id`, or exact or normalized-equal wording); a source
  that passes `approvalGate`; the body fits the word and character limits;
  and no flags.
- **Adapt** applies when the candidate is related: either the same question
  with at least one failing constraint, or similarity of at least `0.3` (the
  `match.ts` "medium" floor) against the source question or answer. Every
  reason is listed:
  - `unapproved`
  - `over_word_limit` and `over_char_limit` (with `over_by`, `limit`,
    `actual`)
  - `mentions_other_program`: the body names the source's program or org,
    or a caller-supplied known name that is not this occurrence's own
  - `dated_year`: a year 1–5 years before the cycle year (cycle year, then
    deadline year, then `now`)
  - `different_question`: related only by similarity
  - `different_question_qualifier`: same canonical id, but this wording adds
    qualifier words or numbers the source question lacked
- **Gap** applies when nothing is related (reason `no_related_answer`).

Ranking order: Direct first, then same question, then approved, then fewer
reasons, then higher similarity, then newest. The result is
`{classification, candidate_version_id?, candidate_version_sha256?,
reasons[], evidence_ids[], similarity, alternatives[]}`. Persist it with
`recordClassificationSuggestion`. Reason codes are stored in plaintext;
reason messages, which can quote names or years, go only into
`explanation_enc`.

## Backup format v2

`BACKUP_FORMAT_VERSION = 2` includes all six new stores. Their `*_enc`
fields travel as ciphertext inside the encrypted envelope, because the
backup secret is the vault secret. v1 files still restore (the v5 arrays are
simply absent), and files newer than v2 are refused. On restore:

- approvals and signoffs stay marked `restored_from_backup`, as before
  (this includes `history_attestation` approvals; their `effective_at` and
  `attestation_enc` travel as-is and are validated as strings);
- **reviews** and **suggestions** are marked `restored_from_backup`, and
  reviews lose their imported `seq`;
- restored decisions never govern status and never satisfy or block freeze.
  A fresh local human approval is needed.

## Client API (`app/lib/aqua-local-client/review.ts`)

Every call takes the guarded handle from `session.ts` `getStorage()` and the
unlocked secret:

- instances: `createInstance`, `listInstances`, `getInstance`,
  `listInstanceQuestions` (board rows with derived status and
  classification), `getQuestionStatus`
- drafting and editing: `saveInstanceDraft`, `editAsChildVersion`,
  `readReviewCardVersion`
- decisions: `approveAsHuman`, `revokeAsHuman`, `recordReview`,
  `requestEvidenceOrHelp`
- discussion: `addVersionComment`, `listVersionComments`
- evidence: `addEvidenceRecord`, `linkEvidenceRecord`, `setEvidenceStatus`,
  `listVersionEvidence`
- suggestions: `recordAgentSuggestion`, `recordClassificationSuggestion`
- facts: `addFact`, `updateFact`, `removeFact`, `listFactViews`,
  `getFactHistory`
- review card reads (M09 W5, read-only): `readSuggestionView`,
  `listVersionApprovals`, `listVersionReviews`, `readReviewNote`,
  `readVersionProvenance`

The review UI (`app/lib/review-ui/`, `app/components/review/`) uses only
these calls. Its import path writes through `approveAsHuman(via:
'decision_file')`, `recordReview` and `addVersionComment`. Evidence is in
`docs/evidence/m09-review-ui.md`.

Each uid has its own database (`aqua-local-<uid>`). Handles are bound to the
identity epoch, and sign-out or account switch revokes them and closes the
connection.

## Tests

`node lib/aqua-local/run-v5-tests.mjs` (run from `app/`) covers the v4 to
v5 migration with existing data, every new store, each classifier case, the
status table, refusal of hash-mismatched approvals, that agents cannot
approve, that editing an approved answer produces an unapproved child,
comment binding, explicit evidence gaps, freeze compatibility, backup
v1 and v2, and per-uid isolation with sign-out.
`node lib/aqua-local/run-history-tests.mjs` covers the M09b history
attestation: placeholder refusal in the vault write, hash binding,
`effective_at`, the encrypted statement, the gate, and the backup round trip.
