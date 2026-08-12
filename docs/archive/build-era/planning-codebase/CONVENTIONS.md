# Coding Conventions

**Analysis Date:** 2026-05-21

## Naming Patterns

**Files:**
- Next.js app: kebab-case for lib and API directories (`rate-limit.ts`, `request-auth.ts`); PascalCase for React components (`AnswerEditor.tsx`, `StressTestPanel.tsx`); `route.ts` for all API handlers
- MCP server: snake_case with `hub_` prefix for all tool files (`hub_save_answer.ts`, `hub_find_best_programs.ts`); `.logic.ts` suffix for pure-function extraction (`hub_find_best_programs.logic.ts`); `.helpers.ts` suffix for side-effectful DB helpers (`hub_stress_test_answer.helpers.ts`)
- SQL migrations: zero-padded numeric prefix in `supabase/migrations/` (`012_launch_hardening.sql`, `026_answer_reviews.sql`)

**Functions:**
- MCP tools use `register` + PascalCase verb+noun pattern: `registerSaveAnswer`, `registerFindBestPrograms`, `registerGetAcceptanceStats`
- Next.js API handlers export named async functions matching HTTP verbs: `export async function POST(req: NextRequest)`
- React event handlers use `handle` prefix in camelCase: `handleSave`, `handleDraft`, `handleCopy`
- Pure logic functions use camelCase verb+noun: `rowToRanked`, `passesEquity`, `rankPrograms`, `daysUntil`

**Variables:**
- camelCase throughout both codebases
- Constants use SCREAMING_SNAKE_CASE: `CHARACTER_LIMIT`, `PLATFORM_DRAFTS_ENABLED`, `ANSWER_FIELDS`
- DB column references use snake_case to match Supabase schema: `archived_question_id`, `user_id`, `program_value_score`

**Types and Interfaces:**
- PascalCase for all: `ProgramRow`, `RankedProgram`, `DraftResponse`, `AlertWindow`, `CoachProfile`
- MCP server uses `interface` for external shapes (`Program`, `ProgramQuestion`); `type` for derived shapes (`RankedProgram`, `ProgramRow`)
- Next.js app uses both; inline `type` aliases for one-off request/response shapes

**Enums:**
- MCP server uses TypeScript `enum` with SCREAMING_SNAKE_CASE members: `ResponseFormat.MARKDOWN`, `ProgramStatus.OPEN`
- Enums are also exported as const arrays for Zod: `export const PROGRAM_TYPES = ["grant", "accel", ...] as const`

## Code Style

**Formatting:**
- Single quotes in Next.js app (`'use client'`, `from '@/lib/utils'`)
- Double quotes in MCP server (`from "./services/supabase.js"`)
- No explicit Prettier config detected — inferred from file content; both codebases are consistently formatted with their own quote style
- Semicolons: always present in both codebases

**Linting:**
- Next.js app: `eslint-config-next` via `next lint`; no separate `.eslintrc` file detected (uses Next.js defaults)
- MCP server: no ESLint config — relies on `tsc --strict` for correctness
- TypeScript strict mode enabled in both `tsconfig.json` files

**Numeric literals:**
- Use underscore separators for large numbers: `25_000`, `60_000`, `1_000_000`, `86_400_000`, `200_000`

## Import Organization

**Next.js app order (observed):**
1. Framework imports (`next/server`, `react`)
2. Third-party SDKs (`@anthropic-ai/sdk`, `@supabase/supabase-js`)
3. Internal lib (`@/lib/supabase/server`, `@/lib/utils`, `@/lib/database.types`)
4. Internal components (`@/components/AnswerEditor`)

**MCP server order (observed):**
1. SDK imports (`@modelcontextprotocol/sdk/...`)
2. Zod (`zod`)
3. Internal services (`../../services/supabase.js`, `../../services/auth.js`)
4. Internal constants (`../../constants.js`)
5. Sibling logic files (`./hub_find_best_programs.logic.js`)

