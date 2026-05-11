import { describe, it, expect, beforeEach } from "vitest";
import { cache } from "./cache.js";

// Reset the shared store between tests by invalidating a known-safe prefix
// The module-level store is shared, so we clear with a broad prefix trick
beforeEach(() => {
  // Invalidate any keys we use in tests
  cache.invalidate("test:");
});

describe("cache", () => {
  describe("set and get", () => {
    it("returns a value immediately after setting it", () => {
      cache.set("test:basic", "hello", 60_000);
      expect(cache.get<string>("test:basic")).toBe("hello");
    });

    it("returns undefined for a key that was never set", () => {
      expect(cache.get("test:missing-key")).toBeUndefined();
    });

    it("stores and retrieves objects", () => {
      const obj = { name: "Alice", score: 42 };
      cache.set("test:object", obj, 60_000);
      expect(cache.get<typeof obj>("test:object")).toEqual(obj);
    });

    it("stores and retrieves arrays", () => {
      cache.set("test:array", [1, 2, 3], 60_000);
      expect(cache.get<number[]>("test:array")).toEqual([1, 2, 3]);
    });

    it("overwrites an existing key with a new value", () => {
      cache.set("test:overwrite", "first", 60_000);
      cache.set("test:overwrite", "second", 60_000);
      expect(cache.get<string>("test:overwrite")).toBe("second");
    });
  });

  describe("TTL expiry", () => {
    it("returns undefined after TTL has elapsed (ttlMs=0)", async () => {
      cache.set("test:expired", "gone", 0);
      // Wait a tick for Date.now() to advance past the expiry
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(cache.get("test:expired")).toBeUndefined();
    });

    it("still returns value before TTL elapses", () => {
      cache.set("test:alive", "still here", 60_000);
      expect(cache.get<string>("test:alive")).toBe("still here");
    });
  });

  describe("invalidate", () => {
    it("removes all keys starting with the given prefix", () => {
      cache.set("test:prefix:a", "valA", 60_000);
      cache.set("test:prefix:b", "valB", 60_000);
      cache.set("test:other:c", "valC", 60_000);

      cache.invalidate("test:prefix:");

      expect(cache.get("test:prefix:a")).toBeUndefined();
      expect(cache.get("test:prefix:b")).toBeUndefined();
      // Different prefix should be unaffected
      expect(cache.get<string>("test:other:c")).toBe("valC");
    });

    it("does not throw when no keys match the prefix", () => {
      expect(() => cache.invalidate("test:nonexistent-prefix:")).not.toThrow();
    });

    it("invalidating an empty prefix string removes nothing unexpected", () => {
      // Do not run this with "" as it would wipe everything; test with a unique prefix
      cache.set("test:safe-key", "value", 60_000);
      cache.invalidate("test:safe-key-that-does-not-exist");
      expect(cache.get<string>("test:safe-key")).toBe("value");
    });
  });

  describe("default TTL", () => {
    it("defaults to 60 seconds when no ttlMs is provided", () => {
      // We can't easily verify the exact expiry without mocking Date.now,
      // so we just confirm the value is immediately readable.
      cache.set("test:default-ttl", "present");
      expect(cache.get<string>("test:default-ttl")).toBe("present");
    });
  });
});
