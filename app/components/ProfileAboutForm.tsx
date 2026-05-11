'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ApplicantMode } from '@/lib/database.types'
import { APPLICANT_MODES, DEFAULT_MODE, modeContextLabel, modeLabel } from '@/lib/applicantMode'

const STAGE_OPTIONS = [
  { value: 'idea', label: 'Idea' },
  { value: 'prototype', label: 'Prototype' },
  { value: 'pre-seed', label: 'Pre-seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series-a', label: 'Series A' },
  { value: 'growth', label: 'Growth' },
]

const FOUNDER_TYPE_OPTIONS = [
  { value: 'first-time', label: 'First-time founder' },
  { value: 'repeat', label: 'Repeat founder' },
  { value: 'academic', label: 'Academic / researcher' },
  { value: 'operator', label: 'Operator-turned-founder' },
  { value: 'investor-turned-founder', label: 'Investor-turned-founder' },
]

type ProfileRow = Record<string, unknown> | null

interface Props {
  profile: ProfileRow
  userEmail: string
}

export function ProfileAboutForm({ profile: initialProfile, userEmail }: Props) {
  const p = initialProfile as Record<string, string | string[] | boolean | null> | null
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [displayName, setDisplayName] = useState<string>((p?.display_name as string) ?? '')
  const [bio, setBio] = useState<string>((p?.bio as string) ?? '')
  const [companyName, setCompanyName] = useState<string>((p?.company_name as string) ?? '')
  const [companyUrl, setCompanyUrl] = useState<string>((p?.company_url as string) ?? '')
  const [companyOneLiner, setCompanyOneLiner] = useState<string>((p?.company_one_liner as string) ?? '')
  const [stage, setStage] = useState<string>((p?.stage as string) ?? '')
  const [founderType, setFounderType] = useState<string>((p?.founder_type as string) ?? '')
  const [industryTags, setIndustryTags] = useState<string>((p?.industry_tags as string[] ?? []).join(', '))
  const [locationCountry, setLocationCountry] = useState<string>((p?.location_country as string) ?? '')
  const [locationCity, setLocationCity] = useState<string>((p?.location_city as string) ?? '')
  const [teamSize, setTeamSize] = useState<string>(p?.team_size != null ? String(p.team_size) : '')
  const [linkedinUrl, setLinkedinUrl] = useState<string>((p?.linkedin_url as string) ?? '')
  const [githubUrl, setGithubUrl] = useState<string>((p?.github_url as string) ?? '')
  const [twitterUrl, setTwitterUrl] = useState<string>((p?.twitter_url as string) ?? '')

  const initialIdentities: ApplicantMode[] = (() => {
    const raw = p?.identities
    if (Array.isArray(raw)) {
      return raw.filter((m): m is ApplicantMode =>
        APPLICANT_MODES.includes(m as ApplicantMode)
      )
    }
    return [DEFAULT_MODE]
  })()
  const initialActive: ApplicantMode =
    typeof p?.active_identity === 'string' && APPLICANT_MODES.includes(p.active_identity as ApplicantMode)
      ? (p.active_identity as ApplicantMode)
      : (initialIdentities[0] ?? DEFAULT_MODE)

  const [identities, setIdentities] = useState<ApplicantMode[]>(
    initialIdentities.length > 0 ? initialIdentities : [DEFAULT_MODE]
  )
  const [activeIdentity, setActiveIdentity] = useState<ApplicantMode>(initialActive)

  function toggleIdentity(mode: ApplicantMode) {
    setIdentities((prev) => {
      if (prev.includes(mode)) {
        // Don't allow removing the last identity; also don't strand active_identity
        if (prev.length === 1) return prev
        const next = prev.filter((m) => m !== mode)
        if (mode === activeIdentity) {
          setActiveIdentity(next[0])
        }
        return next
      }
      return [...prev, mode]
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setSaving(false); return }

    const tags = industryTags
      .split(',')
      .map((t) => t.trim().toLowerCase().replace(/\s+/g, '_'))
      .filter(Boolean)

    const safeIdentities =
      identities.length > 0 ? identities : [DEFAULT_MODE]
    const safeActive = safeIdentities.includes(activeIdentity)
      ? activeIdentity
      : safeIdentities[0]

    const payload = {
      user_id: user.id,
      display_name: displayName || null,
      bio: bio || null,
      company_name: companyName || null,
      company_url: companyUrl || null,
      company_one_liner: companyOneLiner.slice(0, 50) || null,
      stage: stage || null,
      founder_type: founderType || null,
      industry_tags: tags,
      location_country: locationCountry || null,
      location_city: locationCity || null,
      team_size: teamSize ? parseInt(teamSize, 10) : null,
      linkedin_url: linkedinUrl || null,
      github_url: githubUrl || null,
      twitter_url: twitterUrl || null,
      identities: safeIdentities,
      active_identity: safeActive,
    }

    const { error: upsertError } = await supabase
      .from('user_profiles')
      .upsert(payload, { onConflict: 'user_id' })

    if (upsertError) {
      setError(upsertError.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* Account info (read-only) */}
      <section>
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-4">Account</h2>
        <div className="card p-4">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">Email</p>
          <p className="text-sm text-neutral-800 dark:text-neutral-200">{userEmail}</p>
        </div>
      </section>

      {/* Applicant identities (migration 027) */}
      <section>
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">I am a…</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
          Pick all that apply. The Hub will scope to your <strong>active</strong> identity — you can switch at the top of the Hub at any time. Modes other than Founder are still being built; submitting programs in them earns drip unlocks.
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {APPLICANT_MODES.map((mode) => {
            const checked = identities.includes(mode)
            return (
              <label
                key={mode}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                  checked
                    ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-300 dark:border-brand-700 text-brand-800 dark:text-brand-200'
                    : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleIdentity(mode)}
                  className="w-3.5 h-3.5 accent-brand-600"
                />
                <span>{modeLabel(mode)}</span>
                <span className="text-neutral-400 dark:text-neutral-500">
                  → {modeContextLabel(mode)}
                </span>
              </label>
            )
          })}
        </div>
        <Field label="Active identity" hint="Which one is in focus right now? Drives the Hub view and recommended programs.">
          <select
            value={activeIdentity}
            onChange={(e) => setActiveIdentity(e.target.value as ApplicantMode)}
            className="input"
          >
            {identities.map((mode) => (
              <option key={mode} value={mode}>
                {modeLabel(mode)} · {modeContextLabel(mode)}
              </option>
            ))}
          </select>
        </Field>
      </section>

      {/* Founder identity */}
      <section>
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-4">About you</h2>
        <div className="space-y-4">
          <Field label="Display name">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How you want to be known"
              className="input"
            />
          </Field>
          <Field label="Bio" hint="What's your founder story in a sentence?">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Ex-Stripe engineer, now building in climate."
              className="input resize-none"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Founder type">
              <select value={founderType} onChange={(e) => setFounderType(e.target.value)} className="input">
                <option value="">Select…</option>
                {FOUNDER_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Location">
              <input
                type="text"
                value={locationCity}
                onChange={(e) => setLocationCity(e.target.value)}
                placeholder="City"
                className="input"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="LinkedIn">
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/…"
                className="input"
              />
            </Field>
            <Field label="GitHub">
              <input
                type="url"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/…"
                className="input"
              />
            </Field>
          </div>
        </div>
      </section>

      {/* Company */}
      <section>
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-4">Your company</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Company name">
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Inc."
                className="input"
              />
            </Field>
            <Field label="Website">
              <input
                type="url"
                value={companyUrl}
                onChange={(e) => setCompanyUrl(e.target.value)}
                placeholder="https://…"
                className="input"
              />
            </Field>
          </div>
          <Field label="One-liner" hint={`${companyOneLiner.length}/50 chars`}>
            <input
              type="text"
              value={companyOneLiner}
              onChange={(e) => setCompanyOneLiner(e.target.value.slice(0, 50))}
              placeholder="We help X do Y without Z."
              className="input"
              maxLength={50}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Stage">
              <select value={stage} onChange={(e) => setStage(e.target.value)} className="input">
                <option value="">Select…</option>
                {STAGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Team size">
              <input
                type="number"
                min={1}
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value)}
                placeholder="1"
                className="input"
              />
            </Field>
          </div>
          <Field label="Industry tags" hint="Comma-separated: fintech, b2b, climate, health…">
            <input
              type="text"
              value={industryTags}
              onChange={(e) => setIndustryTags(e.target.value)}
              placeholder="fintech, b2b_saas, climate"
              className="input"
            />
          </Field>
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save profile'}
        </button>
        {saved && (
          <span className="text-sm text-success-600 dark:text-success-400">Saved</span>
        )}
        {error && (
          <span className="text-sm text-danger-600 dark:text-danger-400">{error}</span>
        )}
      </div>
    </form>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">{label}</label>
        {hint && <span className="text-xs text-neutral-400 dark:text-neutral-500">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
