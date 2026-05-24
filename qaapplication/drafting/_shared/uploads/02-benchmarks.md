
# MO§ES™ — Five Measured Kernels · Sovereign Signal Benchmarks

## Overview

"Five measured kernels. One operator." The MO§ES system pairs operator-augmented Claude Code with Opus 4.7, measured against the Artificial Analysis Coding Agent Index field average over a seven-day window. The analysis encompasses 98 session files with raw JSONL extraction across all subagents.

## Performance Summary

MO§ES demonstrates leadership across all measured economic categories:

| Metric | MO§ES | Field Average | Rank |
| --- | --- | --- | --- |
| Cache hit rate | 94.66% | 91.45% | #1 |
| Output-to-Input ratio | 17.9× | 102× baseline | #1 |
| Tokens per task | 810K | 5.13M | #1 |
| Time per task | 1.84 min | 6.9× slower | #1 |
| Cost per LOC | $0.0007 | Industry standard | #1 |

## Five Measured Kernels

1. **Cache Hit:** 94.66% (field avg 91.45%)
2. **Out:In Ratio:** 17.9× (field avg 102× baseline)
3. **Tokens/Task:** 810K (field avg 5.13M)
4. **Time/Task:** 1.84 min (field 6.9× slower)
5. **$/LOC:** $0.0007 (field avg <1¢ per line)

## Token Breakdown

| Category | Count | Value |
| --- | --- | --- |
| Input (fresh tokens) | 123,246 | — |
| Output | 3,902,803 | 3.90 M |
| Cache Create | 34,826,779 | 34.83 M |
| Cache Read | 1,084,399,183 | 1.084 B |
| **Total Tokens** | **1,123,252,011** | **1.123 B** |

## Methodology

**Artificial Analysis field benchmarks:** Isolated runs on SWE-Bench-Pro-Hard-AA, Terminal-Bench v2, and SWE-Atlas-QnA. Each task represents one bug/issue in a clean session environment.

**MO§ES measurement:** Sustained operator work on a production application (Application Hub) across seven days (2026-05-08 → 2026-05-14). Data derived from 21 sessions, 7,327 conversational turns, and 35,242 lines of code shipped over five build days.

**Task equivalents calculation:** "7,327 ÷ 5 turns/task = 1,465 tasks"

**Cost calculation:**

- Artificial Analysis: `cost_per_task ÷ 20 LOC` (industry SWE-Bench convention)
- MO§ES: "$23.33/wk subscription ÷ 35,242 actual LOC = $0.000662"

## Data Source & Attribution

Field data extracted from artificialanalysis.ai/agents/coding-agents on 2026-05-14.

- **Operator:** DJM · burnmydays (Medium profile) · Ello Cello LLC
- **Patent Portfolio:** 63/877,177 · 63/883,018 · 19/426,028 · 63/991,282 · TM 99408355
