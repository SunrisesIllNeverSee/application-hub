**Tech stack:**
Stack: Next.js 15 / React / TypeScript, Supabase (PostgreSQL + pgvector), Python (SIGSYSTEM ~1,500 lines), Stripe Connect, Zenodo (DOI-hosted paper). VS Code, GitHub.

AI models — operated through a multi-Claude switchboard routing tasks by capability and cost: Claude Opus 4.7, Claude Sonnet 4.6, Claude Haiku 4.5, GPT-4o, DeepSeek, Gemini, Grok (two versions), Devin, GitHub Copilot, OpenAI Codex. Claude Opus 4.7 benchmarks #1 across all five measured kernels per SIGSYSTEM v1.1 — which is how we chose it as primary.

AI coding tools: Claude Code (primary build partner — 21 sessions, 7,327 turns, 35,242 LOC across 5 build days, $0.0007/LOC), Devin, GitHub Copilot, OpenAI Codex. The switchboard passes every interaction through the McHenry-Axiom-gated compression pipeline (patented).

MCP plugin layer: Supabase, Stripe, Brave Search, Figma, Notion, Pinecone, MongoDB, n8n, Canva, Gamma, and a custom Application Hub MCP server (21 tools, 7 resources, 3 prompts). The entire dev environment is MCP-native — tools talk to live infrastructure directly from inside the AI session.

The tokenmaxxing argument matters here: YC/OpenAI's current playbook says burn aggressively in 0→1, switch to efficiency post-PMF. We never had a burn phase. The substrate was efficiency-correct from day zero. 94.66% cache hit rate means 94.66% of every token read was cached — not fresh API spend. Output-to-fresh-input ratio: 17.9×. Tokens per task: 810K vs. field average 5.13M (6.3× lower). Time per task: 1.84 min vs. 12.8 min field average (6.9× faster). Total: 1.123B tokens processed, 1.084B cached, ~39M fresh, across 98 sessions over 7 days.

This is not post-PMF optimization. This is what building on a commitment-conservation substrate looks like from day zero. The governance layer that makes the product also made the product possible to build.

**Coding agent session attached:** Application Hub — Build Session Export (Session d3a8abb3, May 10, 2026, 4,828 turns, 119MB)

*Session context:* This session is from the benchmark window that produced the numbers above. Peak day stats: 94.66% cache hit, 17.9× output-to-fresh-input ratio, 810K tokens per task vs. 5.13M field average, $0.0007/LOC vs. $0.045 field average — 64× lower. Every turn passed through the MO§ES™ constitutional substrate. The 5,162-token governance context was cached and reused across every turn instead of re-sent fresh. That's the product working on itself. The same substrate that makes the product defensible made the product possible to build — at sub-1¢/LOC, solo, self-funded, in Buffalo.