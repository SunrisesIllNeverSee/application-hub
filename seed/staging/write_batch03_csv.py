#!/usr/bin/env python3
"""Write batch_03 CSV with manually-verified apply URLs."""

import csv
import json

OUTPUT_FILE = "/Users/dericmchenry/Desktop/application-hub/seed/staging/apply_url_results/batch_03.csv"
BATCH_FILE = "/Users/dericmchenry/Desktop/application-hub/seed/staging/batches/batch_03.json"

# Load programs for reference
with open(BATCH_FILE) as f:
    programs = {p['slug']: p for p in json.load(f)}

# All 79 results based on scraping + manual research
# Format: (slug, discovered_apply_url, confidence, notes)
RESULTS = [
    # --- L ---
    ("launch-ny",
     "https://launchny.org/entrepreneurs/apply-now",
     "high",
     "Explicit 'Apply Now' link in nav and multiple CTAs"),

    ("launchpad-for-women-entrepreneurs",
     "https://www.launchpadforwomen.ca/courses",
     "medium",
     "Thinkific platform; enroll via course listing page; no dedicated /apply page"),

    ("launchpad-la",
     "https://launchpad.la/apply/",
     "high",
     "Direct /apply path in nav"),

    ("startup-lab",
     "",
     "not_found",
     "WLU Laurier StartUp Lab; page is informational only, no apply link found"),

    ("le-pont-quebec",
     "https://lepont.io/en/apply",
     "high",
     "Direct /apply link in nav"),

    ("lead-to-win",
     "",
     "not_found",
     "Site returned Cloudflare error (522); no apply link reachable"),

    ("league-of-innovators",
     "https://www.loi.ac/find-your-program",
     "high",
     "Explicit 'APPLY NOW - it's free' CTA linking to program finder; Airtable form embedded"),

    ("learnlaunch-accelerator",
     "",
     "not_found",
     "Homepage shows news; no active /apply page found; applications announced via blog"),

    ("legal-innovation-zone",
     "https://www.torontomu.ca/zone-learning/legal-innovation-zone/apply/",
     "high",
     "Dedicated /apply page in nav"),

    ("life-changing-labs-accelerator",
     "",
     "not_found",
     "Homepage is portfolio showcase; no apply link visible"),

    ("liftoff",
     "",
     "not_found",
     "sdgideafactory.ca/join-us link found but is about coworking space, not accelerator apply"),

    ("longo-centre-for-entrepreneurship",
     "https://humber.ca/cfe/programs.html",
     "medium",
     "Programs listing page; no dedicated external apply link; likely internal enrollment"),

    ("mars-discovery-district",
     "https://marsdd.com/apply",
     "high",
     "Direct /apply link found in HTML"),

    ("mc2-capital",
     "https://www.cabhi.com/en/innovation-programs-services/acceleration-services",
     "low",
     "MC2 Capital page redirects to CABHI; Acceleration Services page has program info but no direct apply link"),

    ("mcneil-center-for-entrepreneurship-innovation",
     "",
     "not_found",
     "innovation.mines.edu is a news/info page; Beck Venture Center apply surface not found on scraped page"),

    ("mediatech-ventures",
     "",
     "not_found",
     "LinkedIn company page only; no apply surface"),

    ("menlo-ventures",
     "",
     "not_found",
     "VC firm homepage; no public apply form for founders"),

    ("metaprop",
     "https://www.metaprop.com/partner-with-us",
     "low",
     "Partner With Us page exists but no form found; likely intake via contact"),

    ("mhub",
     "https://www.mhubchicago.com/accelerator-program-interest",
     "high",
     "Explicit accelerator interest/apply form link found on accelerator sub-pages"),

    ("mit-global-startup-labs",
     "",
     "not_found",
     "gsl.mit.edu returned empty/no-content response; site may be down or JS-only"),

    ("mit-office-of-innovation",
     "",
     "not_found",
     "innovation.mit.edu is informational; no apply surface for external founders"),

    ("mitacs-canada",
     "https://www.mitacs.ca/get-started/",
     "medium",
     "'Unleash Your Innovation Potential' CTA links to /get-started; research funding intake"),

    ("mmode",
     "https://docs.google.com/forms/d/e/1FAIpQLScHrXWvGy2JRK4QbyaITR9QmESblcaJaJoJW2j7aML1Eifziw/viewform",
     "medium",
     "Google Form linked from event on homepage; industry network not accelerator apply per se"),

    ("mtlab",
     "https://mtlab.ca/nos-programmes/",
     "low",
     "French-language tourism tech incubator; no direct apply link; programs listing page"),

    ("mucker-lab",
     "https://mucker.com/accelerator/",
     "medium",
     "Embedded pitch/apply form visible on /accelerator page (pitch deck required fields)"),

    ("nar-reach",
     "https://www.nar-reach.com/apply",
     "high",
     "Explicit APPLY link in navigation"),

    ("new-inc",
     "https://www.newinc.org/apply",
     "high",
     "newinc.org/apply redirects to newmuseum.org/new-inc/open-call/; open call application page"),

    ("new-ventures-bc",
     "https://nvbc.typeform.com/to/vboBF4Gr",
     "high",
     "Typeform apply link found on AI Business Accelerator program page"),

    ("nex-cubed",
     "",
     "not_found",
     "Facebook company page only; no apply surface"),

    ("next-canada",
     "",
     "not_found",
     "Site JS-rendered; no apply links extractable from HTML; programs overview page found but no apply CTA"),

    ("north-shore-innoventures",
     "",
     "not_found",
     "nsiv.org returned empty response; site unreachable"),

    ("nyu-tandon-future-labs",
     "https://futurelabs.nyc/programs/",
     "low",
     "Programs listing page found but no direct apply links on individual program pages"),

    ("on-deck",
     "",
     "not_found",
     "beondeck.com returned Cloudflare error code 522; site unreachable"),

    ("oneeleven",
     "",
     "not_found",
     "Site timed out during scrape; no content retrievable"),

    ("onetech",
     "",
     "not_found",
     "weareonetech.org scraped but no apply links found; community org"),

    ("ontario-centre-of-innovation",
     "",
     "not_found",
     "oc-innovation.ca scraped; only Bizzabo event link found; no accelerator apply page"),

    ("organic-food-incubator",
     "",
     "not_found",
     "organicfoodincubator.com scraped; no apply links found on homepage"),

    ("outlier-ventures",
     "https://outlierventures.io/base-camp/",
     "low",
     "Base Camp accelerator program page exists; apply link not extractable from JS-rendered site"),

    ("oxygen-accelerator",
     "https://www.oxygenaccelerator.com/cee-startups-apply-now-to-oxygen-accelerator/",
     "medium",
     "Blog post with 'apply now' in URL found; may be outdated cohort announcement"),

    ("parkdale-centre-for-innovation",
     "",
     "not_found",
     "parkdaleinnovates.org returned only 1.6KB; likely redirect/error page"),

    ("pfizer-healthcare-hub",
     "",
     "not_found",
     "pfizer.co.uk/partnerships page only has internal links; no founder apply surface"),

    ("pioneer",
     "",
     "not_found",
     "Pioneer.app explicitly states 'We're no longer making new investments'; program closed"),

    ("pioneer-square-labs",
     "",
     "not_found",
     "Twitter/X profile only; no apply surface"),

    ("platform-calgary",
     "",
     "not_found",
     "platformcalgary.com/events/submit is event submission, not accelerator apply"),

    ("plug-and-play-tech-center",
     "https://www.plugandplaytechcenter.com/join/",
     "low",
     "JS-rendered Angular app; /join path likely exists based on site structure; not confirmed"),

    ("polsky-institute",
     "https://polsky.uchicago.edu/polsky-deep-tech-ventures/",
     "low",
     "Deep Tech Ventures program page found; no direct apply link visible on scraped content"),

    ("praxis-center-for-venture-development",
     "https://pcvd.cornell.edu/",
     "low",
     "Cornell PCVD homepage linked from eship.cornell.edu; no direct apply link found"),

    ("qb3",
     "https://qb3.org/early-stage-mentoring/",
     "low",
     "Early-stage mentoring page found; no dedicated apply CTA"),

    ("reach",
     "https://nar-reach.com/apply",
     "high",
     "NAR REACH US - same apply portal as nar-reach.com"),

    ("reach-canada",
     "https://nar-reach.com/apply",
     "high",
     "REACH Canada apply page on nar-reach.com"),

    ("reach-uk",
     "https://nar-reach.com/apply",
     "high",
     "REACH UK apply page on nar-reach.com"),

    ("redhawk-launch-accelerator",
     "",
     "not_found",
     "miamioh.edu page links to general admission apply; not accelerator-specific apply"),

    ("rev-ithaca-startup-works",
     "https://www.revithaca.com/join-rev/",
     "medium",
     "Explicit 'Join REV' apply page found"),

    ("rice-alliance-for-technology-and-entrepreneurship",
     "https://business.rice.edu/apply",
     "medium",
     "General Rice business school /apply path; may be MBA admission not accelerator"),

    ("rocky-mountain-microfinance-institute",
     "https://rmmfi.org/business-programs/",
     "medium",
     "Business Programs page with Business Idea Lab and Boot Camp intake described; no direct apply form URL"),

    ("rogers-cybersecure-catalyst",
     "https://cybersecurecatalyst.ca/programs-and-services/",
     "medium",
     "Programs & Services listing page found; apply links for specific programs need further navigation"),

    ("roseview-global-incubator",
     "https://roseviewglobal.com/programs/",
     "low",
     "Programs page exists; no apply link extractable from JS-rendered site"),

    ("science-discovery-zone",
     "https://www.torontomu.ca/zone-learning/sdz/get-involved/",
     "medium",
     "'Get Involved' page found on TMU SDZ site"),

    ("seneca-helix",
     "",
     "not_found",
     "senecacollege.ca/innovation/helix.html scraped; only general college apply link found (international admissions); no HELIX-specific apply"),

    ("sequoia-capital",
     "https://www.sequoiacap.com/arc/apply",
     "high",
     "Sequoia Arc accelerator has dedicated /arc/apply page"),

    ("sheboot",
     "https://sheboot.ca/for-founders/",
     "medium",
     "'For Founders' page found; sheboot.ca is Wix site; apply surface likely on this page"),

    ("sheridan-edge",
     "https://www.surveymonkey.com/r/Student_ProgramInterestForm",
     "medium",
     "SurveyMonkey interest form linked from Sheridan EDGE programs page"),

    ("sku",
     "https://sku.is/apply/",
     "high",
     "Direct /apply link in nav and multiple CTAs"),

    ("small-foundation",
     "",
     "not_found",
     "smallfoundation.ie scraped; no apply/grant application links found for founders"),

    ("social-venture-zone",
     "https://www.torontomu.ca/svz/apply/",
     "high",
     "Dedicated /svz/apply/ page found"),

    ("spinup",
     "https://spinup.utm.utoronto.ca/programming/",
     "low",
     "Programming page found; no direct apply form; UTM SpinUp is university program"),

    ("sputnik-atx-vc",
     "https://gust.com/programs/sputnik-atx-vc-summer-2026",
     "high",
     "Gust platform apply link displayed prominently on homepage"),

    ("starburst-aerospace",
     "https://starburst.aero/accelerator-program/",
     "medium",
     "Accelerator program page found; apply form not extractable from static scrape"),

    ("start-alberta",
     "",
     "not_found",
     "startalberta.ca is an ecosystem directory/resource site; no accelerator apply surface"),

    ("startshea",
     "https://www.startatshea.com/accelerate-shea",
     "medium",
     "Accelerate@Shea program page found on Wix site; apply form likely JS-rendered"),

    ("started",
     "https://www.started.com/apply",
     "high",
     "Direct /apply page found in HTML hrefs"),

    ("startgbc",
     "",
     "not_found",
     "startgbc.com appears to be a generic blog site, not George Brown College startup program; no apply links"),

    ("startup-calgary",
     "",
     "not_found",
     "startupcalgary.ca/events/submit is event submission, not startup apply; no accelerator apply page found"),

    ("startup-fiu",
     "",
     "not_found",
     "startup.fiu.edu is informational site; no apply links in scraped HTML"),

    ("startup-garage",
     "https://startupgarage.ca/apply-now",
     "high",
     "Direct /apply-now href found multiple times"),

    ("startup-health",
     "https://www.startuphealth.com/apply-now",
     "high",
     "Explicit /apply-now href found in HTML"),

    ("startup-montreal",
     "",
     "not_found",
     "startupmontreal.com/en/home returns 404; site appears moved or offline"),

    ("startup-school",
     "https://www.startupschool.org/users/sign_in?sign_up=true",
     "high",
     "YC Startup School is free online course; sign-up page is the apply surface"),

    ("startupboot-camp",
     "",
     "not_found",
     "URL /accelerator/fintech-new-york returns 404 on Webflow site; program page not found"),
]

