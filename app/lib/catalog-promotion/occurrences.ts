// Template revisions (058) keep superseded occurrences for history (and for
// answers already linked to them). Catalog surfaces show the CURRENT
// template only. Filtering client-side keeps reads working before 058 is
// applied (the column is simply absent on select('*') rows).

export function isCurrentOccurrence(row: object): boolean {
  return (row as { superseded_by_revision_id?: string | null }).superseded_by_revision_id == null
}

export function currentOccurrences<T extends object>(rows: T[] | null | undefined): T[] {
  return (rows ?? []).filter(isCurrentOccurrence)
}
