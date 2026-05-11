# Portal ToS Audit — V1 Extension Whitelist

_Last updated: 2026-05-11_
_Status: Initial assessment. Requires legal review before shipping the extension publicly._

## Verdict key

| Symbol | Meaning |
|---|---|
| ✅ Green | No language prohibiting form-assistance tools found. Extension likely safe. |
| 🟡 Amber | Ambiguous language or incomplete review. Include with disclosure or defer. |
| 🔴 Red | Explicit prohibition or strong "authentic application" language. Exclude from V1. |
| ⬜ Unaudited | Not yet reviewed. Do not include until audited. |

---

## V1 beta portals

### Y Combinator — apply.ycombinator.com
**Verdict: 🟡 Amber**

YC's application asks explicitly for authentic, founder-written responses. Their
guidance material emphasizes that reviewers are reading for the founder's voice. While
their published ToS (ycombinator.com/legal) does not explicitly prohibit browser
extensions or writing assistance tools, their application guidance creates meaningful
risk:

- YC has historically flagged applications that feel AI-written or templated
- The application portal (apply.ycombinator.com) is a first-party YC system
- If an applicant's account is flagged, consequences could include disqualification

**Recommendation:** Include YC in the extension but with a clear disclosure in the
extension UI: "YC recommends authentic, founder-written responses. Use your saved answers
as a starting point — always review and personalise before submitting." Auto-fill mode
should be disabled for YC by default; Suggest mode only.

**Application URL:** https://apply.ycombinator.com  
**Form type:** Multi-page React SPA with text inputs and textareas

---

### Techstars — application.techstars.com
**Verdict: ✅ Green**

Techstars' published ToS and application materials do not prohibit writing tools or
browser extensions. The application is a standard multi-step form. No unusual anti-bot
protections observed in publicly documented form structure.

**Recommendation:** Include in V1 beta. Both Auto-fill and Suggest modes enabled.

**Application URL:** https://application.techstars.com  
**Form type:** Standard HTML form with `<label>` / `<input>` pairs

---

### a16z Start — starts.a16z.com
**Verdict: ✅ Green**

a16z's published materials do not include language prohibiting writing assistance. The
Start program application is a straightforward form. No ToS language that would restrict
browser extensions found.

**Recommendation:** Include in V1 beta.

**Application URL:** https://starts.a16z.com  
**Form type:** React SPA — may need custom selector extraction. Verify label detection
works before shipping.

---

### 500 Global — 500.co
**Verdict: ✅ Green**

500 Global's ToS does not prohibit writing tools. Application process is generally
considered open. No anti-automation language found in publicly available documentation.

**Recommendation:** Include in V1 beta.

**Application URL:** https://500.co/apply (verify current URL — may redirect to third-party form)  
**Form type:** May use a third-party form platform (Typeform or similar). Check before
building content script — third-party iframe forms require a different extraction approach.

---

### Solofounders — solofounders.xyz
**Verdict: ✅ Green**

Solofounders is a community and accelerator platform specifically targeting solo founders.
Community-oriented platforms of this type typically have permissive application postures.
No restrictive ToS language found.

**Recommendation:** Include in V1 beta.

**Application URL:** Confirm current application URL at solofounders.xyz  
**Form type:** Unknown — requires one-pass review before building content script.

---

## Near-term additions (V1 post-beta)

| Portal | URL | Verdict | Notes |
|---|---|---|---|
| Google for Startups | startup.google.com/programs | ⬜ Unaudited | Google ToS tends to be permissive for user-facing tools |
| Alchemist Accelerator | alchemistaccelerator.com/apply | ⬜ Unaudited | B2B focused, worth adding for enterprise founders |
| MassChallenge | masschallenge.org/apply | ⬜ Unaudited | High volume, diverse programs |
| Antler | antler.co/apply | ⬜ Unaudited | Growing accelerator, global |
| Hustle Fund | hustlefund.vc | ⬜ Unaudited | Early-stage, founder-friendly culture |
| Pear VC | pear.vc | ⬜ Unaudited | Stanford-affiliated, active |
| OnDeck | beondeck.com | ⬜ Unaudited | Community model, likely permissive |
| NSF SBIR | seedfund.nsf.gov | ⬜ Unaudited | Government portal — special handling needed |
| Common App (schools) | commonapp.org | 🔴 Red | Explicit prohibitions on automated assistance for college applications |

---

## Third-party form platforms (cross-portal consideration)

Several portals embed forms from these platforms. Content script logic needs to handle
each separately:

| Platform | Detection | Extraction approach |
|---|---|---|
| Typeform | `typeform.com` in iframe src | Cannot inject into cross-origin iframe. Must intercept at portal level. |
| Tally | `tally.so` in iframe src | Same as Typeform — cross-origin restriction applies |
| JotForm | `jotform.com` in iframe src | Same |
| Airtable Forms | `airtable.com` embed | Same |
| First-party React SPAs | No iframe | Use `aria-label` + MutationObserver for dynamic fields |

**V1 rule:** Only support portals with first-party forms or iframe-free form embeds.
Third-party iframe forms are deferred to V1+.

---

## Ongoing maintenance

Portal forms change. Build a lightweight test suite per portal:
- Monthly headless check that the content script's selectors still resolve to visible
  `<textarea>` and `<input>` elements
- Alert on selector failures before users report broken auto-fill
- Add a "Report broken portal" button in the extension popup that opens a GitHub issue

---

## Legal disclaimer

This audit reflects publicly available ToS documentation as of 2026-05-11. It is not
legal advice. Before a public extension launch, have the portal ToS documents reviewed
by legal counsel. Default to the Suggest mode (user-controlled) rather than Auto-fill
for any portal where ToS language is ambiguous.
