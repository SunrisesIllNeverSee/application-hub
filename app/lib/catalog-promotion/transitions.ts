// Catalog candidate lifecycle — TS mirror of public.catalog_transition_allowed
// and the actor rules in guard_catalog_candidate_events() (migration 058).
// The database is the authority; this mirror lets routes answer 409/403
// before a round trip and keeps the UI honest about which buttons apply.

export const CANDIDATE_STATES = [
  'candidate', 'extracted', 'matched', 'verified', 'approved', 'published', 'rejected', 'withdrawn',
] as const
export type CandidateState = (typeof CANDIDATE_STATES)[number]
export type ActorRole = 'submitter' | 'curator' | 'system'

const FORWARD: Readonly<Partial<Record<CandidateState, CandidateState>>> = {
  candidate: 'extracted',
  extracted: 'matched',
  matched: 'verified',
  verified: 'approved',
  approved: 'published',
}
const PRE_PUBLISHED: readonly CandidateState[] = ['candidate', 'extracted', 'matched', 'verified', 'approved']
export const TERMINAL_STATES: readonly CandidateState[] = ['published', 'rejected', 'withdrawn']

export function isCandidateState(v: unknown): v is CandidateState {
  return typeof v === 'string' && (CANDIDATE_STATES as readonly string[]).includes(v)
}

export function canTransition(from: CandidateState, to: CandidateState): boolean {
  if (FORWARD[from] === to) return true
  return (to === 'rejected' || to === 'withdrawn') && PRE_PUBLISHED.includes(from)
}

/** Which actor role the database accepts for a step into `to`. */
export function actorRolesFor(to: CandidateState): readonly ActorRole[] {
  switch (to) {
    case 'extracted': return ['system', 'curator', 'submitter']
    case 'withdrawn': return ['submitter']
    case 'candidate': return ['submitter']
    default: return ['curator'] // matched, verified, approved, rejected, published
  }
}

/** Steps a curator may request through POST /transition (publish has its own route). */
export const CURATOR_TRANSITION_TARGETS = ['matched', 'verified', 'approved', 'rejected'] as const
export type CuratorTransitionTarget = (typeof CURATOR_TRANSITION_TARGETS)[number]

export function curatorNextSteps(state: CandidateState): CuratorTransitionTarget[] {
  return CURATOR_TRANSITION_TARGETS.filter((t) => canTransition(state, t))
}

/** Mirrors the DB rule for entering `verified`. */
export function verifiedAllowed(allChecksPassed: boolean, override: boolean, note: string | undefined): boolean {
  return allChecksPassed || (override && (note ?? '').trim().length >= 10)
}
