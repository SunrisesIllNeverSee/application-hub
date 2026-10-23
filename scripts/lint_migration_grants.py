#!/usr/bin/env python3
"""Migration grant lint (M09 W11, docs/MIGRATIONS.md "Explicit grants").

From 2026-10-30 Supabase no longer grants anon / authenticated /
service_role access to new tables and sequences in schema public. Every
migration AFTER 059 (supabase/migrations/*_059_explicit_data_api_grants.sql)
that creates a table or sequence in public must, in the same file:

  * name that object in at least one GRANT or REVOKE statement;
  * ENABLE ROW LEVEL SECURITY on every table it creates;
  * GRANT or REVOKE the implicit sequence of every serial/bigserial
    column (<table>_<column>_seq). Identity columns need no sequence grant.

Unqualified names count as public (the migrations run with the default
search_path). Comments and dollar-quoted bodies (functions, DO blocks)
are ignored, so dynamic SQL is not checked.

Usage:
  python3 scripts/lint_migration_grants.py            # lint files after 059
  python3 scripts/lint_migration_grants.py --after 057 # lint from 058 on
  python3 scripts/lint_migration_grants.py --self-test
Exit status 1 on any violation.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

MIG_DIR = Path(__file__).resolve().parent.parent / "supabase" / "migrations"
FILE_RE = re.compile(r"^(\d+)_([a-z0-9_]+)\.sql$")
IDENT = r'(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)'
QNAME = rf"(?:(?P<schema>{IDENT})\s*\.\s*)?(?P<name>{IDENT})"

CREATE_TABLE_RE = re.compile(
    rf"\bcreate\s+(?:(?:global|local)\s+)?(?P<kind>unlogged\s+|temp\s+|temporary\s+)?table\s+"
    rf"(?:if\s+not\s+exists\s+)?{QNAME}", re.I)
CREATE_SEQ_RE = re.compile(
    rf"\bcreate\s+(?:(?:temp|temporary|unlogged)\s+)?sequence\s+(?:if\s+not\s+exists\s+)?{QNAME}", re.I)
GRANT_RE = re.compile(r"\b(grant|revoke)\b(?P<body>[^;]*)", re.I)
RLS_RE = re.compile(
    rf"\balter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?{QNAME}\s+enable\s+row\s+level\s+security", re.I)
# a column definition: at the start of the body or after a top-level comma
SERIAL_RE = re.compile(rf"(?:^|,)\s*(?P<col>{IDENT})\s+(?:small|big)?serial\b", re.I)


def unquote(ident: str) -> str:
    return ident[1:-1] if ident.startswith('"') else ident.lower()


def strip_sql(sql: str) -> str:
    """Remove comments and dollar-quoted bodies, keep statement structure."""
    out, i, n = [], 0, len(sql)
    while i < n:
        if sql.startswith("--", i):
            j = sql.find("\n", i)
            i = n if j < 0 else j
        elif sql.startswith("/*", i):
            j = sql.find("*/", i + 2)
            i = n if j < 0 else j + 2
        elif sql[i] == "'":
            j = i + 1
            while j < n:
                if sql[j] == "'" and j + 1 < n and sql[j + 1] == "'":
                    j += 2
                elif sql[j] == "'":
                    break
                else:
                    j += 1
            out.append("''")
            i = j + 1
        elif sql[i] == "$":
            m = re.match(r"\$([A-Za-z_][A-Za-z0-9_]*)?\$", sql[i:])
            if m:
                tag = m.group(0)
                j = sql.find(tag, i + len(tag))
                out.append(" $body$ ")
                i = n if j < 0 else j + len(tag)
            else:
                out.append(sql[i])
                i += 1
        else:
            out.append(sql[i])
            i += 1
    return "".join(out)


def is_public(schema: str | None) -> bool:
    return schema is None or unquote(schema) == "public"


def table_body(sql: str, start: int) -> str:
    """Text of the parenthesised column list following CREATE TABLE at start."""
    i = sql.find("(", start)
    semi = sql.find(";", start)
    if i < 0 or (0 <= semi < i):
        return ""
    depth, j = 0, i
    while j < len(sql):
        if sql[j] == "(":
            depth += 1
        elif sql[j] == ")":
            depth -= 1
            if depth == 0:
                return sql[i + 1:j]
        j += 1
    return sql[i + 1:]


def lint_sql(sql: str, label: str) -> list[str]:
    s = strip_sql(sql)
    grants = [m.group("body") for m in GRANT_RE.finditer(s)]
    rls = {unquote(m.group("name")) for m in RLS_RE.finditer(s) if is_public(m.group("schema"))}

    def granted(name: str) -> bool:
        pat = re.compile(rf'(?:\bpublic\s*\.\s*|(?<![A-Za-z0-9_$."])){re.escape(name)}(?![A-Za-z0-9_$"])', re.I)
        return any(re.search(r"\bon\b", b, re.I) and pat.search(b) for b in grants)

    errors: list[str] = []
    for m in CREATE_TABLE_RE.finditer(s):
        if m.group("kind") and m.group("kind").strip().lower() in ("temp", "temporary"):
            continue
        if not is_public(m.group("schema")):
            continue
        t = unquote(m.group("name"))
        if not granted(t):
            errors.append(f"{label}: table public.{t} has no GRANT/REVOKE naming it in this migration")
        if t not in rls:
            errors.append(f"{label}: table public.{t} is created without ALTER TABLE ... ENABLE ROW LEVEL SECURITY")
        for c in SERIAL_RE.finditer(table_body(s, m.end())):
            seq = f"{t}_{unquote(c.group('col'))}_seq"
            if not granted(seq):
                errors.append(f"{label}: serial sequence public.{seq} (column {t}.{unquote(c.group('col'))}) "
                              f"has no GRANT/REVOKE naming it")
    for m in CREATE_SEQ_RE.finditer(s):
        if not is_public(m.group("schema")):
            continue
        q = unquote(m.group("name"))
        if not granted(q):
            errors.append(f"{label}: sequence public.{q} has no GRANT/REVOKE naming it in this migration")
    return errors


def migrations_after(after: str | None) -> list[Path]:
    files = sorted(p for p in MIG_DIR.iterdir() if p.is_file() and FILE_RE.match(p.name))
    if after is None:
        idx = [i for i, p in enumerate(files) if p.name.endswith("_059_explicit_data_api_grants.sql")]
        if not idx:
            sys.exit("lint_migration_grants: migration 059 not found")
        return files[idx[0] + 1:]
    keep, seen = [], False
    for p in files:
        if seen:
            keep.append(p)
        elif re.search(rf"(^|_){re.escape(after)}_", p.name):
            seen = True
    if not seen:
        sys.exit(f"lint_migration_grants: no migration numbered {after}")
    return keep


SELF_TEST_GOOD = """
-- create table public.commented_out (id int);
CREATE TABLE IF NOT EXISTS public.widgets (id bigserial PRIMARY KEY, name text);
ALTER TABLE public.widgets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.widgets FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.widgets TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.widgets_id_seq TO service_role;
CREATE SEQUENCE public.widget_serial_seq;
REVOKE ALL ON SEQUENCE public.widget_serial_seq FROM PUBLIC, anon, authenticated;
CREATE TABLE private.elsewhere (id int);
CREATE TEMP TABLE scratch (id int);
CREATE OR REPLACE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $$
BEGIN CREATE TABLE inside_body (id int); END $$;
"""
SELF_TEST_BAD = """
CREATE TABLE gadgets (id bigserial PRIMARY KEY);
GRANT SELECT ON public.gadgets_archive TO anon;
CREATE SEQUENCE public.gadget_seq;
CREATE TABLE public.sprockets (id uuid);
ALTER TABLE public.sprockets ENABLE ROW LEVEL SECURITY;
"""


def self_test() -> int:
    good = lint_sql(SELF_TEST_GOOD, "good")
    bad = lint_sql(SELF_TEST_BAD, "bad")
    expected_bad = {
        "bad: table public.gadgets has no GRANT/REVOKE naming it in this migration",
        "bad: table public.gadgets is created without ALTER TABLE ... ENABLE ROW LEVEL SECURITY",
        "bad: serial sequence public.gadgets_id_seq (column gadgets.id) has no GRANT/REVOKE naming it",
        "bad: sequence public.gadget_seq has no GRANT/REVOKE naming it in this migration",
        "bad: table public.sprockets has no GRANT/REVOKE naming it in this migration",
    }
    ok = not good and set(bad) == expected_bad
    print("self-test:", "PASS" if ok else "FAIL")
    if not ok:
        print("  good ->", good)
        print("  bad  ->", bad)
    return 0 if ok else 1


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--after", help="lint migrations after this number instead of after 059")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    if args.self_test:
        return self_test()
    files = migrations_after(args.after)
    errors = [e for p in files for e in lint_sql(p.read_text(encoding="utf-8"), p.name)]
    for e in errors:
        print("ERROR", e)
    print(f"lint_migration_grants: {len(files)} migration(s) checked, {len(errors)} violation(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
