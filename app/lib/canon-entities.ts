/**
 * app/lib/canon-entities.ts — Canonical entity values from the MO§ES schema pipeline.
 *
 * Source: Search Authority v1.0.0 (frozen, master-canon-v1.0.0)
 *   → moses-integration Framework → generated Schema → this module
 *
 * These values are CANON-BACKED. They must match the canonical source exactly.
 * Do not hand-write or override these values. If a value conflicts with canon,
 * canon wins.
 *
 * Consumed by: app/app/page.tsx (inline JSON-LD @graph). The page-specific
 * builder functions in app/lib/jsonld.ts do NOT consume this module — they
 * remain locally curated.
 */

export const CANON_ENTITY_IDS = {
  ello_cello_llc: "https://mos2es.com/ontology/0.1/entity/ello_cello_llc",
  moses: "https://mos2es.com/ontology/0.1/entity/moses",
  deric_j_mchenry: "https://mos2es.com/ontology/0.1/entity/deric_j_mchenry",
} as const;

// ─── JSON-LD @context for canon-backed blocks ───────────────────────────────
//
// Custom provenance fields (sourceSystem, canonBacked, authorityApprovalRef,
// associatedWith) are NOT Schema.org properties. They must be mapped to the
// moses namespace so the JSON-LD is semantically valid. This context is
// shared with mos2es-site and sigrank-app — same namespace, same field
// mappings.
export const CANON_LD_CONTEXT = {
  "@vocab": "https://schema.org/",
  moses: "https://mos2es.com/ontology/0.1/",
  sourceSystem: "moses:sourceSystem",
  canonBacked: "moses:canonBacked",
  authorityApprovalRef: "moses:authorityApprovalRef",
  associatedWith: "moses:associatedWith",
} as const;

const CANON_PROVENANCE = {
  sourceSystem: "search-authority",
  canonBacked: true,
} as const;

/** Ello Cello LLC — Organization #organization (canon-backed) */
export const elloCelloLLC = {
  ...CANON_PROVENANCE,
  name: "Ello Cello LLC",
  description:
    "Organization associated with the owner's published works and products, " +
    "including SigRank and MO\u00A7ES\u2122.",
  authorityApprovalRef: "APPROVAL-2026-08-14-001 (ID-ELLO-001)",
  associatedWith: { "@id": CANON_ENTITY_IDS.moses },
} as const;
