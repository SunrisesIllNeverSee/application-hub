// Server-only PostHog LLM analytics for AQUA's OWN Anthropic key.
//
// Privacy contract (users paste application and personal data into AQUA):
//   - privacy mode is ON at the PostHog client level (per-call settings can only
//     add redaction), so @posthog/ai drops prompt and completion content;
//   - a `before_send` hook is a backstop: it strips every content-bearing `$ai_*`
//     field and reduces `$ai_error` to an error class name (Anthropic 4xx
//     messages can echo request fragments);
//   - events are anonymous (no distinct id => `$process_person_profile: false`);
//   - the only custom property is the route name.
// Captured: model, provider, tokens, latency, cost, HTTP status, error class, route.
//
// No-op when NEXT_PUBLIC_POSTHOG_KEY is unset: callers get a plain Anthropic client.
// Analytics must never block or fail a user request: the flush runs after the
// response via `after()`, and every analytics step is guarded.
//
// Do NOT use this for a user's own (BYOK) key or anything that runs in the browser.

import Anthropic from '@anthropic-ai/sdk'
import { PostHogAnthropic } from '@posthog/ai/anthropic'
import { PostHog, type EventMessage } from 'posthog-node'
// `next/server.js` (not `next/server`): the plain-node test runner cannot resolve
// the extensionless subpath. Same module for Next's bundler.
import { after as nextAfter } from 'next/server.js'

const DEFAULT_HOST = 'https://us.i.posthog.com'

// Content-bearing fields that must never leave the server.
const CONTENT_KEYS = [
  '$ai_input',
  '$ai_output_choices',
  '$ai_input_state',
  '$ai_output_state',
  '$ai_tools',
  '$ai_provider_metadata',
  '$ai_model_parameters',
  '$ai_span_name',
  '$ai_stop_reason_text',
  '$exception_list',
  '$exception_message',
]

/** Reduce an error string to its class name (no message text). */
function errorClassOnly(value: unknown): string {
  const m = typeof value === 'string' ? value.match(/[A-Za-z][A-Za-z0-9_]*Error/) : null
  return m ? m[0] : 'Error'
}

/** posthog-node `before_send`: backstop on top of privacy mode. */
export function sanitizeAiEvent(event: EventMessage): EventMessage | null {
  // This client only ever carries LLM analytics; anything else is dropped.
  if (typeof event.event !== 'string' || !event.event.startsWith('$ai_')) return null
  const props: Record<string, unknown> = { ...(event.properties ?? {}) }
  for (const k of CONTENT_KEYS) delete props[k]
  if ('$ai_error' in props) props.$ai_error = errorClassOnly(props.$ai_error)
  return { ...event, properties: props }
}

type AfterFn = (task: () => Promise<void>) => void

function flushAfterResponse(ph: PostHog, after: AfterFn): void {
  try {
    after(async () => {
      try {
        await ph.flush()
      } catch {
        // analytics must never surface an error
      }
    })
  } catch {
    // after() throws outside a request scope; nothing to do
  }
}

/**
 * The PostHog client as seen by one route: adds the `route` property and
 * registers a flush AFTER each capture is queued (so the flush covers it).
 */
function routeScoped(ph: PostHog, route: string, after: AfterFn): PostHog {
  return new Proxy(ph, {
    get(target, prop) {
      if (prop === 'capture') {
        return (msg: EventMessage) => {
          target.capture({ ...msg, properties: { ...(msg.properties ?? {}), route } })
          flushAfterResponse(target, after)
        }
      }
      const v = Reflect.get(target, prop, target)
      return typeof v === 'function' ? v.bind(target) : v
    },
  })
}

type ServerOptions = { fetch?: PostHogFetch }
type PostHogFetch = NonNullable<ConstructorParameters<typeof PostHog>[1]>['fetch']

function buildPostHog(key: string, opts: ServerOptions = {}): PostHog | null {
  try {
    return new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || DEFAULT_HOST,
      // Serverless: send each event right away instead of batching in memory.
      flushAt: 1,
      flushInterval: 0,
      privacyMode: true,
      before_send: sanitizeAiEvent,
      ...(opts.fetch ? { fetch: opts.fetch } : {}),
    })
  } catch {
    return null
  }
}

let cached: PostHog | null | undefined

/** Shared server PostHog client, or null when no project key is configured. */
export function getPostHogServer(): PostHog | null {
  if (cached !== undefined) return cached
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  cached = key ? buildPostHog(key) : null
  return cached
}

export type PlatformAnthropicDeps = {
  /** Test seam: replaces the shared PostHog client. */
  posthog?: PostHog | null
  /** Test seam: replaces next/server `after`. */
  after?: AfterFn
  /** Anthropic transport (tests); defaults to global fetch. */
  fetch?: typeof fetch
}

/**
 * An Anthropic client for AQUA's platform key. With PostHog configured it is the
 * official `@posthog/ai` Anthropic class (a real Anthropic subclass: streaming,
 * withResponse etc. unchanged), reporting privacy-mode `$ai_generation` events
 * tagged with `route`. Without PostHog it is a plain `new Anthropic({ apiKey })`.
 */
export function createPlatformAnthropic(
  apiKey: string,
  route: string,
  deps: PlatformAnthropicDeps = {},
): Anthropic {
  const base = { apiKey, ...(deps.fetch ? { fetch: deps.fetch } : {}) }
  const ph = deps.posthog !== undefined ? deps.posthog : getPostHogServer()
  if (!ph) return new Anthropic(base)
  try {
    return new PostHogAnthropic({ ...base, posthog: routeScoped(ph, route, deps.after ?? nextAfter) })
  } catch {
    return new Anthropic(base)
  }
}
