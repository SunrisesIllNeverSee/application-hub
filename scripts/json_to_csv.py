#!/usr/bin/env python3
"""
Generate fundingcake-programs.csv sorted by user priority:
  Tier 1: US accelerators
  Tier 2: Canada accelerators
  Tier 3: Global accelerators (no specific city OR 'global' in categories)
  Tier 4: Other-country accelerators
  Tier 5: Hackathons + diversity programs (also have applications)
  Tier 6: Everything else (vc, community, event, coworking, etc.)
"""
import csv
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
INPUT_FILE = REPO_ROOT / "scripts" / "fundingcake-programs.json"
OUTPUT_FILE = REPO_ROOT / "scripts" / "fundingcake-programs.csv"

with INPUT_FILE.open() as f:
    programs = json.load(f)


def tier(p):
    is_global = "global" in p["category_slugs"] or p["country"] is None
    if p["program_type"] == "accelerator":
        if p["country"] == "US":
            return 1
        if p["country"] == "CA":
            return 2
        if is_global:
            return 3
        return 4
    if p["program_type"] in ("hackathon", "diversity-program", "grant"):
        return 5
    return 6


for p in programs:
    p["tier"] = tier(p)

# Sort: tier asc, then country, then name
programs.sort(key=lambda p: (p["tier"], p.get("country") or "ZZ", p["name"].lower()))

# Flatten complex fields for CSV
fieldnames = [
    "tier",
    "name",
    "program_type",
    "country",
    "city",
    "website",
    "fundingcake_url",
    "description",
    "tag_labels",
    "category_labels",
    "deadline_signal",
    "money_terms",
    "equity_pct",
    "completeness",
    "slug",
    "logo_url",
    "facebook",
    "twitter",
    "linkedin",
    "instagram",
    "youtube",
]

with OUTPUT_FILE.open("w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for p in programs:
        row = {
            **p,
            "tag_labels": " | ".join(p.get("tag_labels", [])),
            "category_labels": " | ".join(p.get("category_labels", [])),
            "money_terms": " | ".join(p.get("money_terms", [])),
            "facebook": p["socials"].get("facebook", ""),
            "twitter": p["socials"].get("twitter", ""),
            "linkedin": p["socials"].get("linkedin", ""),
            "instagram": p["socials"].get("instagram", ""),
            "youtube": p["socials"].get("youtube", ""),
        }
        # Trim description for CSV — full version stays in JSON
        if row.get("description") and len(row["description"]) > 600:
            row["description"] = row["description"][:600] + "…"
        writer.writerow(row)

# Stats
from collections import Counter
tier_counts = Counter(p["tier"] for p in programs)
print(f"✓ Wrote {len(programs)} rows → {OUTPUT_FILE.relative_to(REPO_ROOT)}")
print()
print("By tier (priority order):")
labels = {
    1: "US accelerators",
    2: "Canada accelerators",
    3: "Global accelerators",
    4: "Other-country accelerators",
    5: "Hackathons + grants + diversity",
    6: "Everything else (vc/community/event)",
}
for t in sorted(tier_counts):
    print(f"  Tier {t}: {tier_counts[t]:4d}   {labels[t]}")
