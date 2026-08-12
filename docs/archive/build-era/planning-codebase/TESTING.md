# Testing Patterns

**Analysis Date:** 2026-05-21

## Test Framework

**Runner:**
- Vitest 2.x
- Config: `application-hub-mcp-server/vitest.config.ts`
- Environment: `node`

**Assertion Library:**
- Vitest built-in (`expect`) — no separate assertion library

**Run Commands:**
```bash
# From application-hub-mcp-server/
npm test              # Run all tests once (vitest run)
npm run test:watch    # Watch mode (vitest)
```

**Note:** The Next.js app (`app/`) has no test configuration and no test files. All tests live exclusively in `application-hub-mcp-server/`.

## Test File Organization

**Location:**
- Co-located with source files — test files sit next to the module they test
- Service tests: `src/services/cache.test.ts`, `src/services/rate_limit.test.ts`
- Tool logic tests: `src/tools/intelligence/hub_get_acceptance_stats.test.ts`
- Tool tests: `src/tools/user/hub_find_best_programs.test.ts`, `src/tools/user/hub_stress_test_answer.test.ts`

**Naming:**
- `{module-name}.test.ts` — always `.test.ts` suffix, never `.spec.ts`
- Logic extraction files get their own test file: `hub_find_best_programs.logic.ts` is tested by `hub_find_best_programs.test.ts`

**Structure:**
```
application-hub-mcp-server/src/
├── services/
│   ├── cache.ts
│   ├── cache.test.ts          ← tests alongside source
│   ├── rate_limit.ts
│   └── rate_limit.test.ts
├── tools/
│   ├── intelligence/
│   │   ├── hub_get_acceptance_stats.ts
│   │   ├── hub_get_acceptance_stats.logic.ts
│   │   └── hub_get_acceptance_stats.test.ts
│   └── user/
│       ├── hub_find_best_programs.ts
│       ├── hub_find_best_programs.logic.ts
│       ├── hub_find_best_programs.test.ts    ← tests the .logic.ts file
│       ├── hub_stress_test_answer.ts
│       └── hub_stress_test_answer.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach } from "vitest";

describe("moduleName", () => {
  describe("methodName", () => {
    it("does specific behavior when condition", () => {
      expect(result).toBe(expected);
    });
  });
});
```

**Patterns:**
- Nested `describe` blocks: outer block = module/class name, inner block = method or scenario name
- `beforeEach` used for state reset (e.g., clearing cache keys with a known prefix)
- No `afterEach` or `afterAll` cleanup — tests use isolated state or prefix-based invalidation
- Flat test files for pure logic (no nesting when a single function is the subject): `describe("tallyOutcome", () => { ... })`

## Mocking

**Framework:** Vitest's `vi.mock` / `vi.doMock`

**Top-level static mock (import-time side effects):**
```typescript
// Must appear before importing the module under test
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

import { followUpCount, compactSignals } from "./hub_stress_test_answer.js";
```

**Per-test dynamic mock (for stateful mock behavior):**
```typescript
describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.resetModules(); // REQUIRED before vi.doMock in each test
  });

  it("resolves when user is on pro tier", async () => {
    vi.doMock("./supabase.js", () => {
      let callCount = 0;
      return {
        supabase: {
          from: () => {
            callCount++;
            if (callCount === 1) return makeChain({ data: { tier: "pro" }, error: null });
            return makeChain({ data: null, error: null });
          }
        }
      };
    });
    const { checkRateLimit } = await import("./rate_limit.js"); // dynamic import AFTER mock
    await expect(checkRateLimit("user-123")).resolves.toBeUndefined();
  });
});
```

**Mock chain builder pattern** for Supabase fluent API:
```typescript
const makeChain = (finalValue: unknown) => {
  const c: Record<string, (...args: unknown[]) => unknown> = {};
  const passThrough = () => c;
  c.from = passThrough;
  c.select = passThrough;
  c.eq = passThrough;
  c.single = () => Promise.resolve(finalValue);
  return c;
};
```

**What to Mock:**
- Supabase client (`./supabase.js` or `../../services/supabase.js`) — always mocked, never use a real DB connection in tests
- Auth module (`./auth.js`) — mock `validateUserToken` to avoid network calls
- Constants module — mock when the module under test reads constants at import time

**What NOT to Mock:**
- Pure logic in `.logic.ts` files — test directly with real inputs
- Standard library and built-ins (Date, Math, Array) — use real implementations; pass `now` as a parameter to make time-dependent functions testable (see `daysUntil(deadline, now)`)

