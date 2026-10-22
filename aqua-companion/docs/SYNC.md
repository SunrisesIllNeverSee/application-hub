---
type: Reference
title: aqua-companion bridge and sync semantics
description: How the local AQUA companion workspace exchanges data with the browser vault (M09 directive section 8): authority, projections, edit detection, versions, conflicts, offline, deletion, privacy and account identity.
tags: [documentation, aqua-companion, local-first, sync, vault]
timestamp: 2026-10-22
---

# aqua-companion: bridge and sync semantics

This document answers the bridge questions in M09 directive section 8
("Synchronization"). The short version:

- The **browser vault is authoritative** for private data. The companion
  does not change that contract.
- Data moves between the vault and the workspace **only as the vault's own
  encrypted backup envelope** (`aqua-local-backup`, `BACKUP_FORMAT_VERSION 2`,
  `app/lib/aqua-local/backup.ts`), in both directions, and only when the user
  runs a command.
- There is **no automatic or hosted sync** and **no last-write-wins**,
  anywhere. A difference the companion cannot prove is harmless becomes a
  conflict that waits for an explicit decision.

This is an import/export bridge. It is not bidirectional synchronization, and
nothing in the product should describe it as such.

## 1. Which data is authoritative

| Data | Authority | Where it lives in the workspace |
|---|---|---|
| Answers, versions, approvals, reviews, comments, suggestions, evidence, facts, packets, sign-offs, application instances, vault events | Browser vault (`aqua-local-<uid>` IndexedDB) | Projections (read-only copies) |
| Locally imported applications (`LA-` ids), local drafts, local evidence, local comments | Nobody yet. They are **staging** records until the user exports them and restores the file in the browser. After that the vault is authoritative for them. | Staging records |
| Public catalog data (programs, questions) | The public catalog | `catalog-cache/` (plaintext, refreshable; `snapshots/` holds the `catalog sync` / `import-file` cache) |
| Companion operations log, agent tool-call log | The companion | `audit/*.jsonl` |
| Agent evidence requests and observed-submission notes | Nobody: workspace-only advisory records, never exported | `reviews/suggestions/`, `packets/observations/` |

Every record file carries `authority: "projection" | "staging"` outside the
ciphertext, and the manifest repeats it. The companion cannot approve, sign,
review or submit anything, so it never originates an authoritative decision.

## 2. Which files are projections

A projection is a record that came out of a vault backup. The companion
writes it once, verbatim (the vault's own field values, including any `*_enc`
ciphertext under the vault secret), inside workspace encryption, and never
edits it. Projections are placed by kind:

| Kind | Folder |
|---|---|
| `app_instance` | `applications/active/` or `applications/submitted/` (when a packet for it reached `submitted_external_observed`) |
| intake records (`catalog_cache` keys `intake:*`, private) | `applications/intake/` |
| `answer`, `version`, `provenance` | `answers/history/` |
| `approval` (the human approval ledger: approved and rejected rows) | `answers/approved/` |
| `fact` | `facts/` |
| `evidence` | `evidence/` |
| `review` / `comment` / `suggestion` | `reviews/`, `reviews/comments/`, `reviews/suggestions/` |
| `packet`, `signoff`, `packet_state` | `packets/` |
| `event`, `import` (vault ledger) | `audit/vault-ledger/` |
| public catalog (`program:*`, `question:*` keys) | `catalog-cache/programs/`, `catalog-cache/questions/` (plaintext) |
| any other catalog key | `catalog-cache/unclassified/` (encrypted; unknown shapes are treated as private) |

Staging records go to `applications/queued/` (local applications, with the
original source document in `applications/queued/sources/`),
`answers/drafts/`, `evidence/` and `reviews/comments/`.

Identity is the id **inside** each file (`"<kind>:<vault key>"`, for example
`version:4f0c…`) plus the manifest index. File names are derived from ids for
convenience only. Renaming a file does not change what it is, and `verify`
reports any file the index does not know.

## 3. How edits are detected

- The manifest (`workspace.json`) records, per record: its relative path, the
  SHA-256 of the file bytes, and a **content MAC** (HMAC-SHA256 under a key
  derived from the workspace passphrase) of the record's canonical JSON. A
  keyed MAC is used instead of a plain hash so that low-entropy private
  content cannot be confirmed by guessing.
- Each record file also carries a self-checksum (`sha256` over its own
  header and ciphertext), and its ciphertext is bound to the workspace id,
  record id and kind as AES-GCM additional data, so an encrypted body cannot
  be moved into another record's file.
