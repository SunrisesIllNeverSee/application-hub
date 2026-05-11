import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * rate_limit.ts calls supabase and is side-effectful at the DB level.
 * We mock the supabase module so checkRateLimit can be tested in isolation
 * without a real database connection.
 */

// Mock the supabase module before importing rate_limit
vi.mock("./supabase.js", () => {
  const makeMockChain = (resolvedValue: unknown) => {
    const chain: Record<string, unknown> = {};
    const methods = ["from", "select", "eq", "single", "in", "order", "limit", "insert", "update"];
    for (const method of methods) {
      chain[method] = () => chain;
    }
    // terminal: single() resolves the promise
    chain["single"] = () => Promise.resolve(resolvedValue);
    return chain;
  };

  return {
    supabase: {
      from: () => makeMockChain({ data: null, error: null })
    }
  };
});

describe("rate_limit module", () => {
  it("imports without throwing", async () => {
    const mod = await import("./rate_limit.js");
    expect(mod).toBeDefined();
    expect(typeof mod.checkRateLimit).toBe("function");
  });
});

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("resolves without throwing when user is on pro tier (unlimited)", async () => {
    vi.doMock("./supabase.js", () => {
      const makeChain = (finalValue: unknown) => {
        const c: Record<string, (...args: unknown[]) => unknown> = {};
        const passThrough = () => c;
        c.from = passThrough;
        c.select = passThrough;
        c.eq = passThrough;
        c.single = () => Promise.resolve(finalValue);
        return c;
      };

      let callCount = 0;
      return {
        supabase: {
          from: () => {
            callCount++;
            if (callCount === 1) {
              // First call: user_subscriptions — returns pro tier
              return makeChain({ data: { tier: "pro" }, error: null });
            }
            // Second call: ai_usage — should never be reached for pro
            return makeChain({ data: { draft_count: 9999 }, error: null });
          }
        }
      };
    });

    const { checkRateLimit } = await import("./rate_limit.js");
    await expect(checkRateLimit("user-123")).resolves.toBeUndefined();
  });

  it("resolves without throwing when user is on team tier (unlimited)", async () => {
    vi.doMock("./supabase.js", () => {
      const makeChain = (finalValue: unknown) => {
        const c: Record<string, (...args: unknown[]) => unknown> = {};
        const passThrough = () => c;
        c.from = passThrough;
        c.select = passThrough;
        c.eq = passThrough;
        c.single = () => Promise.resolve(finalValue);
        return c;
      };

      return {
        supabase: {
          from: () => makeChain({ data: { tier: "team" }, error: null })
        }
      };
    });

    const { checkRateLimit } = await import("./rate_limit.js");
    await expect(checkRateLimit("user-456")).resolves.toBeUndefined();
  });

  it("resolves without throwing when free user is under the limit", async () => {
    vi.doMock("./supabase.js", () => {
      const makeChain = (finalValue: unknown) => {
        const c: Record<string, (...args: unknown[]) => unknown> = {};
        const passThrough = () => c;
        c.from = passThrough;
        c.select = passThrough;
        c.eq = passThrough;
        c.single = () => Promise.resolve(finalValue);
        return c;
      };

      let callCount = 0;
      return {
        supabase: {
          from: () => {
            callCount++;
            if (callCount === 1) {
              return makeChain({ data: { tier: "free" }, error: null });
            }
            return makeChain({ data: { draft_count: 50 }, error: null });
          }
        }
      };
    });

    const { checkRateLimit } = await import("./rate_limit.js");
    await expect(checkRateLimit("user-789")).resolves.toBeUndefined();
  });

  it("throws when free user has reached or exceeded the limit of 100", async () => {
    vi.doMock("./supabase.js", () => {
      const makeChain = (finalValue: unknown) => {
        const c: Record<string, (...args: unknown[]) => unknown> = {};
        const passThrough = () => c;
        c.from = passThrough;
        c.select = passThrough;
        c.eq = passThrough;
        c.single = () => Promise.resolve(finalValue);
        return c;
      };

      let callCount = 0;
      return {
        supabase: {
          from: () => {
            callCount++;
            if (callCount === 1) {
              return makeChain({ data: { tier: "free" }, error: null });
            }
            return makeChain({ data: { draft_count: 100 }, error: null });
          }
        }
      };
    });

    const { checkRateLimit } = await import("./rate_limit.js");
    await expect(checkRateLimit("user-over-limit")).rejects.toThrow(/limit.*reached/i);
  });

  it("treats unknown tier as free (limit=100) — resolves when under limit", async () => {
    vi.doMock("./supabase.js", () => {
      const makeChain = (finalValue: unknown) => {
        const c: Record<string, (...args: unknown[]) => unknown> = {};
        const passThrough = () => c;
        c.from = passThrough;
        c.select = passThrough;
        c.eq = passThrough;
        c.single = () => Promise.resolve(finalValue);
        return c;
      };

      let callCount = 0;
      return {
        supabase: {
          from: () => {
            callCount++;
            if (callCount === 1) {
              return makeChain({ data: { tier: "enterprise_unknown" }, error: null });
            }
            return makeChain({ data: { draft_count: 5 }, error: null });
          }
        }
      };
    });

    const { checkRateLimit } = await import("./rate_limit.js");
    await expect(checkRateLimit("user-unknown-tier")).resolves.toBeUndefined();
  });

  it("treats null subscription as free tier — throws when at limit", async () => {
    vi.doMock("./supabase.js", () => {
      const makeChain = (finalValue: unknown) => {
        const c: Record<string, (...args: unknown[]) => unknown> = {};
        const passThrough = () => c;
        c.from = passThrough;
        c.select = passThrough;
        c.eq = passThrough;
        c.single = () => Promise.resolve(finalValue);
        return c;
      };

      let callCount = 0;
      return {
        supabase: {
          from: () => {
            callCount++;
            if (callCount === 1) {
              return makeChain({ data: null, error: null });
            }
            return makeChain({ data: { draft_count: 100 }, error: null });
          }
        }
      };
    });

    const { checkRateLimit } = await import("./rate_limit.js");
    await expect(checkRateLimit("user-no-sub")).rejects.toThrow(/limit.*reached/i);
  });
});
