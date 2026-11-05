// Server-only PostHog LLM analytics for AQUA's OWN Anthropic key.
//
// Privacy contract (users paste application and personal data into AQUA):
//   - privacy mode is ON at the client level AND per call, so @posthog/ai drops
//     prompt, system prompt and completion content before anything is sent;
//   - events are anonymous (no distinct id => `$process_person_profile: false`);
//   - the only custom property is the route name.
// Captured: model, provider, token counts, latency, cost, HTTP status, errors
// (summarised, no message text) and the route.
//
// No-op when NEXT_PUBLIC_POSTHOG_KEY is unset: callers get a plain Anthropic client.
// Analytics must never block or fail a user request: flushing runs after the
// response via next/server `after()`, and every analytics step is guarded.
//
// Do NOT use this for a user's own (BYOK) key or anything that runs in the browser.

import Anthropic from '@anthropic-ai/sdk'
import { PostHogAnthropic } from '@posthog/ai/anthropic'
import { PostHog } from 'posthog-node'
import { after } from 'next/server.js'

const DEFAULT_HOST = 'https://us.i.posthog.com'

let cached: PostHog | null | undefined

/** Shared server PostHog client, or null when no project key is configured. */
export function getPostHogServer(): PostHog | null {
  if (cached !== undefined) return cached
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) {
    cached = null
    return cached
  }
  try {
    cached = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || DEFAULT_HOST,
      // Serverless: send each event right away instead of batching in memory.
      flushAt: 1,
      flushInterval: 0,
      // Redact prompt/completion content in every @posthog/ai integration.
      privacyMode: true,
    })
  } catch {
    cached = null
  }
  return cached
}

function flushAfterResponse(ph: PostHog): void {
  try {
    after(async () => {
      try {
        await ph.flush()
      } catch {
        // analytics must never surface an error
      }
    })
  } catch {
    // after() throws outside a request scope (scripts, tests); nothing to do
  }
}

/**
 * An Anthropic client for AQUA's platform key. With PostHog configured, calls
 * are captured as `$ai_generation` events (privacy mode, anonymous, tagged
 * with `route`). Without it, this is a plain `new Anthropic({ apiKey })`.
 */
export function createPlatformAnthropic(apiKey: string, route: string): Anthropic {
  const ph = getPostHogServer()
  if (!ph) return new Anthropic({ apiKey })

  let client: PostHogAnthropic
  try {
    client = new PostHogAnthropic({ apiKey, posthog: ph })
  } catch {
    return new Anthropic({ apiKey })
  }

  const messages = client.messages
  const create = messages.create.bind(messages) as (body: unknown, options?: unknown) => unknown
  // The wrapper takes per-call `posthog*` params; inject ours so call sites
  // keep the plain Anthropic signature and cannot forget privacy mode.
  ;(messages as unknown as { create: typeof create }).create = (body, options) => {
    const result = create(
      {
        ...(body as object),
        posthogPrivacyMode: true,
        posthogProperties: { route },
      },
      options,
    )
    flushAfterResponse(ph)
    return result
  }
  return client
}