# Verify we have all 79
batch_slugs = list(programs.keys())
result_slugs = [r[0] for r in RESULTS]
missing = set(batch_slugs) - set(result_slugs)
extra = set(result_slugs) - set(batch_slugs)
if missing:
    print(f"WARNING: Missing slugs: {missing}")
if extra:
    print(f"WARNING: Extra slugs: {extra}")

# Read existing CSV to check header
with open(OUTPUT_FILE, 'r') as f:
    existing = f.read().strip()

# Only has header row (written at start)
if existing == "slug,name,type,homepage_url,discovered_apply_url,confidence,notes":
    print("Header only, appending all 79 rows...")
else:
    # Check how many data rows exist
    lines = existing.split('\n')
    print(f"File has {len(lines)} lines (including header)")
    if len(lines) > 1:
        print("ERROR: File already has data rows. Not overwriting.")
        print("To proceed, clear data rows first.")
        exit(1)

with open(OUTPUT_FILE, 'a', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    for slug, apply_url, confidence, notes in RESULTS:
        prog = programs[slug]
        writer.writerow([
            slug,
            prog['name'],
            prog['type'],
            prog['url'],
            apply_url,
            confidence,
            notes,
        ])

print(f"Wrote {len(RESULTS)} rows.")

# Summary
from collections import Counter
conf_counts = Counter(r[2] for r in RESULTS)
for k in ['high', 'medium', 'low', 'not_found', 'error']:
    if k in conf_counts:
        print(f"  {k}: {conf_counts[k]}")
