#!/usr/bin/env python3
"""Extract apply URLs for batch_03 programs from scraped files."""

import re
import os
import json
import csv

SCRAPED_DIR = "/Users/dericmchenry/Desktop/application-hub/seed/staging/.firecrawl/batch03/.firecrawl"
BATCH_FILE = "/Users/dericmchenry/Desktop/application-hub/seed/staging/batches/batch_03.json"
OUTPUT_FILE = "/Users/dericmchenry/Desktop/application-hub/seed/staging/apply_url_results/batch_03.csv"

# Patterns that indicate a real application surface
APPLY_URL_PATTERNS = re.compile(
    r'/apply(?:-now|-here|-today|-online)?(?:/|$|\?)|'
    r'/application(?:s)?(?:/|$|\?)|'
    r'/start-application|'
    r'/register(?:/program|/accelerator|/cohort|/apply)?(?:/|$|\?)|'
    r'/nominate(?:s)?(?:/|$|\?)|'
    r'/intake(?:/|$|\?)|'
    r'/get-started(?:/apply)?(?:/|$|\?)|'
    r'/join(?:-us|-program|-accelerator|-cohort)?(?:/|$|\?)|'
    r'/submit(?:-application)?(?:/|$|\?)',
    re.IGNORECASE
)

# Exclude patterns (not real apply surfaces)
EXCLUDE_PATTERNS = re.compile(
    r'\.css|\.js|\.png|\.jpg|\.gif|\.svg|\.pdf|\.webp|\.woff|\.ico|'
    r'javascript:|mailto:|tel:|#[^/]|'
    r'linkedin\.com(?!/company/mediatech)|twitter\.com|facebook\.com|instagram\.com|youtube\.com|'
    r'google\.com|maps\.|analytics\.|fonts\.',
    re.IGNORECASE
)

# High-confidence apply link text patterns
APPLY_TEXT_PATTERNS = re.compile(
    r'\b(apply\s*(now|here|today|online)?|start\s+application|submit\s+application|'
    r'apply\s+to\s+(the\s+)?(program|accelerator|cohort)|get\s+started|'
    r'start\s+your\s+application|apply\s+for\s+funding|'
    r'apply\s+for\s+our\s+program|register\s+now|nominate\s+now)\b',
    re.IGNORECASE
)

def extract_urls_from_markdown(content):
    """Extract URLs from Firecrawl markdown format."""
    # Markdown links: [text](url)
    md_links = re.findall(r'\[([^\]]*)\]\((https?://[^\s\)]+)\)', content)
    # Plain URLs
    plain_urls = re.findall(r'(https?://[^\s\)\"<>\]\[]+)', content)
    return md_links, plain_urls

