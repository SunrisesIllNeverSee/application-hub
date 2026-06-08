# AQUA — Where We Left Off

**Session date:** 2026-06-08

---

## The core insight from this session

AQUA is not primarily a browser extension. It's an **answer bank + intelligence layer** that any AI client can drive.

The Kapture MCP tool (browser bridge for Claude Desktop) revealed the architecture AQUA should have. Kapture gives Claude eyes and hands in the browser via an MCP server ↔ browser extension bridge. That's exactly what AQUA's "Automation Assist" mode needs to become.

---

## Current architecture vs. target

### What AQUA does today (user-driven)
```
User clicks sidepanel → extension → Hub API → AI generates → extension fills
```
The user orchestrates everything manually. Claude is a dumb text generator at the end.

### What AQUA should become (Claude-driven)
```
Claude (MCP) → local agent server → browser extension → webpage
              ↕
         Application Hub MCP (answer bank, match, fit scores)
```
Claude pulls — it reads the form, queries the bank, generates, fills — without the user touching the sidepanel.

---

## The shortcut that already works

Users with **Claude Desktop + Kapture + Hub MCP server configured** can already do this today:

1. `kapture.screenshot(tabId)` → Claude sees the form
2. `kapture.elements('input, textarea')` → Claude enumerates fields
3. Hub MCP `match_question(text)` → bank answers pulled per field
4. `kapture.fill(tabId, selector, answer)` → Claude writes answers in

**No new code needed for this path.** It's a documentation + setup problem, not an engineering problem.

The same is true for any AI agent with browser control (OpenAI Codex computer use, Gemini, etc.) — they can all call the Hub API directly. The extension is the **standalone client** for users without an AI agent environment.

---

## The provider-agnostic picture

| AI Client | Browser bridge | Hub access |
|---|---|---|
| Claude Desktop | Kapture MCP | Application Hub MCP server |
| OpenAI Codex | Computer use / browser tool | Hub REST API |
| Gemini / others | Whatever browser tool they expose | Hub REST API |
| No AI client | AQUA browser extension | Hub REST API via extension |

---

## What the extension becomes

The AQUA browser extension is the **no-Claude-required fallback lane**. Users who just want a toolbar button that fills their YC app don't need Claude Desktop. The extension handles that path standalone.

For power users, the extension may eventually expose its capabilities as MCP tools (via the local agent server at `scripts/local-extension-agent.mjs`), turning it into a Kapture-equivalent for application forms specifically.

---

## Immediate next steps (priority order)

### 1. Validate the Kapture + Hub MCP path (this week, no code)
- Install Kapture browser extension in Chrome
- Configure Application Hub MCP server in Claude Desktop (`claude_desktop_config.json`)
- Open a real application form (YC, Solana Incubator, etc.)
- Tell Claude: "Fill this application using my answer bank"
- Document what works and what breaks

### 2. Expose the Hub REST API cleanly for non-Claude clients
- Ensure `/api/match-question`, `/api/answers/capture`, `/api/hub/ingest` all accept bearer JWT
- These are already implemented — verify they work with a simple `curl` test
- Write a one-page API reference so Codex / other agents can plug in

### 3. Verify the extension standalone path (TASKS.md checklist)
- Load unpacked from `webextension/application-hub/` in Chrome
- Run through the Manual Assist smoke test (detect → match → generate → fill → save)
- This is the fallback lane — it should work before the power-user paths get documented

### 4. Upgrade the local agent server to MCP (later)
- `scripts/local-extension-agent.mjs` currently only receives pushes from the extension
- Upgrade it to expose MCP tools (screenshot via extension, fill, elements) so Claude can drive it the same way Kapture works
- This closes the gap for users who want Claude-driven fills but can't use Kapture

---

## Files of interest

| File | What it is |
|---|---|
| `application-hub/background.js` | Message bus — all extension↔Hub API wiring |
| `application-hub/content.js` | DOM scanner and field filler |
| `application-hub/sidepanel.js` | Manual Assist + Automation Assist UI |
| `scripts/local-extension-agent.mjs` | Local agent server (upgrade path to MCP) |
| `TASKS.md` | Verification checklist — still all unchecked |

---

## The one-sentence version

The answer bank is the moat. Every AI client — Claude, Codex, the extension — is just a delivery mechanism for the same operation: read a form, match questions to bank answers, fill.
