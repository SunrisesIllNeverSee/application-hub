import { createClient } from '@/lib/supabase/server'
import type { ArchivedQuestion } from '@/lib/database.types'
import { OnboardingFlow } from './OnboardingFlow'

export const metadata = { title: 'Welcome — AQUA' }

/**
 * Onboarding gate. New users land here and choose one of two paths:
 *   A) Fill the AQUA starter application (8 high-significance questions
 *      drawn from the archive — themes covered: team, problem, traction,
 *      vision, personal, solution, fit, market).
 *   B) Paste an application they are actively working on. The system
 *      stores it as a captured starting answer.
 *
 * On completion the user gets `onboarding_completed_at = NOW()` and is
 * redirected into /dash with their first AQUAscore signal in place.
 */
export default async function OnboardingPage() {
  const supabase = await createClient()

  // 8 highest-significance archive questions across diverse themes.
  // We pull more than 8 then pick one-per-theme to keep the starter
  // application well-rounded instead of all-team.
  const { data: rawQuestions } = await supabase
    .from('archived_questions')
    .select('id, text, theme, significance_score, asked_by_count, typical_word_limit')
    .in('theme', ['team', 'traction', 'vision', 'problem', 'solution', 'personal', 'fit', 'market'])
    .order('significance_score', { ascending: false, nullsFirst: false })
    .limit(40)
    .returns<Pick<ArchivedQuestion, 'id' | 'text' | 'theme' | 'significance_score' | 'asked_by_count' | 'typical_word_limit'>[]>()

  const seenThemes = new Set<string>()
  const starterQuestions = (rawQuestions ?? []).reduce<typeof rawQuestions>((acc, q) => {
    if (!acc) return acc
    if (acc.length >= 8) return acc
    if (q.theme && !seenThemes.has(q.theme)) {
      seenThemes.add(q.theme)
      acc.push(q)
    }
    return acc
  }, [] as NonNullable<typeof rawQuestions>) ?? []

  return <OnboardingFlow questions={starterQuestions} />
}
