# AQUA Canonical Hub

The Canonical Hub is the portable application core for AQUA. It lets one user answer become reusable across founder programs, college applications, grants, and jobs without collapsing everything into a founder-only model.

## Core Tables

### Canonical Package

```json
{
  "canonical": {
    "id": "uuid",
    "hash": "sha256",
    "version": "1.0",
    "vertical": "founder",
    "title": "Tell us what you have built",
    "aggregate_description": "Durable commitment text",
    "significance_score": 0.84,
    "qualification_tags": ["traction", "proof"],
    "lineage": {}
  },
  "variants": [],
  "lineage": []
}
```

### Application Package

```json
{
  "id": "uuid",
  "program_entity": "YC W26",
  "vertical": "founder",
  "commitments": [
    {
      "canonical_id": "uuid",
      "variant_id": "uuid",
      "fidelity_score": 0.88
    }
  ],
  "outcomes": {},
  "hash": "sha256",
  "lineage": {}
}
```

### Question

```json
{
  "entity": "Techstars",
  "question_text": "What problem are you solving?",
  "vertical": "founder",
  "requirements": {
    "word_limit": 250,
    "required": true
  },
  "lineage": {
    "source_url": "https://example.com/apply"
  }
}
```

### Answer Variant

```json
{
  "canonical_id": "uuid",
  "entity": "YC W26",
  "flavor_text": "Traction-heavy version",
  "fidelity_score": 0.91,
  "content": "Variant answer text",
  "qualification": {
    "tags": ["metrics", "traction"],
    "reward_eligible": true
  },
  "lineage": {
    "parent_hashes": ["sha256"],
    "hash": "sha256"
  }
}
```

## Transfer Rules

1. `1a Entry`: raw application, portal capture, file upload, or markdown import enters `/api/hub/ingest`.
2. `Hub`: `canonical-hub` maps text to canonical commitments or creates new canonicals.
3. `Spokes`: UI surfaces use variants, packages, smart matcher scores, and rewards.
4. `Hub`: qualification, aggregate refresh, and lineage events keep the graph coherent.
5. `2b Exit`: `/api/hub/export` returns JSON, Markdown, or PDF-ready package data with lineage preserved.

## Lineage Events

Every meaningful transition writes to `lineage_events`:

```json
{
  "entity_type": "variant",
  "entity_id": "uuid",
  "action": "map_variant",
  "parent_hashes": ["canonical_hash"],
  "new_hash": "variant_hash",
  "metadata": {
    "fidelity": 0.88,
    "source": "browser_extension"
  }
}
```

## Search Filters

Supported filter dimensions:

- Vertical: `founder`, `college`, `grants`, `jobs`
- Significance: numeric range or high/medium/low bands
- Entity/type: program, company, funder, school, grantor
- Deadline: upcoming, past, or date range
- Requirements: equity, remote, time commitment, funding type
- Qualification tags: metrics, story, leadership, traction
- Fit/AQUAscore: numeric range
- Fidelity/reward eligible: boolean
- Lineage/source: curated, user, aggregate

## Algorithms

The implementation currently includes deterministic fallback formulas so the system can compile and move data. These are not the final IP layer.

Required proprietary formulas:

- Commitment similarity calculation
- Language quantification and ranking metrics
- Fidelity computation
- SigTune/contextual scoring
- Variant reduction thresholds
- Qualification, strength, and reward scoring

Code hooks are marked with `TODO: Your IP` in:

- `supabase/functions/canonical-hub/index.ts`
- `supabase/functions/smart-matcher/index.ts`
- `app/app/api/hub/refine/route.ts`

## Edge Functions

- `canonical-hub`: `ingest`, `qualify`, `export`, `map_variant`
- `smart-matcher`: enriches user persona from answer variants and calls `smart_matcher_search`

## APIs

- `POST /api/hub/ingest`
- `POST /api/hub/export`
- `POST /api/hub/refine`
- `POST /api/hub/smart-matcher`
- `POST /api/hub/autofill-eligibility`
- `POST /api/stripe/payout`

## MCP Tools

- `aqua.ingest_application`
- `aqua.process_reward`
- `aqua.get_variations`
- `aqua.qualify_answer`
- `aqua.get_canonical_package`
- `aqua.export_package`

## Future Desktop Sync

Obsidian/local-first sync should watch a local `~/AQUA-Bank/` folder, convert Markdown files into canonical packages, and support bidirectional updates back into AQUA. This is intentionally future work until the hosted canonical graph stabilizes.

## Optional Voice Layer

The ElevenLabs hack path can add voice review, voice input, and audio fidelity feedback, but it should remain optional and separate from the core Canonical Hub.
