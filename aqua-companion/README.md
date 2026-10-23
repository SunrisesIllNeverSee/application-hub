# AQUA companion

`aqua-companion` keeps your AQUA work in an encrypted folder on your own
computer. You can stage applications, drafts, evidence and comments there,
keep an encrypted copy of your browser vault, and move work back into the
browser when you are ready.

You do not need it to use AQUA. The browser app works on its own, and your
**browser vault stays the place where answers are approved, signed and
frozen**. The companion never approves, signs or submits anything and
never syncs on its own. Its only network access is read-only and public:
the catalog configuration from `https://aquaidp.xyz/.well-known/aqua-catalog.json`
and approved catalog rows (`catalog sync`, `refresh_catalog`, `doctor`). It
sends nothing from your workspace.

## What you need

- Node.js 22 or newer (`node --version`).
- Nothing else: the companion has no dependencies.

## Install

`aqua-companion` is not published on npm by itself (owner gate GB2); `aqua-mcp-server`
on npm includes it. The site also serves a versioned `npm pack` tarball with its sha256 (the fallback install):

```sh
curl -fsSL https://aquaidp.xyz/companion/latest.json          # { version, url, sha256 }
curl -fsSLO https://aquaidp.xyz/companion/aqua-companion-0.2.3.tgz
shasum -a 256 aqua-companion-0.2.3.tgz                         # compare with latest.json / .tgz.sha256
npx --yes ./aqua-companion-0.2.3.tgz --help                    # or: npx --yes https://aquaidp.xyz/companion/aqua-companion-0.2.3.tgz --help
# from another folder: npx --yes --package /full/path/aqua-companion-0.2.3.tgz aqua-companion --help (a bare absolute .tgz path fails)
npm install -g ./aqua-companion-0.2.3.tgz                      # optional: puts `aqua-companion` on your PATH
```

From a repository checkout you can also run `node aqua-companion/bin/aqua-companion.mjs --help`.
`aqua-mcp-server` 2.0 (built on this companion) is published: `npx -y aqua-mcp-server`
includes this companion and is the primary install; the tarball above is the fallback.
Versions below 2.0 are legacy.

## Quick start

```sh
# 1. Create a workspace. You choose the folder; the companion creates AQUA/ inside it.
aqua-companion init --path ~/Documents
aqua-companion doctor                       # configuration, catalog connectivity, workspace, Keychain

# 2. Optional: load applications you already submitted, as dated history.
aqua-companion import-history ~/Documents/submitted --workspace ~/Documents/AQUA

# 3. In the AQUA web app, open AQUA Local and download an encrypted backup.
#    Then bring it in (the backup carries your account fingerprint; older ones need --account):
aqua-companion import-backup ~/Downloads/aqua-local-backup-2026-10-22.json

# 4. Look around.
aqua-companion status
aqua-companion list version
aqua-companion show <id>            # metadata only
aqua-companion show <id> --reveal   # decrypts to your terminal

# 5. Stage local work.
aqua-companion import-application form.md
aqua-companion draft --application LA-... --question LQ-... --body-file answer.md --title "Project summary"
aqua-companion draft --parent <version-id> --body-file revised.md     # a new version of an existing answer
aqua-companion add-evidence --title "Pilot results" --kind passage --excerpt-file quote.txt --link version:<id>
aqua-companion comment --version <id> --body-file note.txt

# 6. Send staged work to the browser.
aqua-companion export-backup ~/Desktop/for-browser.json --workspace ~/Documents/AQUA
#    In the web app: AQUA Local > Restore backup, choose the file, then review and approve there
#    (/review/<application>), and confirm submitted history at /history.
# 7. Bring the approvals back: export a fresh browser backup, then
aqua-companion import-backup ~/Downloads/aqua-local-backup-after-review.json
```

## Submitted history

Answers you actually submitted count as approved **as of their submission
date**, once you confirm them in the browser. `import-history <folder>` reads
answered applications (`.md`, `.txt`, `.docx`, `.html`, `.json`, `.csv`) and
stages, per answered question, the exact question wording, your answer, the
program, the file's sha256 and the submission date. The date comes from the
file's frontmatter (`submitted: 2025-03-01`), its metadata (a `Submitted:`
line, an HTML `<meta name="submitted">`, a JSON `submitted_at`, a Word custom
property), the file name (`2025-03-01-accelerator.md`), or `--date
YYYY-MM-DD`. When none is found the record is flagged *date unknown*; the
companion never guesses. Answers that still contain `[CONFIRM`, `[ASSET
NEEDED`, `TODO`, `TBD`, `XXX`, `<...>` or `{{...}}` are flagged too, and the
browser vault refuses to confirm them until you fix the text.

After `export-backup` and Restore, open **Confirm submitted history**
(`/history`). Nothing is preselected; you tick the answers you submitted and
attest it, and the vault records a human approval bound to the exact text,
dated to the submission.