def extract_urls_from_html(content):
    """Extract URLs from HTML."""
    # href attributes
    hrefs = re.findall(r'href=["\']([^"\']+)["\']', content, re.IGNORECASE)
    # Get link text + href pairs
    link_pairs = re.findall(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>([^<]{0,100})</a>', content, re.IGNORECASE)
    return hrefs, link_pairs

def normalize_url(url, base_url):
    """Make relative URLs absolute."""
    url = url.strip()
    if url.startswith('//'):
        return 'https:' + url
    if url.startswith('/'):
        # Extract base domain
        match = re.match(r'(https?://[^/]+)', base_url)
        if match:
            return match.group(1) + url
    if url.startswith('http'):
        return url
    return None

def score_apply_url(url, link_text=''):
    """Return (is_apply, confidence_score, reason)."""
    if EXCLUDE_PATTERNS.search(url):
        return False, 0, ''

    url_lower = url.lower()
    text_lower = link_text.lower().strip()

    # High confidence: URL has /apply pattern AND text matches
    has_apply_url = bool(APPLY_URL_PATTERNS.search(url_lower))
    has_apply_text = bool(APPLY_TEXT_PATTERNS.search(text_lower))

    if has_apply_url and has_apply_text:
        return True, 3, 'url+text match'
    if has_apply_url:
        return True, 2, 'url pattern match'
    if has_apply_text and ('typeform' in url_lower or 'airtable' in url_lower or
                           'forms.gle' in url_lower or 'jotform' in url_lower or
                           'fillout' in url_lower or 'tally.so' in url_lower or
                           'surveymonkey' in url_lower or 'submittable' in url_lower or
                           'f6s.com' in url_lower or 'wufoo' in url_lower):
        return True, 3, 'form platform + apply text'
    if has_apply_text:
        return True, 1, 'text match only'
    return False, 0, ''

def find_apply_url(slug, homepage_url, file_path, is_html=False):
    """Main function to find apply URL from scraped content."""
    if not os.path.exists(file_path):
        return None, 'not_found', 'file not found'

    file_size = os.path.getsize(file_path)
    if file_size < 200:
        return None, 'not_found', 'empty response'

    with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    candidates = []  # (url, score, reason, text)

    if is_html:
        hrefs, link_pairs = extract_urls_from_html(content)
        # Process href+text pairs
        for href, text in link_pairs:
            url = normalize_url(href, homepage_url)
            if url:
                is_apply, score, reason = score_apply_url(url, text)
                if is_apply:
                    candidates.append((url, score, reason, text.strip()))
        # Also check bare hrefs
        for href in hrefs:
            url = normalize_url(href, homepage_url)
            if url:
                is_apply, score, reason = score_apply_url(url)
                if is_apply and not any(c[0] == url for c in candidates):
                    candidates.append((url, score, reason, ''))
    else:
        # Markdown format
        md_links, plain_urls = extract_urls_from_markdown(content)
        for text, url in md_links:
            is_apply, score, reason = score_apply_url(url, text)
            if is_apply:
                candidates.append((url, score, reason, text.strip()))
        for url in plain_urls:
            is_apply, score, reason = score_apply_url(url)
            if is_apply and not any(c[0] == url for c in candidates):
                candidates.append((url, score, reason, ''))

    if not candidates:
        return None, 'not_found', 'no apply links found'

    # Sort by score descending
    candidates.sort(key=lambda x: x[1], reverse=True)
    best = candidates[0]
    url, score, reason, text = best

    if score >= 3:
        confidence = 'high'
    elif score == 2:
        confidence = 'medium'
    else:
        confidence = 'low'

    notes = reason
    if text:
        notes += f'; link text: "{text[:50]}"'

    return url, confidence, notes

# Map slugs to their file paths
def get_file_path(slug, homepage_url):
    """Return (file_path, is_html) for a given slug."""
    base = SCRAPED_DIR

    # Firecrawl markdown files (already scraped)
    fc_map = {
        'launch-ny': ('launchny.org.md', False),
        'launchpad-for-women-entrepreneurs': ('launchpadforwomen.ca.md', False),
        'launchpad-la': ('launchpad.la.md', False),
        'startup-lab': ('students.wlu.ca-work-leadership-and-volunteering-entrepreneurship-startup-lab-index.html.md', False),
        'le-pont-quebec': ('lepont.io-en-home.md', False),
        'lead-to-win': ('curl-leadtowin.html', True),
        'league-of-innovators': ('theleagueofinnovators.org.md', False),
        'learnlaunch-accelerator': ('learnlaunch.com-accelerator-2.md', False),
        'legal-innovation-zone': ('torontomu.ca-zone-learning-legal-innovation-zone.md', False),
        'life-changing-labs-accelerator': ('lifechanginglabs.com.md', False),
        'liftoff': ('liftoffbyccawr.com.md', False),
        'longo-centre-for-entrepreneurship': ('humber.ca-cfe.md', False),
        'mars-discovery-district': ('curl-marsdd.html', True),
        'mc2-capital': ('cabhi.com-mc2capital.md', False),
        'mcneil-center-for-entrepreneurship-innovation': ('innovation.mines.edu.md', False),
        'mediatech-ventures': ('curl-mediatech.html', True),
        'menlo-ventures': ('menlovc.com.md', False),
        'metaprop': ('metaprop.vc.md', False),
        'mhub': ('mhubchicago.com-accelerator.md', False),
        'mit-global-startup-labs': ('curl-gsl-mit.html', True),
        'mit-office-of-innovation': ('innovation.mit.edu.md', False),
        'mitacs-canada': ('mitacs.ca-en.md', False),
        'mmode': ('mmode.ca.md', False),
        'mtlab': ('mtlab.ca.md', False),
        'mucker-lab': ('mucker.com.md', False),
        'nar-reach': ('nar-reach.com.md', False),
        'new-inc': ('newinc.org.md', False),
        'new-ventures-bc': ('newventuresbc.com.md', False),
        'nex-cubed': ('curl-nex-cubed.html', True),
        'next-canada': ('curl-nextcanada.html', True),
        'north-shore-innoventures': ('nsiv.org.md', False),
        'nyu-tandon-future-labs': ('curl-futurelabs.html', True),
        'on-deck': ('beondeck.com.md', False),
        'oneeleven': ('curl-oneeleven.html', True),
        'onetech': ('weareonetech.org.md', False),
        'ontario-centre-of-innovation': ('curl-oc-innovation.html', True),
        'organic-food-incubator': ('curl-organicfood.html', True),
        'outlier-ventures': ('outlierventures.io.md', False),
        'oxygen-accelerator': ('curl-oxygen.html', True),
        'parkdale-centre-for-innovation': ('curl-parkdale.html', True),
        'pfizer-healthcare-hub': ('curl-pfizer.html', True),
        'pioneer': ('curl-pioneer.html', True),
        'pioneer-square-labs': ('curl-pioneer-square.html', True),
        'platform-calgary': ('curl-platformcalgary.html', True),
        'plug-and-play-tech-center': ('curl-plugandplay.html', True),
        'polsky-institute': ('curl-polsky.html', True),
        'praxis-center-for-venture-development': ('curl-praxis.html', True),
        'qb3': ('curl-qb3.html', True),
        'reach': ('curl-reach.html', True),
        'reach-canada': ('curl-reach-canada.html', True),
        'reach-uk': ('curl-reach-uk.html', True),
        'redhawk-launch-accelerator': ('curl-redhawk.html', True),
        'rev-ithaca-startup-works': ('curl-rev-ithaca.html', True),
        'rice-alliance-for-technology-and-entrepreneurship': ('curl-rice.html', True),
        'rocky-mountain-microfinance-institute': ('curl-rocky.html', True),
        'rogers-cybersecure-catalyst': ('curl-rogers.html', True),
        'roseview-global-incubator': ('curl-roseview.html', True),
        'science-discovery-zone': ('curl-science-discovery.html', True),
        'seneca-helix': ('curl-seneca.html', True),
        'sequoia-capital': ('curl-sequoia.html', True),
        'sheboot': ('curl-sheboot.html', True),
        'sheridan-edge': ('curl-sheridan.html', True),
        'sku': ('curl-sku.html', True),
        'small-foundation': ('curl-small-foundation.html', True),
        'social-venture-zone': ('curl-social-venture.html', True),
        'spinup': ('curl-spinup.html', True),
        'sputnik-atx-vc': ('curl-sputnik.html', True),
        'starburst-aerospace': ('curl-starburst.html', True),
        'start-alberta': ('curl-start-alberta.html', True),
        'startshea': ('curl-startshea.html', True),
        'started': ('curl-started.html', True),
        'startgbc': ('curl-startgbc.html', True),
        'startup-calgary': ('curl-startup-calgary.html', True),
        'startup-fiu': ('curl-startup-fiu.html', True),
        'startup-garage': ('curl-startup-garage.html', True),
        'startup-health': ('curl-startup-health.html', True),
        'startup-montreal': ('curl-startup-montreal.html', True),
        'startup-school': ('curl-startup-school.html', True),
        'startupboot-camp': ('curl-startupbootcamp.html', True),
    }

    if slug in fc_map:
        fname, is_html = fc_map[slug]
        return os.path.join(base, fname), is_html

    return None, False

# Social media slugs - can't extract apply links from these
SOCIAL_MEDIA_SLUGS = {
    'mediatech-ventures': ('https://www.linkedin.com/company/mediatech-ventures', 'LinkedIn company page - no apply surface'),
    'nex-cubed': ('https://www.facebook.com/nexcubed', 'Facebook page - no apply surface'),
    'pioneer-square-labs': ('https://twitter.com/psl', 'Twitter/X profile - no apply surface'),
}

def main():
    with open(BATCH_FILE) as f:
        programs = json.load(f)

    rows = []

    for prog in programs:
        slug = prog['slug']
        name = prog['name']
        ptype = prog['type']
        homepage_url = prog['url']

        # Handle social media URLs specially
        if slug in SOCIAL_MEDIA_SLUGS:
            _, notes = SOCIAL_MEDIA_SLUGS[slug]
            rows.append({
                'slug': slug,
                'name': name,
                'type': ptype,
                'homepage_url': homepage_url,
                'discovered_apply_url': '',
                'confidence': 'not_found',
                'notes': notes,
            })
            continue

        file_path, is_html = get_file_path(slug, homepage_url)

        if file_path is None:
            rows.append({
                'slug': slug,
                'name': name,
                'type': ptype,
                'homepage_url': homepage_url,
                'discovered_apply_url': '',
                'confidence': 'error',
                'notes': 'no file mapping found',
            })
            continue

        apply_url, confidence, notes = find_apply_url(slug, homepage_url, file_path, is_html)

        rows.append({
            'slug': slug,
            'name': name,
            'type': ptype,
            'homepage_url': homepage_url,
            'discovered_apply_url': apply_url or '',
            'confidence': confidence,
            'notes': notes,
        })

        print(f"[{confidence:10s}] {slug}: {apply_url or 'NOT FOUND'}")

    # Write CSV (append mode, header already exists)
    with open(OUTPUT_FILE, 'a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        for row in rows:
            writer.writerow([
                row['slug'],
                row['name'],
                row['type'],
                row['homepage_url'],
                row['discovered_apply_url'],
                row['confidence'],
                row['notes'],
            ])

    print(f"\nWrote {len(rows)} rows to {OUTPUT_FILE}")

    # Summary
    from collections import Counter
    conf_counts = Counter(r['confidence'] for r in rows)
    for k, v in sorted(conf_counts.items()):
        print(f"  {k}: {v}")

if __name__ == '__main__':
    main()
