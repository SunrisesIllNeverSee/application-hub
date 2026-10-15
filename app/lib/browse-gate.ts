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
