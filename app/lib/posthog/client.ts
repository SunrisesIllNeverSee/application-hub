import type posthogType from "posthog-js";

let initialized = false;
let realPosthog: typeof posthogType | null = null;

const posthog = new Proxy({} as typeof posthogType, {
  get(_target, prop: string) {
    if (realPosthog) {
      return (realPosthog as unknown as Record<string, unknown>)[prop];
    }
    return () => {};
  },
});

export { posthog };

export async function initPostHog() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || typeof window === "undefined" || initialized) return;
  initialized = true;
  const mod = await import("posthog-js");
  realPosthog = mod.default;
  realPosthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: false,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    capture_exceptions: true,
  });
}
