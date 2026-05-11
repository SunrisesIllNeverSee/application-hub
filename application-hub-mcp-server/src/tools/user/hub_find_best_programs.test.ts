import { describe, it, expect } from "vitest";
import {
  rowToRanked,
  passesEquity,
  passesType,
  rankPrograms,
  daysUntil
} from "./hub_find_best_programs.logic.js";

const baseProgram = {
  name: "Seed", slug: "seed", type: "accelerator", status: "open",
  deadline_at: null, equity_pct: 7, cash_value_usd: 125_000,
  program_value_score: 80, is_rolling: false
};

function row(overrides: Partial<any> = {}, programOverrides: Partial<any> = {}) {
  return { fit_score: 75, programs: { ...baseProgram, ...programOverrides }, ...overrides };
}

describe("rowToRanked", () => {
  it("computes composite as fit × program_value / 100", () => {
    const r = rowToRanked(row({ fit_score: 80 }, { program_value_score: 90 }));
    expect(r.composite).toBe(72);
  });

  it("defaults missing fit_score to 0", () => {
    const r = rowToRanked(row({ fit_score: null }));
    expect(r.composite).toBe(0);
  });

  it("defaults missing program_value_score to 50", () => {
    const r = rowToRanked(row({ fit_score: 100 }, { program_value_score: null }));
    expect(r.composite).toBe(50);
  });

  it("unwraps programs when supabase returns an array", () => {
    const r = rowToRanked({ fit_score: 50, programs: [baseProgram] });
    expect(r.name).toBe("Seed");
  });
});

describe("passesEquity", () => {
  it("passes when no cap supplied", () => {
    expect(passesEquity({ equity_pct: 50 }, undefined)).toBe(true);
  });

  it("passes when equity is null (unknown counts as ok)", () => {
    expect(passesEquity({ equity_pct: null }, 5)).toBe(true);
  });

  it("passes when equity is at or below cap", () => {
    expect(passesEquity({ equity_pct: 5 }, 5)).toBe(true);
    expect(passesEquity({ equity_pct: 3 }, 5)).toBe(true);
  });

  it("rejects when equity exceeds cap", () => {
    expect(passesEquity({ equity_pct: 8 }, 5)).toBe(false);
  });
});

describe("passesType", () => {
  it("passes when no type filter", () => {
    expect(passesType({ type: "accelerator" }, undefined)).toBe(true);
  });

  it("passes when type is in the allow list", () => {
    expect(passesType({ type: "accelerator" }, ["accelerator", "grant"])).toBe(true);
  });

  it("rejects when type is not in the allow list", () => {
    expect(passesType({ type: "fellowship" }, ["accelerator", "grant"])).toBe(false);
  });
});

describe("rankPrograms", () => {
  it("sorts by composite descending", () => {
    const rows = [
      row({ fit_score: 50 }, { name: "A", program_value_score: 50 }),
      row({ fit_score: 90 }, { name: "B", program_value_score: 90 }),
      row({ fit_score: 70 }, { name: "C", program_value_score: 60 })
    ];
    const ranked = rankPrograms(rows, undefined, undefined, 5);
    expect(ranked.map((r) => r.name)).toEqual(["B", "C", "A"]);
  });

  it("drops rows with missing programs join", () => {
    const rows = [row(), { fit_score: 99, programs: null }];
    expect(rankPrograms(rows, undefined, undefined, 5)).toHaveLength(1);
  });

  it("applies equity cap", () => {
    const rows = [
      row({}, { name: "A", equity_pct: 3 }),
      row({}, { name: "B", equity_pct: 10 })
    ];
    const ranked = rankPrograms(rows, 5, undefined, 5);
    expect(ranked.map((r) => r.name)).toEqual(["A"]);
  });

  it("applies type filter", () => {
    const rows = [
      row({}, { name: "A", type: "accelerator" }),
      row({}, { name: "B", type: "grant" })
    ];
    const ranked = rankPrograms(rows, undefined, ["grant"], 5);
    expect(ranked.map((r) => r.name)).toEqual(["B"]);
  });

  it("limits results to the requested count", () => {
    const rows = Array.from({ length: 10 }, (_, i) => row({ fit_score: 100 - i }, { name: `P${i}` }));
    expect(rankPrograms(rows, undefined, undefined, 3)).toHaveLength(3);
  });
});

describe("daysUntil", () => {
  const now = new Date("2026-01-01T00:00:00Z").getTime();

  it("returns null when deadline is null", () => {
    expect(daysUntil(null, now)).toBeNull();
  });

  it("counts forward whole days, rounded up", () => {
    expect(daysUntil("2026-01-08T00:00:00Z", now)).toBe(7);
  });

  it("returns negative for past deadlines", () => {
    expect(daysUntil("2025-12-25T00:00:00Z", now)).toBe(-7);
  });
});
