// M08 canonical catalog — the positive approval registry.
//
// This list is THE criterion for "owner-approved canonical application":
// a program appears on approved-only catalog surfaces if and only if its
// slug is listed here AND its production row carries source='canonical'
// (inserted by the gated promotion migration). Slugs are added in the same
// commit as the promotion data once the owner approves a QA-application
// record — the git history of this array IS the approval record.
//
// Empty today = no synthetic, FundingCake, community, or funder row can
// ever become public merely because its source enum changes.
export const CANONICAL_PROGRAM_SLUGS: readonly string[] = [
  "yc-summer-2026",
  "founding-500",
  "redbud-vc",
  "cyberfund-monastery",
  "3xcapital",
];

// Never-matches sentinel for empty registries (keeps the query well-formed
// without hardcoding a real program id).
const NO_PROGRAM_ID = "00000000-0000-0000-0000-000000000000";

// Narrows a programs query to the owner-approved canonical set.
// Applies uniformly — consistent approved-only catalog policy (M08 WS7):
// catalog surfaces are approved-only for every user class.
export function restrictToApprovedPrograms<T>(query: T): T {
  const q = query as unknown as {
    in: (c: string, v: readonly string[]) => T;
    eq: (c: string, v: string) => T;
  };
  if (CANONICAL_PROGRAM_SLUGS.length === 0) return q.eq("id", NO_PROGRAM_ID);
  return q.in("slug", CANONICAL_PROGRAM_SLUGS);
}
