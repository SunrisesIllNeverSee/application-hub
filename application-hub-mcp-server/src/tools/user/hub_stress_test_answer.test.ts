import { describe, it, expect, vi } from "vitest";

// Mock all side-effectful dependencies before importing the module under test
vi.mock("../../services/supabase.js", () => ({
  supabase: {},
  userClient: () => ({})
}));
vi.mock("../../services/auth.js", () => ({
  validateUserToken: vi.fn()
}));
vi.mock("../../constants.js", () => ({
  CHARACTER_LIMIT: 100_000,
  ResponseFormat: { MARKDOWN: "markdown", JSON: "json" }
}));

import { followUpCount, compactSignals, buildFollowUps } from "./hub_stress_test_answer.js";

describe("followUpCount", () => {
  it("returns 3 for light", () => {
    expect(followUpCount("light")).toBe(3);
  });

  it("returns 4 for medium", () => {
    expect(followUpCount("medium")).toBe(4);
  });

  it("returns 5 for deep", () => {
    expect(followUpCount("deep")).toBe(5);
  });
});

describe("compactSignals", () => {
  it("extracts dollar amounts (captures numeric portion, not the $ sign)", () => {
    // The regex uses \b which sits before \$? — so the $ prefix is excluded from the match.
    // $2,000,000 captures as "2,000,000"; $500 captures as "500".
    const result = compactSignals("We raised $2,000,000 in our last round and $500 before that.");
    expect(result.numeric_claims).toContain("2,000,000");
    expect(result.numeric_claims).toContain("500");
  });

  it("extracts percentages (captures numeric portion without %)", () => {
    // The regex has %? but \b follows — % is not a word character, so \b fires between
    // the digit and %, meaning % is NOT included in the captured match.
    const result = compactSignals("We grew 40% month-over-month with 95% retention.");
    expect(result.numeric_claims).toContain("40");
    expect(result.numeric_claims).toContain("95");
  });

  it("extracts multipliers like 3x", () => {
    const result = compactSignals("Revenue increased 3x and user count grew 10x.");
    expect(result.numeric_claims).toContain("3x");
    expect(result.numeric_claims).toContain("10x");
  });

  it("extracts https URLs", () => {
    const result = compactSignals("Check our metrics at https://example.com/dashboard and https://metrics.io.");
    expect(result.likely_urls).toContain("https://example.com/dashboard");
    expect(result.likely_urls).toContain("https://metrics.io.");
  });

  it("counts words correctly", () => {
    const result = compactSignals("one two three four five");
    expect(result.word_count_estimate).toBe(5);
  });

  it("handles empty string", () => {
    const result = compactSignals("");
    expect(result.word_count_estimate).toBe(0);
    expect(result.numeric_claims).toHaveLength(0);
    expect(result.likely_urls).toHaveLength(0);
  });

  it("caps numeric_claims at 12", () => {
    // Build a string with 20 numbers
    const text = Array.from({ length: 20 }, (_, i) => `${i + 1}%`).join(" ");
    const result = compactSignals(text);
    expect(result.numeric_claims.length).toBeLessThanOrEqual(12);
  });

  it("caps likely_urls at 5", () => {
    // Build a string with 10 URLs
    const text = Array.from({ length: 10 }, (_, i) => `https://site${i}.com`).join(" ");
    const result = compactSignals(text);
    expect(result.likely_urls.length).toBeLessThanOrEqual(5);
  });
});

describe("buildFollowUps", () => {
  it("returns 3 follow-ups for light depth", () => {
    const result = buildFollowUps(null, [], "light");
    expect(result).toHaveLength(3);
  });

  it("returns 4 follow-ups for medium depth when enough templates exist", () => {
    // traction has 3 theme-specific items + 3 general = 6 total, so medium (4) is achievable
    const result = buildFollowUps("traction", [], "medium");
    expect(result).toHaveLength(4);
  });

  it("returns 5 follow-ups for deep depth when enough templates exist", () => {
    // traction (3) + market (2) + 3 general = 8 total, so deep (5) is achievable
    const result = buildFollowUps("traction", ["market"], "deep");
    expect(result).toHaveLength(5);
  });

  it("caps at available templates when fewer than depth count exist", () => {
    // null theme + empty DNA = only 3 GENERAL_FOLLOW_UPS; medium wants 4 but gets 3
    const result = buildFollowUps(null, [], "medium");
    expect(result).toHaveLength(3);
  });

  it("includes theme-specific follow-ups when theme is recognized", () => {
    const result = buildFollowUps("traction", [], "deep");
    const focuses = result.map((r) => r.focus);
    // traction theme has: metric provenance, customer quality, trend durability
    expect(focuses).toContain("metric provenance");
  });

  it("falls back to general follow-ups when theme is null", () => {
    const result = buildFollowUps(null, [], "medium");
    const focuses = result.map((r) => r.focus);
    // general follow-ups include specificity, falsifiability, next proof
    expect(focuses).toContain("specificity");
  });

  it("deduplicates by focus — no two items share a focus", () => {
    // Use a theme + overlapping DNA themes to stress dedup
    const result = buildFollowUps("traction", ["traction", "market"], "deep");
    const focuses = result.map((r) => r.focus);
    const uniqueFocuses = new Set(focuses);
    expect(uniqueFocuses.size).toBe(focuses.length);
  });

  it("each item has id, focus, prompt, expected_evidence, risk_if_unanswered", () => {
    const result = buildFollowUps("team", [], "medium");
    for (const item of result) {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("focus");
      expect(item).toHaveProperty("prompt");
      expect(item).toHaveProperty("expected_evidence");
      expect(item).toHaveProperty("risk_if_unanswered");
      expect(typeof item.id).toBe("string");
      expect(typeof item.focus).toBe("string");
      expect(typeof item.prompt).toBe("string");
      expect(Array.isArray(item.expected_evidence)).toBe(true);
      expect(typeof item.risk_if_unanswered).toBe("string");
    }
  });

  it("handles unknown theme gracefully — falls back to general follow-ups", () => {
    const result = buildFollowUps("nonexistent_theme", [], "light");
    expect(result).toHaveLength(3);
    const focuses = result.map((r) => r.focus);
    expect(focuses).toContain("specificity");
  });

  it("ids are sequential stress_follow_up_N", () => {
    // Use a theme with enough templates to reach medium depth (4)
    const result = buildFollowUps("traction", [], "medium");
    expect(result[0].id).toBe("stress_follow_up_1");
    expect(result[1].id).toBe("stress_follow_up_2");
    expect(result[2].id).toBe("stress_follow_up_3");
    expect(result[3].id).toBe("stress_follow_up_4");
  });
});
