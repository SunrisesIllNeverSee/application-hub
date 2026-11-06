// Server-only PostHog LLM analytics for AI drafting and extraction calls, made
// with either AQUA's own Anthropic key ("platform") or a user's own key
// ("byok": Anthropic, OpenAI, or an OpenAI-compatible endpoint such as Ollama).
//
// Privacy contract (users paste application and personal data into AQUA):
//   - privacy mode is ON at the PostHog client level (per-call settings can only
//     add redaction), so @posthog/ai drops prompt and completion content;
//   - a `before_send` hook is a backstop: it strips every content-bearing `$ai_*`
//     field and reduces `$ai_error` to an error class name (Anthropic 4xx
//     messages can echo request fragments);
//   - no person profiles (`$process_person_profile: false`); when a route passes a
//     user, the distinct id is a one-way hash of the AQUA user id (never email);
//   - custom properties: the route name and the key source (`platform` | `byok`);
//   - a user's key, base URL (an Ollama tunnel can be private) and prompts never
//     leave the server.
// Captured: model, provider, tokens, latency, cost, HTTP status, error class,
// route, key source.
//
// No-op when NEXT_PUBLIC_POSTHOG_KEY is unset: callers get a plain Anthropic client.
// Analytics must never block or fail a user request: the flush runs after the
// response via `after()`, and every analytics step is guarded.
//
// Never use this for anything that runs in the browser.

import { createHash, randomUUID } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import { captureAiGeneration } from '@posthog/ai'
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

/** Where the model key came from. */
export type KeySource = 'platform' | 'byok'

/** Analytics identity for a user: a one-way hash of the AQUA user id, never the id or email. */
export function analyticsUserId(userId: string | null | undefined): string | undefined {
  if (!userId) return undefined
  return 'aqua_' + createHash('sha256').update('aqua-analytics:' + userId).digest('hex').slice(0, 32)
}

type Scope = { route: string; keySource: KeySource; distinctId?: string }

function scopeProperties(scope: Scope): Record<string, unknown> {
  return { route: scope.route, ai_key_source: scope.keySource, $process_person_profile: false }
}

/**
 * The PostHog client as seen by one route: adds the route and key-source
 * properties, the hashed user id when known, and registers a flush AFTER each
 * capture is queued (so the flush covers it).
 */
function routeScoped(ph: PostHog, scope: Scope, after: AfterFn): PostHog {
  return new Proxy(ph, {
    get(target, prop) {
      const scoped = (msg: EventMessage): EventMessage => ({
        ...msg,
        ...(scope.distinctId ? { distinctId: scope.distinctId } : {}),
        properties: { ...(msg.properties ?? {}), ...scopeProperties(scope) },
      })
      if (prop === 'capture') {
        return (msg: EventMessage) => {
          target.capture(scoped(msg))
          flushAfterResponse(target, after)
        }
      }
      // Same scoping if a caller asks @posthog/ai for immediate capture.
      if (prop === 'captureImmediate') {
        return (msg: EventMessage) => target.captureImmediate(scoped(msg))
      }
      const v = Reflect.get(target, prop, target)
      return typeof v === 'function' ? v.bind(target) : v
    },
  })
}

type ServerOptions = { fetch?: PostHogFetch }
type PostHogFetch = NonNullable<ConstructorParameters<typeof PostHog>[1]>['fetch']

/** The browser host can be a relative proxy path (e.g. /ingest); the server needs an absolute URL. */
function serverHost(value: string | undefined): string {
  return value && /^https?:\/\//.test(value) ? value : DEFAULT_HOST
}