Every command that writes something first prints what it will do and asks
you to type `yes`. In scripts, add `--yes` after reading the plan, or
`--dry-run` to see the plan only. The workspace is found from `--workspace
<folder>`, the `AQUA_WORKSPACE` variable, or the folder you are in.

## Passphrases

- **Workspace passphrase**: chosen at `init`. It encrypts everything private
  in the folder. It is never saved. If you lose it, the encrypted files
  cannot be opened by anyone, including you.
- **Vault secret**: the secret you unlock the AQUA browser vault with. The
  companion needs it to read browser backups and to write files the browser
  can restore. If it is the same as your workspace passphrase, just press
  Enter when asked.

You are prompted without echo. For scripts, use the environment variables
`AQUA_PASSPHRASE`, `AQUA_VAULT_SECRET`, and `AQUA_NEW_PASSPHRASE` (for
`rekey`). The companion never writes them to disk or to its logs.

Prefer the prompt (or `mcp --keychain` on macOS) over these variables.
An environment variable is readable by every process that inherits it: a
CI runner and its logs or debug dumps, a coding agent and every tool or
subprocess it starts, and anything running as you that can inspect process
environments. Anyone who obtains the passphrase together with a copy of the
workspace folder can read all of it. When a passphrase comes from the
environment while `CI`, `GITHUB_ACTIONS`, `CLAUDECODE` (or another
agent marker) is set, the companion prints a warning to stderr; it never
prints the secret.

## What is stored where

```text
AQUA/
├── workspace.json          manifest: ids, kinds, checksums, settings (no answer text)
├── README.txt              what this folder is
├── applications/
│   ├── active/             your applications from the browser vault
│   ├── submitted/          applications you recorded as submitted
│   ├── queued/             applications you imported locally (not yet in the browser)
│   │   └── sources/        the original files you imported, encrypted
│   └── intake/             private intake records from the browser
├── catalog-cache/
│   ├── programs/           public program data (plain JSON)
│   ├── questions/          public question data (plain JSON)
│   ├── snapshots/          the public catalog cache from catalog sync / import-file (plain JSON)
│   └── unclassified/       other cached catalog data (encrypted)
├── answers/
│   ├── drafts/             drafts you wrote locally
│   ├── approved/           the browser's approval decisions (read-only copies)
│   └── history/            answers and versions from the browser
├── facts/                  personal / organization / project facts from the browser
├── evidence/               supporting material (from the browser or added locally)
├── reviews/                review decisions, comments, suggestions; conflicts/ for import conflicts
├── packets/                frozen packets and sign-offs from the browser (read-only copies)
├── exports/                the only place inside the folder where exports may go
├── inbox/                  files you hand to an AI agent (the only files it can read)
└── audit/                  operation log (append-only), conflict log, agent log, quarantine
```

Everything private is encrypted (AES-GCM-256, key from PBKDF2-SHA256 with
210,000 iterations). Plain text is limited to the manifest, the public
catalog cache, `README.txt`, and the audit logs, which hold only operation
names, ids, counts and checksums.

Do not rename or edit files by hand. Each file's identity is stored inside
it and in `workspace.json`; `verify` will report edited or unknown files.

## Privacy

- Nothing leaves your computer unless you copy a file somewhere yourself,
  with two exceptions you control: `catalog sync` reads public catalog data
  (it sends no workspace data), and an AI agent you connect with
  `aqua-companion mcp` sees what its tools return (see below).
- The companion never writes plain-text answers on its own. `export
  --plaintext <id|all> --out <folder>` does, after a clear warning and a
  confirmation (type `expose`). Anything that can read that folder (cloud
  sync, backups, search, other apps, AI agents) can read those files.
- `show --reveal` prints decrypted content to your terminal with a warning.
- A workspace is bound to one AQUA account at the first import. Importing a
  different account's backup is refused unless you pass
  `--allow-account-mismatch`. Use one workspace per account.
- Imported documents are treated as data only; nothing in them is run or
  followed as an instruction.

## Public catalog

```sh
aqua-companion catalog status                 # what is cached, where the configuration comes from
aqua-companion catalog sync                   # read approved public programs and questions (asks first)
aqua-companion catalog import-file catalog.json
```

