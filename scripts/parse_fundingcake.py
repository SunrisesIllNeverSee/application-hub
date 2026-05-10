#!/usr/bin/env python3
"""
Parse fundingcake.com listing markdown files into structured JSON.

V2 — second-pass enrichment:
  - Website extraction now scans ANY external link (not just bare-link)
  - Detects application URLs (any link containing /apply, ?apply, "Apply Now" text)
  - Extracts deadline / batch hints from About text (e.g. "January to March",
    "rolling basis", "annual cohort")
  - Extracts program terms (investment amount, equity %)
  - Records data_completeness score per record (0–1)
"""
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPE_DIR = REPO_ROOT / ".firecrawl"
OUTPUT_FILE = REPO_ROOT / "scripts" / "fundingcake-programs.json"

CATEGORY_LINK = re.compile(
    r'\[([^\]]+)\]\(https://fundingcake\.com/directory-category/([a-z0-9-]+)/?(?:\s+"[^"]*")?\)'
)
TAG_LINK = re.compile(
    r'\[([^\]]+)\]\(https://fundingcake\.com/startup-directory/tags/([a-z0-9-]+)/?(?:\s+"[^"]*")?\)'
)
SOCIAL_LINK = re.compile(
    r'\[(Facebook|X \(Twitter\)|LinkedIn|Instagram|YouTube)\]\((https?://[^\s)"]+)(?:\s+"[^"]*")?\)'
)
LOGO_IMG = re.compile(r"!\[[^\]]*\]\((https://fundingcake\.com/wp-content/uploads/[^)]+)\)")
WEBSITE_BARE = re.compile(r"^\[(https?://[^\]]+)\]\(\1\)\s*$", re.MULTILINE)

# Any external link (not fundingcake.com, not social platform, not asset host)
ANY_EXTERNAL_LINK = re.compile(
    r'\[([^\]]+)\]\((https?://(?!fundingcake\.com|www\.facebook\.com|twitter\.com|x\.com|'
    r'linkedin\.com|instagram\.com|youtube\.com|youtu\.be)[^)\s"]+)(?:\s+"[^"]*")?\)'
)

# Application URL — any link that looks like an apply path
APPLY_URL = re.compile(
    r'\[([^\]]*(?:apply|application)[^\]]*)\]\((https?://[^)\s"]+)(?:\s+"[^"]*")?\)',
    re.IGNORECASE,
)

# Deadline / batch / cohort signals
DEADLINE_PATTERNS = [
    (re.compile(r"\brolling\s+basis\b", re.I), "rolling"),
    (re.compile(r"\bquarterly\b|\bquarter\b", re.I), "quarterly"),
    (re.compile(r"\bannual(?:ly)?\s+(?:cohort|program|batch)?\b", re.I), "annual"),
    (re.compile(r"\bbi-?annual\b|\btwice\s+a\s+year\b", re.I), "biannual"),
]

# Investment / equity terms
MONEY_PATTERNS = [
    re.compile(r"\$[\d,]+(?:\.\d+)?[mMkK]?\b"),                 # $500k, $5M
    re.compile(r"\b(?:USD|CAD|EUR|GBP)\s*[\d,]+(?:\.\d+)?[mMkK]?\b"),
]
EQUITY_PATTERN = re.compile(r"\b(\d{1,2}(?:\.\d{1,2})?)\s*%\s*(?:equity|stake|in\s+(?:your|the)\s+(?:company|startup))", re.I)

TYPE_RULES = [
    ("startup-accelerators-incubators", "accelerator"),
    ("venture-studios", "venture-studio"),
    ("hackathons", "hackathon"),
    ("female-founders", "diversity-program"),
    ("venture-capital", "vc"),
    ("meetups", "community"),
    ("conferences", "event"),
    ("coworking", "coworking"),
    ("startup-media", "media"),
]


def classify_type(category_slugs, tag_slugs):
    for slug in category_slugs:
        for suffix, ptype in TYPE_RULES:
            if slug.endswith(suffix):
                return ptype
    tag_join = " ".join(tag_slugs)
    if "accelerator" in tag_join:
        return "accelerator"
    if "grant" in tag_join or "fellowship" in tag_join:
        return "grant"
    return "other"


