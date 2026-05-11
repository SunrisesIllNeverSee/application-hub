import { describe, it, expect } from "vitest";
import {
  tallyOutcome,
  aggregateByCohort,
  cohortBreakdown,
  reliabilityLabel
} from "./hub_get_acceptance_stats.logic.js";

describe("tallyOutcome", () => {
  it("increments accepted", () => {
    const c = { accepted: 0, rejected: 0, waitlist: 0 };
    tallyOutcome(c, "accepted");
    expect(c).toEqual({ accepted: 1, rejected: 0, waitlist: 0 });
  });

  it("increments rejected", () => {
    const c = { accepted: 0, rejected: 0, waitlist: 0 };
    tallyOutcome(c, "rejected");
    expect(c).toEqual({ accepted: 0, rejected: 1, waitlist: 0 });
  });

  it("increments waitlist", () => {
    const c = { accepted: 0, rejected: 0, waitlist: 0 };
    tallyOutcome(c, "waitlist");
    expect(c).toEqual({ accepted: 0, rejected: 0, waitlist: 1 });
  });

  it("ignores unknown outcomes", () => {
    const c = { accepted: 0, rejected: 0, waitlist: 0 };
    tallyOutcome(c, "withdrew");
    expect(c).toEqual({ accepted: 0, rejected: 0, waitlist: 0 });
  });
});

describe("aggregateByCohort", () => {
  it("groups by cohort_round and tallies outcomes", () => {
    const result = aggregateByCohort([
      { cohort_round: "S26", outcome: "accepted" },
      { cohort_round: "S26", outcome: "accepted" },
      { cohort_round: "S26", outcome: "rejected" },
      { cohort_round: "W26", outcome: "waitlist" }
    ]);
    expect(result).toEqual({
      S26: { accepted: 2, rejected: 1, waitlist: 0 },
      W26: { accepted: 0, rejected: 0, waitlist: 1 }
    });
  });

  it("labels null cohort_round as 'unknown'", () => {
    const result = aggregateByCohort([{ cohort_round: null, outcome: "accepted" }]);
    expect(result.unknown).toEqual({ accepted: 1, rejected: 0, waitlist: 0 });
  });

  it("returns empty object for no reports", () => {
    expect(aggregateByCohort([])).toEqual({});
  });
});

describe("cohortBreakdown", () => {
  it("returns array of cohort objects with label included", () => {
    const result = cohortBreakdown([
      { cohort_round: "S26", outcome: "accepted" },
      { cohort_round: "W26", outcome: "rejected" }
    ]);
    expect(result).toContainEqual({ label: "S26", accepted: 1, rejected: 0, waitlist: 0 });
    expect(result).toContainEqual({ label: "W26", accepted: 0, rejected: 1, waitlist: 0 });
  });
});

describe("reliabilityLabel", () => {
  it("low confidence below 10", () => {
    expect(reliabilityLabel(0)).toContain("low confidence");
    expect(reliabilityLabel(9)).toContain("low confidence");
  });

  it("moderate confidence between 10 and 29", () => {
    expect(reliabilityLabel(10)).toContain("moderate");
    expect(reliabilityLabel(29)).toContain("moderate");
  });

  it("high confidence at 30+", () => {
    expect(reliabilityLabel(30)).toContain("high confidence");
    expect(reliabilityLabel(100)).toContain("high confidence");
  });
});