- Every read that starts from the index (export, draft, comment, resolve,
  show, plaintext export) checks the file's id, kind and content MAC against
  the manifest and refuses a mismatch, so an older or swapped file is never
  exported as if it were current.
- Two companion runs cannot silently overwrite each other's index: a run
  refuses to save the manifest if another run saved it in the meantime (no
  last-write-wins on the index either). Files the refused run already wrote
  are adopted by `recover`.
- The manifest itself carries an HMAC (`manifest_mac`). A manifest edited
  outside the companion is refused by every command except `verify` and
  `recover`.
- `verify` checks all of it: file present, bytes unchanged, id/kind/workspace
  match, decryptable with the passphrase, content MAC matches, no orphans, no
  symlinks, audit hash chain intact.
- Incoming vault records are compared by content MAC against the workspace
  copy with the same id.

## 4. How versions are reconciled

Vault versions are immutable and approvals bind a version id plus its
sha256. The companion follows the same rule:

- A local edit is always a **new version with a new id**
  (`draft --parent <version-id>` sets `parent_version_id`). It starts
  unapproved. Nothing carries an approval forward.
- Re-importing a vault backup adds versions the workspace has not seen and
  leaves the rest alone. Version ids never get reused for different content.
- When a staged record comes back inside a later vault backup with identical
  content, it is marked `in_vault` (the vault now holds it) and is not
  exported again.

## 5. How conflicts are handled

A conflict is any record whose id is already in the workspace with
**different content**. On import the companion:

1. leaves the workspace copy untouched;
2. writes the incoming copy, encrypted, into a conflict record under
   `reviews/conflicts/`;
3. appends a line to `audit/conflicts.jsonl` (ids, kind, MAC prefixes; no
   content).

`aqua-companion conflicts` lists them. `aqua-companion resolve <id> --keep
vault|workspace|both` is the only way to close one:

- `vault`: the vault copy becomes the record; the workspace copy moves to
  `reviews/conflicts/archived/`.
- `workspace`: nothing changes; that exact vault content will not be raised
  again (a later, different vault version will).
- `both`: the vault copy becomes the record. A staged draft, application,
  evidence item or comment is kept as a separate staged record with a **new
  id** (`variant_of` the original) so it can be exported. Decisions
  (approvals, sign-offs, reviews, suggestions, packets) are never duplicated
  as live records: their workspace copy is archived instead.

Every resolution is recorded in both audit logs. Approvals and signed
packets are never merged or rewritten without such a decision. The single
exception to "difference = conflict" is the **public** catalog cache: a
changed public entry is refreshed, and the previous copy stays in the index
as an archived record.

## 6. What happens offline