**Path Aliases:**
- Next.js app uses `@/*` mapping to the app root (e.g., `@/lib/utils`, `@/components/AnswerEditor`)
- MCP server uses relative paths only with `.js` extension (required for NodeNext resolution): `"./services/supabase.js"`, `"../../constants.js"`

## Error Handling

**MCP server pattern — return content text on failure:**
```typescript
if (questionError || !question) {
  return { content: [{ type: "text", text: "Archived question not found or not readable." }] };
}
if (error || !answer) {
  return { content: [{ type: "text", text: `Error saving answer: ${error?.message ?? "unknown error"}` }] };
}
```
Tools never throw — they return user-readable error messages in the `content` array.

**Next.js API routes — return NextResponse.json with status:**
```typescript
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
if (appsErr) {
  console.error('[deadline-check] fetch applications error:', appsErr)
  return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 })
}
```
Wrap outer handler in `try/catch` returning `{ error: 'Internal server error' }` with status 500.

**Silent failures:**
- Clipboard access denied in React components uses empty `catch {}` blocks — fail silently when appropriate
- `setAll` called from Server Components: `try { ... } catch { /* safe to ignore */ }`

**Supabase error check pattern:**
```typescript
const { data, error } = await supabase.from("table").select("...").single()
if (error || !data) { /* handle */ }
```
Always check both `error` and nullness of `data`.

## Logging

**Framework:** `console.error` and `console.warn` (no structured logging library)

**Patterns:**
- API routes prefix all log messages with route path in brackets: `console.error('[/api/draft] error:', err)`, `console.error('[deadline-check] fetch applications error:', appsErr)`
- MCP server uses `console.error` only for fatal errors and startup messages
- No `console.log` in production code — only `console.error` and `console.warn`

## Comments

**When to Comment:**
- Block comments at the top of API route files describe endpoint path, caller, and request/response shape:
```typescript
// POST /api/answers/capture
// Called by the Appfeeder extension when a user finishes typing in a form field.
// Request:  { questionText: string, answerText: string }
// Response: { saved: boolean, questionId?: string, version?: number }
```
- Section dividers with `// ---...` or `// ──...` for visual grouping in large files
- Inline comments explain non-obvious choices: `// 23505 = unique_violation — already sent, skip silently`
- JSDoc is used sparingly on exported utility functions in `auth.ts`

## Function Design

**Size:**
- Pure logic functions are small and single-purpose (`passesEquity`, `tallyOutcome`, `daysUntil`)
- Tool registration functions hold all DB logic inline — no separate service layer in MCP tools
- Large API routes (>200 lines) extract helper functions (`createAdminClient`, `windowsForMs`, `sendDeadlineEmail`) and a top-level route handler (`POST`)

**Parameters:**
- Zod schemas as the single source of truth for tool input types — destructured directly in handler: `async ({ user_token, archived_question_id, answer_content, confidence, response_format })`
- Logic functions use explicit typed parameters, not raw DB row types

**Return Values:**
- MCP tools always return `{ content: [{ type: "text", text: string }], structuredContent?: object }` — dual output for both text and structured MCP clients
- All text responses sliced at `CHARACTER_LIMIT` (25,000): `text: formattedText.slice(0, CHARACTER_LIMIT)`

## Module Design

**MCP server exports:**
- Each tool file exports a single `register*` function that takes `McpServer` and calls `server.registerTool()`
- Logic files export named pure functions only — no default exports anywhere
- `constants.ts` is the single source of truth for enums and const arrays

**Next.js app exports:**
- Named exports for all React components (`export function AnswerEditor`)
- Named exports for all lib utilities
- `'use client'` directive at top of all interactive components
- Server Components are the default (no directive needed)

**Barrel files:**
- Not used — all imports are direct file paths

## Supabase Join Access Pattern

When Supabase returns a joined relation, TypeScript infers the type as an array. Always unwrap:
```typescript
const prog = (Array.isArray(row.programs) ? row.programs[0] : row.programs) as unknown as ProgramRow | null
```
This pattern appears in `app/(app)/layout.tsx`, `hub_find_best_programs.logic.ts`, and multiple page components.

---

*Convention analysis: 2026-05-21*
