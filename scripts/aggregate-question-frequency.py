#!/usr/bin/env python3
"""
aggregate-question-frequency.py

Reads the extracted_questions.jsonl output from scrape-apply-questions.ts
and builds a frequency map: for every extracted question, how many programs
ask it (or something very similar)?

This is the core of how we compute asked_by_count in archived_questions
and what should drive program_dna theme weighting.

USAGE:
    python3 scripts/aggregate-question-frequency.py \
        --input seed/staging/extracted_questions.jsonl \
        --archive-csv seed/staging/fundingcake_questions.csv \
        --output seed/staging/question_frequency_report.csv

OUTPUT (CSV):
    normalized_question    — lowercase, stripped version for grouping
    occurrences            — how many programs ask this exact phrasing
    programs               — comma-separated slugs that ask it
    best_match_in_archive  — closest match in archived_questions (if any)
    match_similarity       — rough similarity score (0–1)
    recommendation         — new / update_count / already_tracked

HOW IT WORKS:
    1. Groups extracted questions by normalized text
       (lowercase, strip punctuation, collapse whitespace)
    2. Within each group, finds the canonical phrasing
       (most common variant, or longest)
    3. Fuzzy-matches against the archived_questions table
       (loaded from Supabase or from a local CSV export)
    4. Outputs a ranked CSV sorted by occurrences desc

WHY THIS MATTERS:
    - asked_by_count on each archived_questions row should reflect how many
      of the 843 programs in the database actually ask that question
    - Right now most asked_by_count values are from the original 31 manually
      seeded programs — this script corrects the count across 292 programs
    - High-frequency questions that AREN'T in the archive are candidates for
      adding as new archived_questions entries
"""

import json
import csv
import re
import sys
from collections import defaultdict, Counter
from difflib import SequenceMatcher
from pathlib import Path


def normalize(text: str) -> str:
    """Normalize question text for grouping similar variants."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s]', ' ', text)   # remove punctuation
    text = re.sub(r'\s+', ' ', text).strip()
    # Remove common preamble words
    for preamble in ['please ', 'briefly ', 'in 1-2 sentences ', 'in a few sentences ']:
        if text.startswith(preamble):
            text = text[len(preamble):]
    return text


def similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, normalize(a), normalize(b)).ratio()


def load_extracted(jsonl_path: str) -> list[dict]:
    rows = []
    with open(jsonl_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                if obj.get('question_text') and obj.get('error') is None:
                    rows.append(obj)
            except json.JSONDecodeError:
                continue
    return rows


def load_archive(csv_path: str | None) -> list[dict]:
    """Load archived_questions from a CSV export or the staging questions file."""
    if not csv_path or not Path(csv_path).exists():
        return []
    rows = []
    with open(csv_path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Accept either format: raw archive export or staging questions CSV
            text = row.get('text') or row.get('matched_question_text') or row.get('question_text', '')
            qid  = row.get('id') or row.get('matched_question_id', '')
            if text:
                rows.append({'id': qid, 'text': text})
    return rows


def find_best_archive_match(question: str, archive: list[dict], threshold: float = 0.55):
    """Find the best matching archived question above the similarity threshold."""
    best_score = 0.0
    best_match = None
    for entry in archive:
        score = similarity(question, entry['text'])
        if score > best_score:
            best_score = score
            best_match = entry
    if best_score >= threshold and best_match:
        return best_match, best_score
    return None, 0.0


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Aggregate question frequency from extraction output')
    parser.add_argument('--input', default='seed/staging/extracted_questions.jsonl')
    parser.add_argument('--archive-csv', default=None, help='CSV of archived_questions (optional)')
    parser.add_argument('--output', default='seed/staging/question_frequency_report.csv')
    parser.add_argument('--min-occurrences', type=int, default=1,
                        help='Only output questions seen this many times or more')
    args = parser.parse_args()

    print(f"Loading extracted questions from {args.input}...")
    extracted = load_extracted(args.input)
    print(f"  {len(extracted)} question rows loaded")

    archive = load_archive(args.archive_csv)
    print(f"  {len(archive)} archived questions loaded for matching")

    # Group by normalized question text
    groups: dict[str, dict] = {}  # normalized → {canonical, programs, variants}
    for row in extracted:
        q = row['question_text'].strip()
        n = normalize(q)
        if n not in groups:
            groups[n] = {
                'normalized': n,
                'variants': Counter(),
                'programs': set(),
                'types': Counter(),
                'platforms': Counter(),
            }
        groups[n]['variants'][q] += 1
        groups[n]['programs'].add(row['slug'])
        groups[n]['types'][row.get('type', 'unknown')] += 1
        groups[n]['platforms'][row.get('platform', 'unknown')] += 1

    # Sort by occurrence count
    sorted_groups = sorted(
        groups.values(),
        key=lambda g: len(g['programs']),
        reverse=True
    )

    print(f"\nTotal unique question variants: {len(groups)}")
    print(f"Questions asked by 2+ programs: {sum(1 for g in sorted_groups if len(g['programs']) >= 2)}")
    print(f"Questions asked by 5+ programs: {sum(1 for g in sorted_groups if len(g['programs']) >= 5)}")
    print(f"\nTop 20 most common questions:")
    for i, g in enumerate(sorted_groups[:20]):
        canonical = g['variants'].most_common(1)[0][0]
        print(f"  {len(g['programs']):3d} programs — {canonical[:70]}")

    # Write output CSV
    fieldnames = [
        'occurrences', 'canonical_question', 'normalized_question',
        'programs', 'types', 'platforms',
        'archive_match_id', 'archive_match_text', 'match_similarity',
        'recommendation',
    ]

    written = 0
    with open(args.output, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for g in sorted_groups:
            count = len(g['programs'])
            if count < args.min_occurrences:
                continue

            canonical = g['variants'].most_common(1)[0][0]
            archive_match, score = find_best_archive_match(canonical, archive)

            if archive_match and score >= 0.80:
                recommendation = 'update_count'  # exists, just update asked_by_count
            elif archive_match and score >= 0.55:
                recommendation = 'review'        # partial match, needs human review
            else:
                recommendation = 'new'           # not in archive, candidate for addition

            writer.writerow({
                'occurrences': count,
                'canonical_question': canonical,
                'normalized_question': g['normalized'],
                'programs': '; '.join(sorted(g['programs'])),
                'types': dict(g['types']),
                'platforms': dict(g['platforms']),
                'archive_match_id': archive_match['id'] if archive_match else '',
                'archive_match_text': archive_match['text'] if archive_match else '',
                'match_similarity': f'{score:.2f}' if score > 0 else '',
                'recommendation': recommendation,
            })
            written += 1

    print(f"\nOutput: {args.output} ({written} rows)")
    print(f"\nRecommendation breakdown:")
    recs: Counter = Counter()
    with open(args.output) as f:
        for row in csv.DictReader(f):
            recs[row['recommendation']] += 1
    for rec, n in recs.most_common():
        print(f"  {rec}: {n}")

    print("""
Next steps:
  1. Review seed/staging/question_frequency_report.csv
  2. For 'update_count' rows: UPDATE archived_questions SET asked_by_count = occurrences WHERE id = archive_match_id
  3. For 'new' rows with occurrences >= 3: consider adding to archived_questions
  4. Run seed/promote-fundingcake-questions.sql to write program_questions rows
""")


if __name__ == '__main__':
    main()