The companion's only network code is `src/net.mjs`: read-only GET requests
for PUBLIC catalog data (`catalog sync`, the agent's `refresh_catalog`) to
one configured origin, with the public publishable key, sending no
workspace data. A test scans `src/`, `bin/` and `vendor/` and allows network
calls only there. Everything else works fully offline, and without a
configured endpoint the catalog cache is simply what you imported. The browser vault also works offline.
Nothing waits for connectivity, and nothing is queued for upload. "Offline"
only means the two sides drift apart until the user carries a backup file
across, and the conflict rules above apply when they do.

Using the vault on another device does not change any of this: each
device's vault is separate, and the companion never claims that private data
has been synchronized anywhere.

## 7. How deletions and supersession are recorded

Nothing is silently deleted, on either side.

- Vault records do not get deleted by vault exports. If a projection is
  **absent** from a later backup, the companion keeps it and flags it
  (`absent_from_last_import`). `status` reports the count.
- Supersession in the vault is expressed by the vault itself (child
  versions, `superseded` review decisions, fact `supersedes` rows and
  `retracted` tombstones) and arrives as new immutable records.
- A staged local record is withdrawn with `retract <id>`: a tombstone in the
  manifest, the file kept, and the record excluded from later exports.
  Retracting something already restored in the browser does not remove it
  from the vault; the companion says so.
- `recover` moves damaged files to `audit/quarantine/<time>/` and keeps
  index entries for missing files as `missing`. A later vault import
  re-creates a missing projection.
- Conflict resolution archives instead of deleting.

## 8. How privacy and account identity are preserved

**Privacy**

- Private records are encrypted at rest with AES-GCM-256 under a key from
  PBKDF2-SHA256 (210,000 iterations) over the workspace passphrase. These are
  the same primitives and the same `EncryptedBlob` layout as
  `app/lib/aqua-local/crypto.ts`; tests decrypt companion blobs with the app
  and app blobs with the companion.
- Plaintext on disk is limited to: the manifest (ids, kinds, paths,
  checksums, MACs; no answer text), public catalog entries, `README.txt`,
  and the audit logs (operation names, ids, counts, MAC prefixes).
- The passphrase and the vault secret are read from the environment or a
  no-echo prompt and never written anywhere. A test scans every workspace
  byte (and every export) for them.
- Plaintext copies exist only after `export --plaintext`, which prints an
  exposure warning and needs an explicit confirmation. `show --reveal`
  prints an exposure notice.
- Imported documents and vault text are data. The companion never executes
  or interprets them, so imported text cannot act as instructions to the
  companion.

**Account identity**

- Each vault belongs to one account (`aqua-local-<uid>`). The v2 envelope
  itself does not contain the uid, so the first `import-backup` requires
  `--account <account id or sign-in email>`. The workspace stores a SHA-256
  fingerprint of that identifier, **encrypted** under the workspace key
  (`account_binding`).
- Every later import must name an account whose fingerprint matches. A
  different account, or no account on a bound workspace, is refused (exit
  5) unless the user passes `--allow-account-mismatch`. One workspace per
  account is the supported setup.
- Envelopes written by the companion carry the fingerprint in an optional
  outer `account_fp` field for information only. Outer envelope fields are
  not authenticated, so the companion never bases an account decision on
  them; the `--account` the user names decides. A future app change could
  put an account fingerprint inside the encrypted payload, which would be
  authenticated.
- The companion refuses to import its own export files: those must go
  through the browser first, so the vault (not a file) decides what exists.
  The marker is `companion_export` inside the encrypted payload
  (`backup.ts` ignores unknown payload fields), so stripping outer fields
  does not get around it.

## 9. Moving data into the browser

`export-backup <file>` builds an `aqua-local-backup` v2 envelope, encrypted
with the **vault secret**, containing only staged records: `answers`,
`versions`, `app_instances` (local `LA-` applications with their template
encrypted in `local_template_enc`), `evidence` (verification always
`unverified`) and `comments` (`actor_class: human`, `actor_id: local-user`,
no ledger `seq`). Approvals, sign-offs, reviews, suggestions, events and
packets are always empty arrays. The payload also carries
`companion_export` (producer, version, workspace id), which the browser
ignores.

The user restores the file in the browser (Restore backup panel). The vault
then applies its own rules: duplicates are skipped by id, imported version
hashes are re-checked, and anything that carries a decision stays
`restored_from_backup` and never satisfies the freeze gate. Every draft from
the companion needs a fresh human approval in the browser review UI.

**Submitted history (M09b).** `import-history` / `import_history` stage
answered applications as ordinary staged answers and versions with
`history: true`; the version's `history_meta` (program, exact question,
submission date and where it came from, source sha256, placeholder scan)
travels encrypted as `history_enc`. After Restore the user confirms them on
the browser's Confirm submitted history screen, which writes
`history_attestation` approvals (see `docs/aqua-local-vault-v5.md`).

**Approvals coming back.** The user exports a fresh browser backup into the
workspace `inbox/`; `sync_from_vault_export` (or `import-backup`) imports it
with every rule in this document: staged records whose content matches are
promoted to `in_vault`, approvals arrive as read-only projections bound to
their version hashes, and `read_review_status` reports them with
`approvals_as_of`. The companion still never writes an approval itself.

## 10. Known limits

- Path checks happen before each open. A local process racing the companion
  could swap a folder for a symlink between the check and the open; the
  final path component is opened with exclusive-create / no-follow flags,
  but intermediate folders are not. The threat model is a single user's own
  folder, not a hostile local account.
- An import writes its record files first and the manifest last. If it is
  interrupted, the new files are orphans until `recover` adopts them; no
  existing record is touched.
- Vault `*_enc` fields use one PBKDF2 derivation each (the vault's format),
  so revealing many vault-encrypted fields takes a moment. Fields the
  companion encrypts for an export share one derived key per export run,
  each with its own IV; the app decrypts them field by field as usual.

## 11. What is deliberately not here

- No automatic sync, background watcher, hosted relay or cloud storage.
- No last-write-wins, no silent merge, no deletion.
- No approval, sign-off, packet freeze or submission from the companion.
- No hosted-answer writes, and no network access except the public catalog
  read above.
- No privileged agent operations: the agent interface (`aqua-companion mcp`,
  [AGENT.md](AGENT.md)) can stage drafts and evidence but never approve,
  sign, freeze, export or submit.