def extract_location(category_slugs):
    city_to_country = {
        "san-francisco": "US", "new-york": "US", "boston": "US", "los-angeles": "US",
        "seattle": "US", "miami": "US", "buffalo": "US", "chicago": "US",
        "austin": "US", "denver": "US", "atlanta": "US", "palo-alto": "US",
        "boulder": "US", "portland": "US", "philadelphia": "US", "washington-dc": "US",
        "san-diego": "US", "phoenix": "US", "houston": "US", "dallas": "US",
        "detroit": "US", "minneapolis": "US", "pittsburgh": "US",
        "toronto": "CA", "vancouver": "CA", "montreal": "CA", "calgary": "CA",
        "ottawa": "CA", "edmonton": "CA", "waterloo": "CA", "halifax": "CA",
        "london": "UK", "berlin": "DE", "paris": "FR", "amsterdam": "NL",
        "singapore": "SG", "tokyo": "JP", "tel-aviv": "IL", "sydney": "AU",
        "dubai": "AE", "bangalore": "IN", "delhi": "IN", "mumbai": "IN",
        "stockholm": "SE", "helsinki": "FI", "copenhagen": "DK", "oslo": "NO",
        "dublin": "IE", "barcelona": "ES", "madrid": "ES", "lisbon": "PT",
        "zurich": "CH", "vienna": "AT", "warsaw": "PL", "prague": "CZ",
    }
    suffix_set = {s for s, _ in TYPE_RULES}
    for slug in category_slugs:
        if not any(slug.endswith(suf) for suf in suffix_set) and slug != "global":
            country = city_to_country.get(slug)
            return slug.replace("-", " ").title(), country
    return None, None


def extract_website(main, name):
    """V2 website extraction — try bare-link first, fall back to any external link."""
    # Strategy 1: bare-link (link text == URL)
    m = WEBSITE_BARE.search(main)
    if m:
        return m.group(1).rstrip("/")
    # Strategy 2: first non-social external link in the first 1500 chars of main content
    # (before "About" boilerplate gets noisy with portfolio refs)
    head = main[:1500]
    for m in ANY_EXTERNAL_LINK.finditer(head):
        url = m.group(2).rstrip("/")
        # Filter obvious non-website noise
        if any(skip in url for skip in ("emailoctopus", "google.com/recaptcha", "wp-content")):
            continue
        return url
    return None


def extract_apply_url(main):
    """Find any link suggesting application/apply path."""
    m = APPLY_URL.search(main)
    if m:
        return m.group(2).rstrip("/")
    return None


def detect_deadline_signal(text):
    for pat, label in DEADLINE_PATTERNS:
        if pat.search(text):
            return label
    return None


def extract_money_terms(text):
    """Extract any dollar amounts mentioned."""
    amounts = set()
    for pat in MONEY_PATTERNS:
        for m in pat.finditer(text):
            amounts.add(m.group(0))
    return sorted(amounts)


def extract_equity(text):
    m = EQUITY_PATTERN.search(text)
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            return None
    return None


def completeness(rec):
    """Score 0–1 based on which key fields are populated."""
    fields = ["website", "description", "city", "country", "logo_url", "socials"]
    filled = sum(1 for f in fields if rec.get(f))
    return round(filled / len(fields), 2)


