#!/usr/bin/env python3
"""
Agent coordination checker — Phase B enforcement layer.

Reads `.agents/registry.yaml` and `.agents/claims.yaml` plus filesystem state
and reports inconsistencies. Exit codes:
  0 = clean
  1 = warnings (advisory; CI green)
  2 = blockers (CI red)

Checks (per `.agents/PROTOCOL.md` § Future ratchet):
  1. Migration registry matches `migrations/` filesystem
  2. No two active claims overlap on the same file lane
  3. No active migration-number claim duplicates an applied number
  4. Sessions marked `active` with stale heartbeat (>24h) get flagged
  5. Released claims must have `released_at` AND at least one `landed_commits`
  6. `migrations.next` is one greater than the highest applied number
  7. STATUS.md and registry.yaml agree on migration high-water mark

Usage:
  python3 .agents/check.py                # human-readable report
  python3 .agents/check.py --strict       # treat warnings as blockers
  python3 .agents/check.py --json         # machine-readable output
  python3 .agents/check.py --quiet        # only print on failure
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
from pathlib import Path

# Stdlib-only YAML parser to avoid requiring a pyyaml install.
# Our registry/claims files use a deliberately narrow subset of YAML.
try:
    import yaml  # type: ignore
    _HAVE_PYYAML = True
except ImportError:
    yaml = None
    _HAVE_PYYAML = False


REPO_ROOT = Path(__file__).resolve().parent.parent
AGENTS_DIR = REPO_ROOT / ".agents"
REGISTRY = AGENTS_DIR / "registry.yaml"
CLAIMS = AGENTS_DIR / "claims.yaml"
STATUS = REPO_ROOT / "STATUS.md"

# Migration path is read from registry at runtime (see load_migrations_path).
# Fallback to legacy location if registry doesn't specify.
_MIGRATIONS_FALLBACK = REPO_ROOT / "migrations"


def load_migrations_path(registry: dict) -> Path:
    rel = registry.get("migrations", {}).get("path")
    if rel:
        return REPO_ROOT / rel.rstrip("/")
    return _MIGRATIONS_FALLBACK


MIGRATIONS = _MIGRATIONS_FALLBACK  # overridden after registry load

STALE_HEARTBEAT_HOURS = 24


def load_yaml(path: Path) -> dict:
    """Load a YAML file. Requires pyyaml — installs it via pip if missing."""
    if not _HAVE_PYYAML:
        # Minimal fallback: tell user to install pyyaml. Don't try to parse by hand.
        print(
            f"check.py needs pyyaml. Install with: pip3 install pyyaml",
            file=sys.stderr,
        )
        sys.exit(3)
    with path.open() as f:
        return yaml.safe_load(f)


def parse_iso(ts: str) -> dt.datetime:
    """ISO 8601 → aware datetime. Treats trailing Z as UTC."""
    s = ts.replace("Z", "+00:00")
    return dt.datetime.fromisoformat(s)


def check_migrations(registry: dict, findings: list) -> None:
    """Filesystem migrations match registry; next number is right."""
    applied = registry.get("migrations", {}).get("applied", [])
    next_num = int(registry.get("migrations", {}).get("next", 0))

    fs_files = sorted(MIGRATIONS.glob("*.sql"))
    fs_basenames = {p.name for p in fs_files}

    # Registry-claimed files that don't exist on disk
    registry_files = {entry["file"]: entry for entry in applied}
    missing_on_disk = sorted(registry_files.keys() - fs_basenames)
    for name in missing_on_disk:
        findings.append(
            ("BLOCKER", f"registry says {name} is applied but file missing on disk")
        )

    # Files on disk that aren't in the registry
    extra_on_disk = sorted(fs_basenames - registry_files.keys())
    for name in extra_on_disk:
        # Try to extract the number prefix; an unregistered migration is a
        # warning, not a blocker — could be staged but unapplied.
        m = re.match(r"^(\d{3})_", name)
        n = m.group(1) if m else "???"
        findings.append(
            ("WARN", f"{name} (n={n}) exists on disk but not in registry — apply or claim")
        )

    # next should be max(applied)+1
    if applied:
        applied_numbers = [int(entry["n"]) for entry in applied]
        highest = max(applied_numbers)
        if next_num != highest + 1:
            findings.append(
                (
                    "WARN",
                    f"migrations.next={next_num} but highest applied={highest}; expected {highest + 1}",
                )
            )


def check_claim_overlaps(claims_doc: dict, findings: list) -> None:
    """No two ACTIVE claims should hold the same file lane."""
    claims = claims_doc.get("claims", []) or []
    active = [c for c in claims if not c.get("released_at")]

    seen: dict[str, str] = {}
    for c in active:
        if c.get("type") != "file_lane":
            continue
        for path in c.get("paths", []):
            owner_id = seen.get(path)
            if owner_id and owner_id != c["id"]:
                findings.append(
                    (
                        "BLOCKER",
                        f"file_lane overlap: {path} held by both {owner_id} and {c['id']}",
                    )
                )
            seen.setdefault(path, c["id"])


def check_migration_claims_unique(claims_doc: dict, registry: dict, findings: list) -> None:
    """No active migration_number claim on a number already applied."""
    applied_numbers = {
        int(entry["n"]) for entry in registry.get("migrations", {}).get("applied", [])
    }
    claims = claims_doc.get("claims", []) or []
    for c in claims:
        if c.get("type") != "migration_number":
            continue
        if c.get("released_at"):
            continue
        for n in c.get("numbers", []) or []:
            if int(n) in applied_numbers:
                findings.append(
                    (
                        "WARN",
                        f"claim {c['id']} holds migration_number {n} but registry says applied — release it",
                    )
                )


def check_stale_sessions(claims_doc: dict, findings: list) -> None:
    """Sessions marked active with no heartbeat in 24h get flagged."""
    now = dt.datetime.now(dt.timezone.utc)
    for s in claims_doc.get("sessions", []) or []:
        if s.get("status") != "active":
            continue
        hb = s.get("heartbeat")
        if not hb:
            findings.append(("WARN", f"session {s['id']} is active but has no heartbeat"))
            continue
        try:
            hb_dt = parse_iso(str(hb))
        except ValueError:
            findings.append(
                ("WARN", f"session {s['id']} has unparseable heartbeat {hb!r}")
            )
            continue
        age_h = (now - hb_dt).total_seconds() / 3600
        if age_h > STALE_HEARTBEAT_HOURS:
            findings.append(
                (
                    "WARN",
                    f"session {s['id']} is active with stale heartbeat ({age_h:.1f}h old) — mark wrapped if done",
                )
            )


def check_released_claims_have_commits(claims_doc: dict, findings: list) -> None:
    """A released claim should record at least one landed commit for traceability."""
    for c in claims_doc.get("claims", []) or []:
        if not c.get("released_at"):
            continue
        commits = c.get("landed_commits") or []
        if not commits:
            findings.append(
                (
                    "WARN",
                    f"claim {c['id']} is released but has no landed_commits — add at least one short SHA",
                )
            )


def check_status_md_agrees(registry: dict, findings: list) -> None:
    """STATUS.md should mention the same migration high-water mark as the registry."""
    if not STATUS.exists():
        findings.append(("WARN", "STATUS.md not found — skipping STATUS agreement check"))
        return
    applied = registry.get("migrations", {}).get("applied", []) or []
    if not applied:
        return
    highest = max(int(entry["n"]) for entry in applied)
    text = STATUS.read_text()
    # Look for "001–026", "001-028", etc. anywhere in STATUS.
    chain_pat = re.compile(r"`?001[–-](\d{3})`?")
    matches = chain_pat.findall(text)
    if not matches:
        findings.append(("WARN", "STATUS.md doesn't reference a migration chain; can't compare"))
        return
    chain_highs = {int(m) for m in matches}
    if highest not in chain_highs:
        findings.append(
            (
                "WARN",
                f"STATUS.md migration chain {sorted(chain_highs)} doesn't include registry high {highest:03d}",
            )
        )


def check_nextjs_async_params(findings: list) -> None:
    """All Next.js page searchParams/params must be typed as Promise<{...}> (Next.js 15+).
    Any page using the old sync `searchParams: {` or `params: {` signature will cause
    a runtime error. This check catches regressions before they reach Vercel.
    """
    app_dir = REPO_ROOT / "app" / "app"
    if not app_dir.exists():
        return
    sync_pat = re.compile(r"\b(searchParams|params)\s*:\s*\{(?!.*Promise)")
    offenders: list[str] = []
    for tsx in app_dir.rglob("*.tsx"):
        if "node_modules" in tsx.parts or ".next" in tsx.parts:
            continue
        text = tsx.read_text(errors="replace")
        for lineno, line in enumerate(text.splitlines(), 1):
            if sync_pat.search(line):
                rel = tsx.relative_to(ROOT)
                offenders.append(f"{rel}:{lineno} — {line.strip()[:80]}")
    if offenders:
        for o in offenders:
            findings.append(
                (
                    "BLOCKER",
                    f"Next.js 15: non-async page prop (must be Promise<{{...}}>): {o}",
                )
            )


def collect_slug_stems(path: Path) -> set[str]:
    """Collect top-level markdown slug stems from a lane directory."""
    if not path.exists():
        return set()
    return {p.stem for p in path.glob("*.md") if p.is_file() and p.name != "README.md"}


def check_qaapplication_lane_parity(findings: list) -> None:
    """Validate qaapplication lane parity for active apply and submitted flows."""
    qa_root = REPO_ROOT / "qaapplication"
    if not qa_root.exists():
        return

    programs = collect_slug_stems(qa_root / "03-programs")
    applications = collect_slug_stems(qa_root / "04-applications")
    question_sources = collect_slug_stems(qa_root / "05-questions" / "source")
    active_apply = collect_slug_stems(qa_root / "08-apply")
    submitted_archive = collect_slug_stems(qa_root / "09-submitted" / "archive")
    submitted_records = collect_slug_stems(
        qa_root / "09-submitted" / "archived_applications"
    )

    # Active apply packets should at least have an entity record and a question-source file.
    for slug in sorted(active_apply):
        if slug not in programs:
            findings.append(
                (
                    "WARN",
                    f"qaapplication active apply slug {slug} missing 03-programs/{slug}.md",
                )
            )
        if slug not in question_sources:
            findings.append(
                (
                    "WARN",
                    f"qaapplication active apply slug {slug} missing 05-questions/source/{slug}.md",
                )
            )

    # Submitted archive slugs should line up across the canonical submitted lanes.
    submitted_union = submitted_archive | applications | question_sources | submitted_records
    for slug in sorted(submitted_union):
        if slug in submitted_archive or slug in applications or slug in submitted_records:
            if slug not in programs:
                findings.append(
                    (
                        "WARN",
                        f"qaapplication submitted slug {slug} missing 03-programs/{slug}.md",
                    )
                )
            if slug not in applications:
                findings.append(
                    (
                        "WARN",
                        f"qaapplication submitted slug {slug} missing 04-applications/{slug}.md",
                    )
                )
            if slug not in question_sources:
                findings.append(
                    (
                        "WARN",
                        f"qaapplication submitted slug {slug} missing 05-questions/source/{slug}.md",
                    )
                )
            if slug not in submitted_archive:
                findings.append(
                    (
                        "WARN",
                        f"qaapplication submitted slug {slug} missing 09-submitted/archive/{slug}.md",
                    )
                )
            if slug not in submitted_records:
                findings.append(
                    (
                        "WARN",
                        f"qaapplication submitted slug {slug} missing 09-submitted/archived_applications/{slug}.md",
                    )
                )


def format_report(findings: list, *, as_json: bool, quiet: bool) -> str:
    if as_json:
        return json.dumps(
            {
                "findings": [{"severity": sev, "message": msg} for sev, msg in findings],
                "summary": {
                    "blockers": sum(1 for sev, _ in findings if sev == "BLOCKER"),
                    "warnings": sum(1 for sev, _ in findings if sev == "WARN"),
                },
            },
            indent=2,
        )
    if not findings:
        return "✓ .agents check clean — no inconsistencies found"
    if quiet:
        return ""  # quiet mode suppresses output when issues exist; exit code carries signal
    lines = []
    for sev, msg in findings:
        marker = "🛑" if sev == "BLOCKER" else "⚠️ "
        lines.append(f"{marker} [{sev}] {msg}")
    blockers = sum(1 for sev, _ in findings if sev == "BLOCKER")
    warns = sum(1 for sev, _ in findings if sev == "WARN")
    lines.append("")
    lines.append(f"summary: {blockers} blocker(s), {warns} warning(s)")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1] if __doc__ else "")
    ap.add_argument("--strict", action="store_true", help="treat warnings as blockers")
    ap.add_argument("--json", action="store_true", help="machine-readable JSON output")
    ap.add_argument("--quiet", action="store_true", help="only print on failure")
    args = ap.parse_args()

    findings: list[tuple[str, str]] = []

    if not REGISTRY.exists():
        findings.append(("BLOCKER", f"missing {REGISTRY.relative_to(REPO_ROOT)}"))
    if not CLAIMS.exists():
        findings.append(("BLOCKER", f"missing {CLAIMS.relative_to(REPO_ROOT)}"))

    if findings:
        print(format_report(findings, as_json=args.json, quiet=False))
        return 2

    registry = load_yaml(REGISTRY)
    claims_doc = load_yaml(CLAIMS)

    # Override migrations path from registry
    global MIGRATIONS
    MIGRATIONS = load_migrations_path(registry)

    check_migrations(registry, findings)
    check_claim_overlaps(claims_doc, findings)
    check_migration_claims_unique(claims_doc, registry, findings)
    check_stale_sessions(claims_doc, findings)
    check_released_claims_have_commits(claims_doc, findings)
    check_status_md_agrees(registry, findings)
    check_nextjs_async_params(findings)
    check_qaapplication_lane_parity(findings)

    out = format_report(findings, as_json=args.json, quiet=args.quiet)
    if out:
        print(out)

    blockers = sum(1 for sev, _ in findings if sev == "BLOCKER")
    warns = sum(1 for sev, _ in findings if sev == "WARN")
    if blockers:
        return 2
    if warns and args.strict:
        return 2
    if warns:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
