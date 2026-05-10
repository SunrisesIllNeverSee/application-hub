#!/usr/bin/env python3
"""
Build active-applications.csv by cross-referencing known-open programs
(from web search as of 2026-05-10) against our fundingcake-programs.json.

Status values:
  open_soon       deadline within 30 days
  open            deadline 30-90 days out, or rolling
  rolling         year-round, no fixed deadline
  recently_closed deadline already passed in last 60 days
  upcoming        deadline 90+ days out
  unknown         not yet verified
"""
import csv
import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
INPUT = REPO_ROOT / "scripts" / "fundingcake-programs.json"
OUTPUT = REPO_ROOT / "scripts" / "active-applications.csv"

# Programs identified via web search 2026-05-10 with concrete status.
# Each entry: (slug-or-name-pattern, status, deadline_date, source_note)
KNOWN_STATUS = [
    # Near-term (next 30 days)
    ("a16z-speedrun", "open_soon", "2026-05-17", "a16z Speedrun SR007 — closes May 17"),
    ("a16z",          "open_soon", "2026-05-17", "a16z Speedrun SR007 — closes May 17"),

    # Q2/Q3 2026 deadlines
    ("y-combinator",  "open",      "2026-05-04", "YC Summer 2026 — on-time passed May 4, late accepted"),
    ("google-for-startups", "open", "2026-06-30", "Google for Startups Accelerator NA — June 30"),
    ("founder-institute", "open",  "2026-07-19", "Founder Institute Philadelphia — Jul 19 ($799)"),
    ("techstars",     "open",      "2026-06-10", "Techstars Spring 2026 — multiple deadlines through June 10"),

    # Late 2026
    ("nsf-sbir",      "open",      "2026-06-30", "NSF SBIR Phase I — June-Aug 2026 submission window"),
    ("sbir-phase-1",  "open",      "2026-06-30", "SBIR Phase I — June-Aug 2026 window"),

    # Rolling / year-round
    ("antler",        "rolling",   None, "Antler — year-round rolling applications"),
    ("mucker-lab",    "rolling",   None, "MuckerLab — rolling, no set batch dates"),
    ("plug-and-play", "rolling",   None, "Plug and Play — multiple programs through year"),
    ("alchemist-accelerator", "rolling", None, "Alchemist — cohort-based, ongoing intakes"),

    # Recently closed (good to flag — next cycle coming)
    ("masschallenge", "recently_closed", "2026-03-04", "MassChallenge Switzerland closed Mar 4; other tracks roll out"),

    # Second pass — added 2026-05-10 from web aggregator pages
    ("500-global",    "open",      "2026-06-30", "500 Global Flagship Batch 37 — Q1/Q2 2026 ($150k for 6%)"),
    ("launch-accelerator", "open", "2026-06-15", "LAUNCH Accelerator Cohort 36 — open March 2026 ($125k)"),
    ("founders-factory", "rolling", None, "Founders Factory — London/global, ongoing cohorts (£30-250k)"),
    ("angelpad",      "rolling",   None, "AngelPad — NYC & SF, biannual cohorts ($120k for ~7%)"),
    ("boomtown-accelerators", "rolling", None, "Boomtown Accelerator — Boulder, ongoing ($20k for ~6%)"),
    ("creative-destruction-lab", "open", "2026-07-15", "Creative Destruction Lab — annual cohort applications open"),
    ("startx",        "rolling",   None, "StartX — Stanford-affiliated, equity-free, rolling"),
    ("forum-ventures","rolling",   None, "Forum Ventures — B2B SaaS, rolling ($100k for 7.5%)"),
    ("metaprop",      "rolling",   None, "MetaProp — NYC PropTech, rolling (~$150k for ~6%)"),
    ("berkeley-skydeck", "open",   "2026-07-01", "Berkeley SkyDeck — annual cohort ($200k for 7.5%)"),
    ("dmz-tech-incubator", "rolling", None, "DMZ — Toronto, 16-week program, ongoing intakes"),
    ("l-spark",       "rolling",   None, "L-SPARK — Canadian SaaS, ongoing (3% performance equity)"),
]