def parse_listing(md, slug):
    cut_idx = md.find("Related Listings")
    main = md[:cut_idx] if cut_idx > 0 else md

    name_match = re.search(r"^# (.+?)$", main, re.MULTILINE)
    if not name_match:
        return None
    name = name_match.group(1).strip()

    logo = None
    m = LOGO_IMG.search(main)
    if m:
        logo = m.group(1)

    website = extract_website(main, name)

    socials = {}
    for m in SOCIAL_LINK.finditer(main):
        platform = m.group(1).lower().replace(" (twitter)", "").replace("x", "twitter")
        socials[platform] = m.group(2)

    category_slugs, category_labels = [], []
    for m in CATEGORY_LINK.finditer(main):
        category_labels.append(m.group(1).strip())
        category_slugs.append(m.group(2))

    tag_slugs, tag_labels = [], []
    for m in TAG_LINK.finditer(main):
        tag_labels.append(m.group(1).strip())
        tag_slugs.append(m.group(2))

    about = ""
    about_match = re.search(r"\n\s*About\s*\n+(.+?)(?=\n## |\nRelated Listings|\Z)", main, re.DOTALL)
    if about_match:
        about = about_match.group(1).strip()
        about = re.sub(r"\nFor list of events.*$", "", about, flags=re.DOTALL).strip()

    program_type = classify_type(category_slugs, tag_slugs)
    city, country = extract_location(category_slugs)

    # V2 enrichment
    apply_url = extract_apply_url(main)
    deadline_signal = detect_deadline_signal(about)
    money_terms = extract_money_terms(about)
    equity_pct = extract_equity(about)

    rec = {
        "slug": slug,
        "name": name,
        "fundingcake_url": f"https://fundingcake.com/listing/{slug}/",
        "website": website,
        "apply_url": apply_url,
        "logo_url": logo,
        "description": about,
        "program_type": program_type,
        "category_slugs": category_slugs,
        "category_labels": category_labels,
        "tag_slugs": tag_slugs,
        "tag_labels": tag_labels,
        "city": city,
        "country": country,
        "socials": socials,
        "deadline_signal": deadline_signal,
        "money_terms": money_terms,
        "equity_pct": equity_pct,
    }
    rec["completeness"] = completeness(rec)
    return rec


def main():
    files = sorted(SCRAPE_DIR.glob("fundingcake.com-listing-*.md"))
    print(f"Parsing {len(files)} listing files (v2 enrichment)...")

    programs, skipped = [], []
    for f in files:
        slug = f.name.removeprefix("fundingcake.com-listing-").removesuffix(".md")
        md = f.read_text()
        parsed = parse_listing(md, slug)
        if parsed:
            programs.append(parsed)
        else:
            skipped.append(slug)

    by_type = {}
    for p in programs:
        by_type[p["program_type"]] = by_type.get(p["program_type"], 0) + 1

    OUTPUT_FILE.write_text(json.dumps(programs, indent=2, ensure_ascii=False))

    # Stats
    print(f"\n✓ Parsed {len(programs)} programs → {OUTPUT_FILE.relative_to(REPO_ROOT)}")
    print(f"  Skipped (no h1): {len(skipped)}")
    print("\nBy type:")
    for ptype, count in sorted(by_type.items(), key=lambda x: -x[1]):
        print(f"  {ptype:25s} {count:4d}")

    # Coverage
    n = len(programs)
    print(f"\nCoverage ({n} total):")
    print(f"  Website URL      : {sum(1 for p in programs if p['website']):4d} ({100*sum(1 for p in programs if p['website'])//n}%)")
    print(f"  Apply URL        : {sum(1 for p in programs if p['apply_url']):4d} ({100*sum(1 for p in programs if p['apply_url'])//n}%)")
    print(f"  Description >50ch: {sum(1 for p in programs if p['description'] and len(p['description'])>50):4d} ({100*sum(1 for p in programs if p['description'] and len(p['description'])>50)//n}%)")
    print(f"  City             : {sum(1 for p in programs if p['city']):4d} ({100*sum(1 for p in programs if p['city'])//n}%)")
    print(f"  Deadline signal  : {sum(1 for p in programs if p['deadline_signal']):4d} ({100*sum(1 for p in programs if p['deadline_signal'])//n}%)")
    print(f"  Money terms      : {sum(1 for p in programs if p['money_terms']):4d} ({100*sum(1 for p in programs if p['money_terms'])//n}%)")
    print(f"  Equity %         : {sum(1 for p in programs if p['equity_pct']):4d} ({100*sum(1 for p in programs if p['equity_pct'])//n}%)")
    print(f"  Avg completeness : {sum(p['completeness'] for p in programs)/n:.2f}")

    # Active candidates: accelerators + rolling/quarterly/annual deadline + website
    active = [p for p in programs if p["program_type"] == "accelerator" and p["website"]]
    print(f"\nActive-application candidates (accelerators with website): {len(active)}")
    rolling_count = sum(1 for p in active if p["deadline_signal"] == "rolling")
    print(f"  └ flagged 'rolling basis': {rolling_count}")


if __name__ == "__main__":
    main()