function buildPostHog(key: string, opts: ServerOptions = {}): PostHog | null {
  try {
    return new PostHog(key, {
      host: serverHost(process.env.NEXT_PUBLIC_POSTHOG_HOST),
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

export type TrackedLlmDeps = {
  /** Test seam: replaces the shared PostHog client. */
  posthog?: PostHog | null
  /** Test seam: replaces next/server `after`. */
  after?: AfterFn
  /** Anthropic transport (tests); defaults to global fetch. */
  fetch?: typeof fetch
}
/** @deprecated name kept for existing callers. */
export type PlatformAnthropicDeps = TrackedLlmDeps

export type TrackOptions = {
  /** Which key paid for the call. */
  keySource: KeySource
  /** The AQUA user id; hashed before it reaches PostHog. */
  userId?: string | null
}

/**
 * An Anthropic client. With PostHog configured it is the official `@posthog/ai`
 * Anthropic class (a real Anthropic subclass: streaming, withResponse etc.
 * unchanged), reporting privacy-mode `$ai_generation` events tagged with the
 * route and key source. Without PostHog it is a plain `new Anthropic({ apiKey })`.
 * The API key goes to Anthropic only; it is never part of an event.
 */
export function createTrackedAnthropic(
  apiKey: string,
  route: string,
  opts: TrackOptions,
  deps: TrackedLlmDeps = {},
): Anthropic {
  const base = { apiKey, ...(deps.fetch ? { fetch: deps.fetch } : {}) }
  const ph = deps.posthog !== undefined ? deps.posthog : getPostHogServer()
  if (!ph) return new Anthropic(base)
  try {
    const scope: Scope = { route, keySource: opts.keySource, distinctId: analyticsUserId(opts.userId) }
    return new PostHogAnthropic({ ...base, posthog: routeScoped(ph, scope, deps.after ?? nextAfter) })
  } catch {
    return new Anthropic(base)
  }
}

/** AQUA's own key. Same as `createTrackedAnthropic(apiKey, route, { keySource: 'platform' })`. */
export function createPlatformAnthropic(
  apiKey: string,
  route: string,
  deps: TrackedLlmDeps = {},
): Anthropic {
  return createTrackedAnthropic(apiKey, route, { keySource: 'platform' }, deps)
}

export type ChatGeneration = TrackOptions & {
  route: string
  /** 'openai' or 'ollama' (any OpenAI-compatible endpoint). */
  provider: string
  model: string
  /** Wall-clock milliseconds for the provider call. */
  latencyMs: number
  inputTokens?: number | null
  outputTokens?: number | null
  httpStatus?: number
  /**
   * A short error class such as 'ProviderHttpError' or 'NetworkError'. Never a
   * provider message: those can echo the prompt.
   */
  errorClass?: string
}

/** An Error carrying only a class name (no message text). */
function namedError(name: string): Error {
  const e = new Error(name)
  e.name = name
  return e
}

/**
 * Record one OpenAI-compatible chat call (user's OpenAI key or Ollama endpoint)
 * as a privacy-mode `$ai_generation`. No prompt, completion, key or base URL is
 * sent. Fire-and-forget: it never throws and never delays the response.
 */
export function captureChatGeneration(gen: ChatGeneration, deps: TrackedLlmDeps = {}): void {
  try {
    const ph = deps.posthog !== undefined ? deps.posthog : getPostHogServer()
    if (!ph) return
    const scope: Scope = { route: gen.route, keySource: gen.keySource, distinctId: analyticsUserId(gen.userId) }
    const traceId = randomUUID()
    const captured = captureAiGeneration(ph, {
      distinctId: scope.distinctId,
      traceId,
      provider: gen.provider,
      model: gen.model,
      input: null,
      output: null,
      privacyMode: true,
      baseURL: null,
      httpStatus: gen.httpStatus,
      latency: Math.max(0, gen.latencyMs) / 1000,
      // Only when the provider reported usage: a failed call or an endpoint
      // without usage must not look like a real zero-token generation.
      ...(gen.inputTokens != null || gen.outputTokens != null
        ? { usage: { inputTokens: gen.inputTokens ?? 0, outputTokens: gen.outputTokens ?? 0 } }
        : {}),
      properties: scopeProperties(scope),
      ...(gen.errorClass ? { error: namedError(gen.errorClass) } : {}),
      onError: () => {},
    }).catch(() => {})
    // Flush once the event is queued, after the response has gone out.
    const after = deps.after ?? nextAfter
    try {
      after(async () => {
        try {
          await captured
          await ph.flush()
        } catch {
          // analytics must never surface an error
        }
      })
    } catch {
      // after() throws outside a request scope; the event still sends (flushAt: 1)
    }
  } catch {
    // analytics must never surface an error
  }
}