# Programs NOT in Fundingcake's directory but known to be currently active.
# These typically already exist in your Supabase archive (your original 30).
# Status reflects web-verified facts as of 2026-05-10.
NOT_IN_FUNDINGCAKE = [
    {"slug": "a16z-speedrun", "name": "a16z Speedrun", "program_type": "accelerator",
     "country": "US", "city": "San Francisco", "website": "https://speedrun.a16z.com",
     "status": "open_soon", "deadline_date": "2026-05-17",
     "source_note": "a16z Speedrun SR007 — closes May 17, 2026 11:59pm PT"},
    {"slug": "a16z-start", "name": "a16z START", "program_type": "accelerator",
     "country": "US", "city": "San Francisco", "website": "https://a16z.com/start/",
     "status": "rolling", "deadline_date": "",
     "source_note": "a16z START — rolling pre-seed program"},
    {"slug": "techstars-boulder", "name": "Techstars (Boulder)", "program_type": "accelerator",
     "country": "US", "city": "Boulder", "website": "https://www.techstars.com/accelerators",
     "status": "open", "deadline_date": "2026-06-10",
     "source_note": "Techstars Spring 2026 — multiple city programs, June 10 deadlines"},
    {"slug": "techstars-anywhere", "name": "Techstars Anywhere", "program_type": "accelerator",
     "country": "US", "city": None, "website": "https://www.techstars.com/accelerators/anywhere",
     "status": "open", "deadline_date": "2026-06-10",
     "source_note": "Techstars Anywhere — remote-first, Spring 2026 June 10 deadline"},
    {"slug": "nsf-sbir", "name": "NSF SBIR / STTR Phase I", "program_type": "grant",
     "country": "US", "city": None, "website": "https://seedfund.nsf.gov/",
     "status": "open", "deadline_date": "2026-06-30",
     "source_note": "NSF SBIR/STTR Phase I — June-Aug submission window, up to $305k non-dilutive"},
    {"slug": "sbir-phase-1", "name": "SBIR Phase I", "program_type": "grant",
     "country": "US", "city": None, "website": "https://www.sbir.gov/",
     "status": "open", "deadline_date": "2026-06-30",
     "source_note": "SBIR Phase I — federal agencies (DoD/NIH/NSF/DOE) submission windows"},
    {"slug": "echoing-green", "name": "Echoing Green Fellowship", "program_type": "grant",
     "country": "US", "city": "New York", "website": "https://echoinggreen.org/",
     "status": "recently_closed", "deadline_date": "2025-09-30",
     "source_note": "Echoing Green 2026 Fellowship — closed Sept 30, 2025; next cycle ~Sept 2026"},
    {"slug": "google-startups-immersion-india", "name": "Google for Startups Immersion (India, AI)",
     "program_type": "accelerator", "country": "IN", "city": "Bangalore",
     "website": "https://startup.google.com/",
     "status": "open_soon", "deadline_date": "2026-05-22",
     "source_note": "Google for Startups + Antler India — closes May 22, 2026"},
    {"slug": "cta-mexico-fintech", "name": "Canadian Technology Accelerator — Mexico Fintech",
     "program_type": "accelerator", "country": "CA", "city": None,
     "website": "https://www.tradecommissioner.gc.ca/",
     "status": "open", "deadline_date": "2026-07-15",
     "source_note": "CTA Mexico Fintech 2026 — July 15, 2026 deadline"},
    {"slug": "cta-silicon-valley-mfg", "name": "Canadian Technology Accelerator — Silicon Valley Advanced Mfg",
     "program_type": "accelerator", "country": "CA", "city": None,
     "website": "https://www.tradecommissioner.gc.ca/",
     "status": "open", "deadline_date": "2026-07-17",
     "source_note": "CTA Silicon Valley Advanced Manufacturing & Industry 4.0 — July 17, 2026"},

    # Programs from web aggregator pages — not in Fundingcake
    {"slug": "south-park-commons", "name": "South Park Commons Founder Fellowship",
     "program_type": "accelerator", "country": "US", "city": "San Francisco",
     "website": "https://www.southparkcommons.com/",
     "status": "recently_closed", "deadline_date": "2026-02-01",
     "source_note": "SPC Founder Fellowship — Feb 1 closed; recurring ($400k for 7% + $600k guaranteed next round)"},
    {"slug": "soma-capital-fellowship", "name": "Soma Capital Fellowship",
     "program_type": "accelerator", "country": "US", "city": "San Francisco",
     "website": "https://somacap.com/fellows",
     "status": "rolling", "deadline_date": "",
     "source_note": "Soma Fellows — rolling admissions (up to $1M uncapped SAFE)"},
    {"slug": "ai2-incubator", "name": "AI2 Incubator (Allen Institute for AI)",
     "program_type": "accelerator", "country": "US", "city": "Seattle",
     "website": "https://www.ai2incubator.com/",
     "status": "rolling", "deadline_date": "",
     "source_note": "AI2 Incubator — Allen Institute, rolling, AI-focused (up to $600k + cloud credits)"},
    {"slug": "alliance-crypto-accelerator", "name": "Alliance (Crypto Accelerator)",
     "program_type": "accelerator", "country": "US", "city": "New York",
     "website": "https://alliance.xyz/",
     "status": "recently_closed", "deadline_date": "2026-05-11",
     "source_note": "Alliance Crypto — cohort started May 11; next cycle TBD ($500k via SAFE)"},
    {"slug": "endless-frontier-labs", "name": "Endless Frontier Labs",
     "program_type": "accelerator", "country": "US", "city": "New York",
     "website": "https://endlessfrontierlabs.com/",
     "status": "open", "deadline_date": "2026-07-15",
     "source_note": "Endless Frontier Labs — NYU Stern, deep tech / life sciences, equity-free"},
    {"slug": "ewor", "name": "EWOR",
     "program_type": "accelerator", "country": "DE", "city": None,
     "website": "https://www.ewor.com/",
     "status": "rolling", "deadline_date": "",
     "source_note": "EWOR — Europe-wide, up to €500k for 7% (industry-agnostic)"},
    {"slug": "startupbootcamp", "name": "Startupbootcamp",
     "program_type": "accelerator", "country": "NL", "city": "Amsterdam",
     "website": "https://www.startupbootcamp.org/",
     "status": "open", "deadline_date": "2026-08-31",
     "source_note": "Startupbootcamp — Global vertical accelerators (€15-40k for ~8%)"},
    {"slug": "entrepreneurs-roundtable-accelerator", "name": "Entrepreneurs Roundtable Accelerator (ERA)",
     "program_type": "accelerator", "country": "US", "city": "New York",
     "website": "https://eranyc.com/",
     "status": "open", "deadline_date": "2026-08-15",
     "source_note": "ERA NYC — $150k for 6% ($170k incl. operations)"},
    {"slug": "sosv", "name": "SOSV (HAX, IndieBio, RebelBio, Orbit)",
     "program_type": "accelerator", "country": "US", "city": None,
     "website": "https://sosv.com/",
     "status": "rolling", "deadline_date": "",
     "source_note": "SOSV — Global hardware/biotech (HAX/IndieBio), $250-550k investments"},
    {"slug": "village-capital", "name": "Village Capital",
     "program_type": "accelerator", "country": "US", "city": "Washington",
     "website": "https://vilcap.com/",
     "status": "open", "deadline_date": "2026-08-01",
     "source_note": "Village Capital — Global impact accelerator (varies by program)"},
    {"slug": "capital-factory", "name": "Capital Factory",
     "program_type": "accelerator", "country": "US", "city": "Austin",
     "website": "https://www.capitalfactory.com/",
     "status": "rolling", "deadline_date": "",
     "source_note": "Capital Factory — Austin, rolling ($100k for up to 1%)"},
    {"slug": "startup-chile", "name": "Startup Chile",
     "program_type": "accelerator", "country": "CL", "city": "Santiago",
     "website": "https://startupchile.org/",
     "status": "open", "deadline_date": "2026-06-30",
     "source_note": "Startup Chile — equity-free up to $100k, government-backed"},
    {"slug": "wayra", "name": "Wayra",
     "program_type": "accelerator", "country": "ES", "city": None,
     "website": "https://www.wayra.com/",
     "status": "rolling", "deadline_date": "",
     "source_note": "Wayra — Telefónica's global accelerator (€50k-€5M, AI/IoT/Cloud)"},
    {"slug": "alphalab", "name": "AlphaLab",
     "program_type": "accelerator", "country": "US", "city": "Pittsburgh",
     "website": "https://www.alphalab.org/",
     "status": "open", "deadline_date": "2026-08-15",
     "source_note": "AlphaLab — Pittsburgh, up to $100k + 2% (software/robotics/life sciences)"},
    {"slug": "founderfuel", "name": "FounderFuel",
     "program_type": "accelerator", "country": "CA", "city": "Montreal",
     "website": "https://founderfuel.com/",
     "status": "open", "deadline_date": "2026-07-15",
     "source_note": "FounderFuel — Montreal, 16-week ($120k CAD: $20k for 5% + $100k SAFE)"},
    {"slug": "union-kitchen", "name": "Union Kitchen",
     "program_type": "accelerator", "country": "US", "city": "Washington",
     "website": "https://unionkitchen.com/",
     "status": "rolling", "deadline_date": "",
     "source_note": "Union Kitchen — DC, food/CPG accelerator (10% equity + board seat)"},
    {"slug": "google-startups-mena", "name": "Google for Startups Accelerator: MENA / NA / Turkey",
     "program_type": "accelerator", "country": None, "city": None,
     "website": "https://startup.google.com/",
     "status": "open", "deadline_date": "2026-06-30",
     "source_note": "Google for Startups MENA, North Africa & Turkey — Apr-Jun 2026 cycle, equity-free + up to $350k cloud credits"},
]


