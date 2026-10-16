// M08-PRD-003 (owner d4b) + M08-PRD-004 (owner d5): the catalog surface is
// readable by unauthenticated guests and un-onboarded signed-in users.
// Deliberate scope (owner: "browse real public programs, inspect program
// details, deadlines and eligibility"):
//   - /applications              discover catalog
//   - /applications/<slug>       program detail
//   - /applications/timeline     public program/deadline view (within
//                                "inspect deadlines"; page serves public
//                                program data only, no user queries)
// Everything else — /applications/submit, workspaces, vault, and all other
// protected surfaces — still requires auth (and onboarding for signed-in).
export function isBrowseOnlyPath(pathname: string): boolean {
  return (
    pathname === "/applications" ||
    (pathname.startsWith("/applications/") &&
      !pathname.startsWith("/applications/submit"))
  );
}

// Approved-only public catalog (M08-PRD-003 / WS7).
// Every program_source value that is NOT an owner-approved canonical record.
// Expressed as an exhaustive denylist so it behaves as an allowlist today:
// with prod 100% 'seeded' this yields zero rows, and only rows whose source
// is a FUTURE value (e.g. 'canonical', added by the promotion migration)
// ever pass. 'fundingcake' is explicitly excluded — that dataset was barred
// from the canonical catalog by owner directive.
export const NON_APPROVED_PROGRAM_SOURCES = [
  "seeded",
  "fundingcake",
  "community",
  "funder",
] as const;

// Narrows a programs query to the owner-approved set. Only correct callers:
// public surfaces — guests and un-onboarded signed-in users.
export function restrictToApprovedPrograms<Q extends { neq: (c: string, v: string) => Q }>(
  query: Q,
): Q {
  let q = query;
  for (const s of NON_APPROVED_PROGRAM_SOURCES) q = q.neq("source", s);
  return q;
}
