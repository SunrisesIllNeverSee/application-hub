// =============================================================================
// Applicant Modes (migration 027)
// =============================================================================
// A user can identify as one or more applicant modes. The active mode scopes
// the Hub view and drives per-mode messaging. The mapping from mode →
// opportunity_kind[] lives here (not in the database) so it can evolve without
// a schema change.
//
// Mode philosophy:
//   - Tech Startup is the deeply-curated launch vertical (questions mapped,
//     program DNA computed, fit scores enabled).
//   - Jobs / Schools / Grants run on the same engine but are currently sparse.
//     The empty-state CTA invites users to contribute programs in exchange
//     for drip unlocks (see /hub/submit and migration 027).
// =============================================================================

import type { ApplicantMode } from '@/lib/database.types'

/** All applicant modes, in display order. */
export const APPLICANT_MODES: readonly ApplicantMode[] = [
  'founder',
  'job_seeker',
  'student',
  'researcher',
] as const

/** Default mode for a freshly-created profile. */
export const DEFAULT_MODE: ApplicantMode = 'founder'

/**
 * Human-readable identity label.
 * Each label is phrased as a who-you-are claim ("I am a Founder") rather
 * than a what-you're-applying-to claim. The mirror B2B view (future) will
 * flip the verb ("We're hiring Job-seekers").
 */
export function modeLabel(mode: ApplicantMode): string {
  switch (mode) {
    case 'founder':
      return 'Founder'
    case 'job_seeker':
      return 'Job-seeker'
    case 'student':
      return 'Student'
    case 'researcher':
      return 'Researcher'
  }
}

/**
 * What kind of programs this mode is *for*. Used in marketing copy where
 * we want to talk about the institution side ("accelerators, jobs, grants").
 */
export function modeContextLabel(mode: ApplicantMode): string {
  switch (mode) {
    case 'founder':
      return 'Tech Startups'
    case 'job_seeker':
      return 'Jobs'
    case 'student':
      return 'Schools'
    case 'researcher':
      return 'Grants'
  }
}

/**
 * Map applicant mode → the set of opportunity_kind values that surface for
 * that mode in the Hub. A given opportunity_kind may appear under more than
 * one mode (e.g. fellowship under both founder and researcher); the UI uses
 * the kind set to filter the program list.
 */
export function modeToOpportunityKinds(mode: ApplicantMode): readonly string[] {
  switch (mode) {
    case 'founder':
      return ['accelerator', 'vc', 'fellowship']
    case 'job_seeker':
      return ['job_fulltime', 'job_internship', 'job_contract']
    case 'student':
      return ['school_undergrad', 'school_grad', 'school_professional']
    case 'researcher':
      return ['grant', 'fellowship']
  }
}

/**
 * Map applicant mode → the legacy program_type values used by `programs.type`.
 * The legacy `type` column is what the Hub list currently filters by; once
 * the Hub migrates to `programs.kind` (opportunity_kind), prefer the kind
 * mapping above and remove this.
 */
export function modeToLegacyTypes(mode: ApplicantMode): readonly string[] {
  switch (mode) {
    case 'founder':
      return ['accel', 'vc', 'fellowship']
    case 'job_seeker':
      return ['job']
    case 'student':
      return ['uni']
    case 'researcher':
      return ['grant', 'fellowship']
  }
}

/**
 * Tech Startup is the only deeply-curated vertical today. Other modes show
 * sparse-state CTAs that funnel users to /hub/submit (where they earn drip
 * unlocks for accepted submissions — see migration 027's award trigger).
 */
export function isModeDeeplyCurated(mode: ApplicantMode): boolean {
  return mode === 'founder'
}

/**
 * Default opportunity_kind preselected on /hub/submit for a given mode.
 * Lets users contribute a program that's relevant to whatever mode they
 * were just looking at when they hit "submit".
 */
export function defaultSubmitKindForMode(mode: ApplicantMode): string {
  switch (mode) {
    case 'founder':
      return 'accelerator'
    case 'job_seeker':
      return 'job_fulltime'
    case 'student':
      return 'school_grad'
    case 'researcher':
      return 'grant'
  }
}

/**
 * Unified label replacing both "Sparse" (ModeSelector) and "Soon" (landing page).
 * RFC = Request for Community. Signals action and contribution, not absence.
 */
export function modeCommunityLabel(mode: ApplicantMode): string {
  return isModeDeeplyCurated(mode) ? 'Live' : 'RFC'
}

/**
 * Tooltip / aria-label for the RFC badge.
 */
export function modeCommunityDescription(mode: ApplicantMode): string {
  const ctx = modeContextLabel(mode).toLowerCase()
  return `The ${ctx} vertical needs programs. Submit one and earn credits toward your answer bank.`
}