The configuration (project URL + publishable key) comes from
`https://aquaidp.xyz/.well-known/aqua-catalog.json`, the only address the
companion fetches it from. A local file wins: `--catalog-config <file>` or
`AQUA_CATALOG_CONFIG`. The key must decode to the public anon / publishable
role; a service-role or secret key is refused outright. `AQUA_CATALOG_OFFLINE=1`
skips the fetch, and everything works offline on the cache. Details:
[docs/AGENT.md](docs/AGENT.md#public-catalog).

## Using an AI agent

```sh
claude mcp add aqua -- npx --yes https://aquaidp.xyz/companion/aqua-companion-0.2.3.tgz mcp --workspace ~/Documents/AQUA --keychain
```

`aqua-companion mcp` serves your workspace to a local agent (Claude Code,
Claude Desktop) over MCP. It also starts without a workspace: the agent can
then call `locate_workspace` and `init_workspace`, which asks you to confirm
the folder in your client's UI (or hands you the `init` command). The agent
can import history and forms you put in `inbox/`, match questions, search
your answers, draft new versions, request evidence, build the review file and
packet readiness report, and pick up your browser approvals with
`sync_from_vault_export`. It cannot approve, sign, freeze, export or submit,
holds no account token or database key, never sees your passphrase, and
treats file text as data. The full journey with exact commands, the tool
list with tiers, passphrase options and privacy: [docs/AGENT.md](docs/AGENT.md).

## When the browser and the folder disagree

If a backup contains a record the folder already has, with different
content, nothing is overwritten. The companion records a conflict:

```sh
aqua-companion conflicts
aqua-companion resolve <conflict-id> --keep vault       # take the browser's copy (yours is archived)
aqua-companion resolve <conflict-id> --keep workspace   # keep yours
aqua-companion resolve <conflict-id> --keep both        # keep both; your draft gets a new id
```

Nothing is merged or replaced automatically, and approvals and signed
packets are never rewritten without your decision. Records missing from a
newer backup are kept and flagged, never deleted. `retract <id>` withdraws
something you staged locally (the file is kept). Details:
[docs/SYNC.md](docs/SYNC.md).

## Checking, repairing, moving and backing up

```sh
aqua-companion verify                     # checksums, decryption, unknown/missing files, log chain
aqua-companion recover                    # rebuild the index; damaged files go to audit/quarantine/
aqua-companion relocate /Volumes/Drive    # copy + verify elsewhere; the original stays until you delete it
aqua-companion backup ~/Backups/aqua.backup              # one encrypted file of the whole workspace
aqua-companion restore-workspace ~/Backups/aqua.backup --path ~/Restored
aqua-companion rekey                      # change the workspace passphrase
```

`recover` never deletes anything. If `workspace.json` is lost it uses
`workspace.json.bak`, and if both are gone it rebuilds the index from the
encrypted files (the account binding and past conflict decisions are then
lost; bind again with `--account` on the next import). Keep a `backup` file
somewhere safe.

If a `rekey` is interrupted, run it again with the same old and new
passphrases; other commands refuse to run until it finishes.

Run one companion command at a time per workspace. If two runs overlap,
the second one to finish refuses to overwrite the index and tells you to
run `verify` and `recover`.

## Exit codes

`0` success, `1` error, `2` usage problem or not found, `3` not confirmed,
`4` integrity problem or wrong passphrase, `5` account mismatch.

## Supported imports

`import-application` reads `.txt`, `.md`, `.json` and `.html`;
`import-history` reads `.md`, `.txt`, `.docx`, `.html`, `.json` and `.csv`. (The agent
interface's `import_local_application` uses the web app's richer parsers and
also reads `.csv` and `.docx`.) It finds
numbered questions, questions ending in `?`, and limits like "(150 words)"
or "(500 characters)", and keeps the wording exactly as written. Always read
the extraction it prints before confirming. JSON may give
`{ "title", "org", "deadline", "questions": [ "text" | { "text", "word_limit", "char_limit", "required" } ] }`.
PDF and Word files are not supported yet.

## Development

```sh
node --test aqua-companion/test/*.test.mjs    # from the repository root; Node 22.18+ (TypeScript type stripping)
node aqua-companion/scripts/pack-site.mjs     # rebuild the tarball the site serves (app/public/companion/)
node aqua-companion/scripts/pack-site.mjs --check   # CI: the served tarball matches the source
node aqua-companion/scripts/live-catalog-check.mjs --well-known   # read-only live catalog check (counts only)
```

`createAquaToolRegistry({ workspace?, readOnly? })` (src/registry.mjs) and
`SETUP_TOOLS` (src/mcp-tools.mjs) are the stable hooks `aqua-mcp-server` 2.0
builds on; the companion's own MCP server uses the same registry.

The tests load the web app's real vault modules (`app/lib/aqua-local/`) to
prove both directions of the backup format. At runtime the companion needs
none of the repository: the pure app modules the agent interface uses are
copied into `vendor/` by `node aqua-companion/scripts/vendor.mjs` (types
stripped, source sha256 in each header). CI re-runs that script and fails if
`vendor/` changes, so after editing those app modules, run it and commit the
result. They work only inside fresh
scratch folders (`/private/tmp/claude-501/aqua-companion-tests/` on macOS,
the system temp folder elsewhere, or `AQUA_COMPANION_TEST_DIR`). All fixture
content is synthetic.
