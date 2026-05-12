/**
 * AQUAscore — the in-system applicant strength signal.
 *
 * AQUAscore is the composite across the three pillars that define the
 * product: Applications, Questions, Answers. The brand IS the scoring
 * system at every layer — database tables → sidebar → score.
 *
 * Composition (V1):
 *   AQUAscore = (Applications + Questions + Answers) / 3
 *
 * Boost layers (additive, never subtractive):
 *   - FMS tier   — if a project has been assessed (manual or AI-assisted)
 *   - FundScore  — if a GitHub URL is connected and scanned
 *   - Portfolio  — non-tech surrogate (future)
 *
 * MoatScore = AQUAscore + boost layers, weighted by active_identity.
 * For V1, MoatScore = AQUAscore (boost layers are placeholders until
 * the FMS/FundScore wiring lands).
 */

export interface AquaScoreInputs {
  // Applications signals
  applicationsStarted: number
  applicationsSubmitted: number
  programTypesCovered: number // distinct program types user has applied to

  // Questions signals
  themesCovered: number       // distinct archived_question themes user has answered
  questionsAnswered: number   // total profile_answers count
  questionsUnlocked: number   // total user_question_unlocks count

  // Answers signals
  totalAnswers: number
  lockedConfidenceCount: number
  solidConfidenceCount: number
  averageWordCount: number
  stressTestCount: number
}

export interface AquaScoreBreakdown {
  applications: number  // 0-100
  questions: number     // 0-100
  answers: number       // 0-100
  composite: number     // 0-100, the AQUAscore
}

const TOTAL_THEMES = 12 // matches the QuestionTheme union in database.types

export function computeAquaScore(inputs: AquaScoreInputs): AquaScoreBreakdown {
  // --- Applications pillar ---------------------------------------------
  // Started: 5 apps = halfway to max, 15+ = max
  const startedScore = Math.min(50, (inputs.applicationsStarted / 15) * 50)
  // Submitted (rewards completion): 3 submits = halfway, 10+ = max
  const submittedScore = Math.min(30, (inputs.applicationsSubmitted / 10) * 30)
  // Type diversity: 1 type = 0, 4+ types = max
  const typesScore = Math.min(20, (inputs.programTypesCovered / 4) * 20)
  const applications = Math.round(startedScore + submittedScore + typesScore)

  // --- Questions pillar ------------------------------------------------
  // Theme coverage: 12 themes = 60 pts, scaled linearly
  const themesScore = Math.min(60, (inputs.themesCovered / TOTAL_THEMES) * 60)
  // Answered count vs unlocked (engagement ratio): 100% = 20 pts
  const ratio = inputs.questionsUnlocked > 0
    ? inputs.questionsAnswered / inputs.questionsUnlocked
    : 0
  const engagementScore = Math.min(20, ratio * 20)
  // Depth (raw count, capped): 50+ answers = max 20
  const depthScore = Math.min(20, (inputs.questionsAnswered / 50) * 20)
  const questions = Math.round(themesScore + engagementScore + depthScore)

  // --- Answers pillar --------------------------------------------------
  // Volume: 30 answers = 40 pts, capped
  const volumeScore = Math.min(40, (inputs.totalAnswers / 30) * 40)
  // Confidence quality: locked counts 2x, solid counts 1x, drafts count 0
  const qualitySignals = inputs.lockedConfidenceCount * 2 + inputs.solidConfidenceCount
  const qualityScore = Math.min(30, (qualitySignals / 30) * 30)
  // Stress tests: signal of rigor. 10+ = max 15 pts
  const rigorScore = Math.min(15, (inputs.stressTestCount / 10) * 15)
  // Word-count quality: 50-300 avg words = max 15. Penalty for very short.
  const avg = inputs.averageWordCount
  const wordScore = avg < 30 ? 0
    : avg >= 50 && avg <= 300 ? 15
    : avg < 50 ? Math.round(((avg - 30) / 20) * 15)
    : Math.max(5, Math.round(15 - ((avg - 300) / 200) * 10)) // gentle taper above 300
  const answersPillar = Math.round(volumeScore + qualityScore + rigorScore + wordScore)

  // --- Composite -------------------------------------------------------
  const composite = Math.round((applications + questions + answersPillar) / 3)

  return {
    applications: Math.min(100, applications),
    questions: Math.min(100, questions),
    answers: Math.min(100, answersPillar),
    composite: Math.min(100, composite),
  }
}

/**
 * Delta to next tier — gives the user a concrete next action.
 * Looks at which pillar is weakest and what would move it up the most.
 */
export function nextTierDelta(breakdown: AquaScoreBreakdown, inputs: AquaScoreInputs): {
  pillar: 'applications' | 'questions' | 'answers'
  hint: string
  pointsGain: number
} {
  const pillars = [
    { key: 'applications' as const, score: breakdown.applications },
    { key: 'questions' as const, score: breakdown.questions },
    { key: 'answers' as const, score: breakdown.answers },
  ]
  const weakest = pillars.reduce((min, p) => (p.score < min.score ? p : min))

  if (weakest.key === 'applications') {
    if (inputs.applicationsStarted < 5) {
      return {
        pillar: 'applications',
        hint: `Start ${5 - inputs.applicationsStarted} more application${5 - inputs.applicationsStarted === 1 ? '' : 's'} to push your composite up`,
        pointsGain: Math.round(((5 - inputs.applicationsStarted) / 15) * 50 / 3),
      }
    }
    if (inputs.programTypesCovered < 3) {
      return {
        pillar: 'applications',
        hint: 'Apply to a different program type (accelerator, grant, fellowship) to broaden your reach',
        pointsGain: 5,
      }
    }
  }

  if (weakest.key === 'questions') {
    const missingThemes = Math.max(0, 7 - inputs.themesCovered)
    if (missingThemes > 0) {
      return {
        pillar: 'questions',
        hint: `Answer questions across ${missingThemes} more theme${missingThemes === 1 ? '' : 's'} to round out your profile`,
        pointsGain: Math.round((missingThemes / TOTAL_THEMES) * 60 / 3),
      }
    }
  }

  if (weakest.key === 'answers') {
    if (inputs.stressTestCount < 3) {
      return {
        pillar: 'answers',
        hint: 'Stress-test 3 of your strongest answers to lift your rigor score',
        pointsGain: 5,
      }
    }
    if (inputs.lockedConfidenceCount < 5) {
      return {
        pillar: 'answers',
        hint: 'Move 3 answers from Solid to Locked confidence',
        pointsGain: 6,
      }
    }
  }

  return {
    pillar: weakest.key,
    hint: 'Keep iterating — every answered question, captured moment, and submitted application strengthens your AQUAscore',
    pointsGain: 0,
  }
}

/**
 * Tier label for the composite score.
 * Helps users orient — "67 / Top 15%" beats "67".
 */
export function aquaScoreTier(composite: number): { tier: string; description: string } {
  if (composite >= 85) return { tier: 'Tier 5', description: 'Top 5% — application-ready' }
  if (composite >= 70) return { tier: 'Tier 4', description: 'Top 15% — strong profile' }
  if (composite >= 55) return { tier: 'Tier 3', description: 'Top 35% — solid foundation' }
  if (composite >= 35) return { tier: 'Tier 2', description: 'Building — growing fast' }
  return { tier: 'Tier 1', description: 'Just getting started' }
}
