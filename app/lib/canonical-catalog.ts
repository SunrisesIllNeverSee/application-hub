// M08 canonical catalog — the positive approval registry.
//
// This list is the M08 approval floor: these owner-approved slugs (git
// history of this array = their approval record) always appear on
// approved-only catalog surfaces. Since M09 a row is ALSO approved when it
// carries source='canonical', which only the service-side promotion path
// can set (054 guard triggers + 058 curated publish); no synthetic,
// FundingCake, community, or funder row can become canonical from a client.
export const CANONICAL_PROGRAM_SLUGS: readonly string[] = [
  "yc-summer-2026",
  "founding-500",
  "redbud-vc",
  "cyberfund-monastery",
  "3xcapital",
];

// M09 (058): programs published through the curated promotion pipeline
// (catalog_publish_candidate) carry source='canonical' and are approved by
// that review — every publish is an append-only, curator-attributed event.
// The slug list above stays as a floor: no existing program loses
// visibility, and before 058 is applied the two criteria select the same
// five rows. RLS (052) already limits anon/authenticated reads to
// canonical rows plus a user's own saved programs, so this filter never
// widens what the database exposes.
export const APPROVED_SOURCE = "canonical";

// PostgREST or-filter: slug in the registry OR source = canonical.
export function approvedProgramsFilter(slugs: readonly string[] = CANONICAL_PROGRAM_SLUGS): string {
  const safe = slugs.filter((s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s));
  const parts = [`source.eq.${APPROVED_SOURCE}`];
  if (safe.length) parts.unshift(`slug.in.(${safe.map((s) => `"${s}"`).join(",")})`);
  return parts.join(",");
}

// Narrows a programs query to approved programs (registry floor + curated
// canonical publishes). Applies uniformly — consistent approved-only
// catalog policy (M08 WS7): catalog surfaces are approved-only for every
// user class.
export function restrictToApprovedPrograms<T>(query: T): T {
  const q = query as unknown as { or: (filters: string) => T };
  return q.or(approvedProgramsFilter());
}