## Fixtures and Factories

**Test Data:**
```typescript
// Define a base fixture object
const baseProgram = {
  name: "Seed", slug: "seed", type: "accelerator", status: "open",
  deadline_at: null, equity_pct: 7, cash_value_usd: 125_000,
  program_value_score: 80, is_rolling: false
};

// Factory function for rows — overrides merge over base
function row(overrides: Partial<any> = {}, programOverrides: Partial<any> = {}) {
  return { fit_score: 75, programs: { ...baseProgram, ...programOverrides }, ...overrides };
}

// Usage
const r = row({ fit_score: 80 }, { program_value_score: 90 });
```

**Location:**
- Fixtures are defined inline in the test file that needs them — no shared fixtures directory

## Coverage

**Requirements:** Not enforced — no coverage threshold configured in `vitest.config.ts`

**View Coverage:**
```bash
# Run with coverage (not configured by default — add --coverage flag)
npx vitest run --coverage
```

## Test Types

**Unit Tests:**
- All current tests are unit tests targeting pure functions in `.logic.ts` files or services with mocked dependencies
- Scope: individual exported functions (e.g., `rowToRanked`, `passesEquity`, `tallyOutcome`, `cache.set/get`)

**Integration Tests:**
- Not present — the DB-touching tool handlers (`hub_save_answer.ts`, `hub_get_acceptance_stats.ts`) have no integration tests
- Rate limit and auth modules are tested at unit level only with fully mocked Supabase

**E2E Tests:**
- Not present in either the MCP server or the Next.js app

## Common Patterns

**Testing pure time-dependent functions — inject `now`:**
```typescript
describe("daysUntil", () => {
  const now = new Date("2026-01-01T00:00:00Z").getTime();

  it("counts forward whole days, rounded up", () => {
    expect(daysUntil("2026-01-08T00:00:00Z", now)).toBe(7);
  });

  it("returns negative for past deadlines", () => {
    expect(daysUntil("2025-12-25T00:00:00Z", now)).toBe(-7);
  });
});
```

**Testing async throws:**
```typescript
await expect(checkRateLimit("user-over-limit")).rejects.toThrow(/limit.*reached/i);
```

**Testing async resolves to undefined:**
```typescript
await expect(checkRateLimit("user-123")).resolves.toBeUndefined();
```

**Testing TTL expiry with real time (minimal sleep):**
```typescript
it("returns undefined after TTL has elapsed (ttlMs=0)", async () => {
  cache.set("test:expired", "gone", 0);
  await new Promise((resolve) => setTimeout(resolve, 5));
  expect(cache.get("test:expired")).toBeUndefined();
});
```

**Testing shape of returned objects:**
```typescript
it("each item has id, focus, prompt, expected_evidence, risk_if_unanswered", () => {
  const result = buildFollowUps("team", [], "medium");
  for (const item of result) {
    expect(item).toHaveProperty("id");
    expect(item).toHaveProperty("focus");
    expect(typeof item.id).toBe("string");
    expect(Array.isArray(item.expected_evidence)).toBe(true);
  }
});
```

**Testing array length caps:**
```typescript
it("caps numeric_claims at 12", () => {
  const text = Array.from({ length: 20 }, (_, i) => `${i + 1}%`).join(" ");
  const result = compactSignals(text);
  expect(result.numeric_claims.length).toBeLessThanOrEqual(12);
});
```

## Logic Extraction Convention

Tool handlers that have complex pure logic extract it to a `.logic.ts` sibling file. This is the primary testability strategy:

- `hub_find_best_programs.ts` (registers tool, calls DB) → `hub_find_best_programs.logic.ts` (pure ranking functions) → tested by `hub_find_best_programs.test.ts`
- `hub_get_acceptance_stats.ts` (registers tool, calls DB) → `hub_get_acceptance_stats.logic.ts` (pure tally/aggregate functions) → tested by `hub_get_acceptance_stats.test.ts`
- `hub_stress_test_answer.ts` (registers tool, calls DB) → `hub_stress_test_answer.logic.ts` + `hub_stress_test_answer.helpers.ts` → tested by `hub_stress_test_answer.test.ts`

When adding a new MCP tool with non-trivial logic, extract pure functions to a `.logic.ts` file and test those directly.

---

*Testing analysis: 2026-05-21*
