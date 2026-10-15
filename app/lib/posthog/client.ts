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
    // { path, search } (not `true`): posthog-js only captures the INITIAL
    // pageview for `true`; the object form also monitors history changes —
    // path + search covers Next.js client navs and ?selected/?tab funnel
    // interactions. Verified against posthog-js@1.420 history-autocapture.
    capture_pageview: { path: true, search: true },
    capture_pageleave: true,
    autocapture: false,
    // Our CSP (script-src 'self') blocks posthog's remote plugin scripts —
    // those failed loads stall the init chain before capture ever starts.
    // Disable remote extension loading + surveys; capture stays in-bundle.
    disable_external_dependency_loading: true,
    disable_surveys: true,
    capture_exceptions: false,
    persistence: "localStorage+cookie",
  });
}