def fuzzy_match(needle, candidates):
    """Return list of program slugs that match the needle (substring or starts-with)."""
    needle = needle.lower().replace(" ", "-")
    matches = []
    for slug in candidates:
        s = slug.lower()
        if s == needle:
            matches.append((slug, "exact"))
        elif s.startswith(needle) or needle.startswith(s):
            matches.append((slug, "prefix"))
        elif needle in s:
            matches.append((slug, "substring"))
    return matches


def main():
    programs = json.loads(INPUT.read_text())
    by_slug = {p["slug"]: p for p in programs}

    annotated = []
    seen_slugs = set()

    for needle, status, deadline, note in KNOWN_STATUS:
        matches = fuzzy_match(needle, by_slug.keys())
        if not matches:
            print(f"[unmatched]  {needle:30s} → no fundingcake entry")
            continue
        for slug, match_type in matches:
            if slug in seen_slugs:
                continue
            seen_slugs.add(slug)
            p = by_slug[slug]
            annotated.append({
                "slug": slug,
                "name": p["name"],
                "program_type": p["program_type"],
                "country": p["country"],
                "city": p["city"],
                "website": p["website"],
                "status": status,
                "deadline_date": deadline or "",
                "source_note": note,
                "match_type": match_type,
                "fundingcake_url": p["fundingcake_url"],
                "source": "fundingcake",
            })
            print(f"[{status:15s}] {p['name']:35s} ({p['country'] or '?'}) — {note}")

    # Add synthetic entries for programs not in Fundingcake
    for entry in NOT_IN_FUNDINGCAKE:
        annotated.append({
            **entry,
            "match_type": "external",
            "fundingcake_url": "",
            "source": "web-search",
        })
        print(f"[{entry['status']:15s}] {entry['name']:35s} ({entry['country'] or '?'}) — {entry['source_note']}")

    # Sort: open_soon → open → rolling → recently_closed
    status_order = {"open_soon": 0, "open": 1, "rolling": 2, "upcoming": 3, "recently_closed": 4, "unknown": 5}
    annotated.sort(key=lambda r: (status_order.get(r["status"], 99), r["country"] or "ZZ", r["name"].lower()))

    # Write CSV
    fieldnames = ["status", "deadline_date", "name", "program_type", "country", "city", "website", "source_note", "source", "fundingcake_url", "slug", "match_type"]
    with OUTPUT.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for row in annotated:
            w.writerow(row)

    print(f"\n✓ Wrote {len(annotated)} active-application records → {OUTPUT.relative_to(REPO_ROOT)}")
    print("\nBy status:")
    from collections import Counter
    for s, n in Counter(r["status"] for r in annotated).most_common():
        print(f"  {s:18s} {n}")


if __name__ == "__main__":
    main()
