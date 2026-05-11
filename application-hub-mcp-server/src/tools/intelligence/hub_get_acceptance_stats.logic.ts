export type CohortCounts = { accepted: number; rejected: number; waitlist: number };

export type AcceptanceReport = { cohort_round: string | null; outcome: string };

export function tallyOutcome(counts: CohortCounts, outcome: string): void {
  if (outcome === "accepted") counts.accepted++;
  else if (outcome === "rejected") counts.rejected++;
  else if (outcome === "waitlist") counts.waitlist++;
}

export function aggregateByCohort(reports: AcceptanceReport[]): Record<string, CohortCounts> {
  const byCohort: Record<string, CohortCounts> = {};
  for (const r of reports) {
    const label = r.cohort_round ?? "unknown";
    if (!byCohort[label]) byCohort[label] = { accepted: 0, rejected: 0, waitlist: 0 };
    tallyOutcome(byCohort[label], r.outcome);
  }
  return byCohort;
}

export function cohortBreakdown(reports: AcceptanceReport[]): Array<CohortCounts & { label: string }> {
  return Object.entries(aggregateByCohort(reports)).map(([label, counts]) => ({ label, ...counts }));
}

export function reliabilityLabel(total: number): string {
  if (total < 10) return " _(low confidence — fewer than 10 reports)_";
  if (total < 30) return " _(moderate confidence)_";
  return " _(high confidence)_";
}
