'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

type ProviderKey = 'anthropic' | 'openai' | 'google' | 'ollama'

interface Integration {
  id: string
  provider: string
  label: string
  status: string
  key_fingerprint: string | null
  base_url: string | null
  model_preference: string | null
  is_default: boolean
  last_verified_at: string | null
}

interface Props {
  integrations: Integration[]
}

const PROVIDERS: { id: ProviderKey; name: string; placeholder: string; hint: string; model: string }[] = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    placeholder: 'sk-ant-api03-...',
    hint: 'Get your key at console.anthropic.com → API Keys',
    model: 'claude-haiku-4-5-20251001',
  },
  {
    id: 'openai',
    name: 'OpenAI (GPT)',
    placeholder: 'sk-proj-...',
    hint: 'Get your key at platform.openai.com → API Keys',
    model: 'gpt-4o-mini',
  },
  {
    id: 'google',
    name: 'Google (Gemini)',
    placeholder: 'AIzaSy...',
    hint: 'Get your key at aistudio.google.com → Get API Key',
    model: 'gemini-2.0-flash',
  },
  {
    id: 'ollama',
    name: 'Ollama (local)',
    placeholder: 'http://localhost:11434',
    hint: 'Run Ollama locally and paste your base URL',
    model: 'llama3.2',
  },
]

export function IntegrationsForm({ integrations: initial }: Props) {
  const [integrations, setIntegrations] = useState<Integration[]>(initial)
  const [activeProvider, setActiveProvider] = useState<ProviderKey | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  const integrationMap = Object.fromEntries(integrations.map(i => [i.provider, i]))

  async function handleSave(providerId: ProviderKey) {
    // Ollama is special — the "API key" field doesn't matter (Ollama ignores
    // bearer tokens). What matters is the base URL + model name. So for Ollama
    // we accept either: (a) base URL typed into the URL field, or (b) base URL
    // typed into the api-key field as a fallback for users following old hints.
    const isOllama = providerId === 'ollama'
    const ollamaUrl = (baseUrl.trim() || apiKey.trim()) || 'http://localhost:11434'

    if (isOllama) {
      // need at least a URL OR the default
      if (!ollamaUrl) return
    } else {
      // every other provider requires an actual api key
      if (!apiKey.trim()) return
    }

    setSaving(true)
    setError(null)

    const body: Record<string, string> = {
      provider: providerId,
      api_key: isOllama ? 'ollama' : apiKey.trim(),
    }
    if (isOllama) {
      body.base_url = ollamaUrl
      body.model_preference = model.trim() || 'llama3.1:8b'
    } else if (baseUrl.trim()) {
      body.base_url = baseUrl.trim()
    }
    if (!isOllama && model.trim()) {
      body.model_preference = model.trim()
    }

    const res = await fetch('/api/integrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to save')
    } else {
      setIntegrations(prev => {
        const filtered = prev.filter(i => i.provider !== providerId)
        return [
          ...filtered,
          {
            ...data.integration,
            base_url: body.base_url ?? null,
            model_preference: body.model_preference ?? null,
            is_default: true,
          },
        ]
      })
      setApiKey('')
      setBaseUrl('')
      setModel('')
      setActiveProvider(null)
    }
    setSaving(false)
  }

  async function handleRemove(integrationId: string, provider: string) {
    setRemoving(integrationId)
    const res = await fetch(`/api/integrations/${integrationId}`, { method: 'DELETE' })
    if (res.ok) {
      setIntegrations(prev => prev.filter(i => i.id !== integrationId))
    }
    setRemoving(null)
    void provider
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
          AI Provider Keys
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Your keys are encrypted server-side and never stored in plain text.
          Application Hub never trains on your data or shares keys with third parties.
        </p>
      </div>

      <div className="space-y-4">
        {PROVIDERS.map(provider => {
          const existing = integrationMap[provider.id]
          const isExpanded = activeProvider === provider.id

          return (
            <div key={provider.id} className="card overflow-hidden">
              {/* Provider header */}
              <div className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    existing?.status === 'active' ? 'bg-success-500' : 'bg-neutral-300 dark:bg-neutral-600'
                  )} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">
                      {provider.name}
                    </p>
                    {existing ? (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Connected · key ending {existing.key_fingerprint ?? '••••••'}
                      </p>
                    ) : (
                      <p className="text-xs text-neutral-400 dark:text-neutral-500">Not connected</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {existing && (
                    <button
                      onClick={() => handleRemove(existing.id, provider.id)}
                      disabled={removing === existing.id}
                      className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-danger-600 dark:hover:text-danger-400 transition-colors"
                    >
                      {removing === existing.id ? 'Removing…' : 'Remove'}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setActiveProvider(isExpanded ? null : provider.id)
                      setApiKey('')
                      setError(null)
                    }}
                    className={cn(
                      'text-xs font-medium px-3 py-1.5 rounded-lg transition-colors',
                      existing
                        ? 'text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                        : 'text-white bg-brand-600 hover:bg-brand-700'
                    )}
                  >
                    {existing ? 'Update' : 'Connect'}
                  </button>
                </div>
              </div>

              {/* Key input */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-0 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 pt-3">
                    {provider.hint}
                  </p>

                  {provider.id === 'ollama' ? (
                    <>
                      <div>
                        <label className="label text-xs">Base URL</label>
                        <input
                          type="text"
                          value={baseUrl}
                          onChange={e => setBaseUrl(e.target.value)}
                          placeholder="http://localhost:11434"
                          className="input w-full font-mono text-sm"
                          autoComplete="off"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="label text-xs">Model</label>
                        <input
                          type="text"
                          value={model}
                          onChange={e => setModel(e.target.value)}
                          placeholder="llama3.1:8b"
                          className="input w-full font-mono text-sm"
                          autoComplete="off"
                        />
                        <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                          Must be a model you&apos;ve pulled (e.g. <code>llama3.1:8b</code>, <code>qwen2.5:3b</code>, <code>llama3.2</code>). Defaults to <code>llama3.1:8b</code> if blank.
                        </p>
                      </div>
                    </>
                  ) : (
                    <input
                      type="password"
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder={provider.placeholder}
                      className="input w-full font-mono text-sm"
                      autoComplete="off"
                      autoFocus
                    />
                  )}

                  {error && (
                    <p className="text-xs text-danger-600 dark:text-danger-400">{error}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSave(provider.id)}
                      disabled={
                        saving ||
                        (provider.id === 'ollama' ? false : !apiKey.trim())
                      }
                      className="btn-primary text-sm"
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setActiveProvider(null); setApiKey(''); setBaseUrl(''); setModel(''); setError(null) }}
                      className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Privacy note */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 bg-neutral-50 dark:bg-neutral-900/50">
        <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
          <span className="font-semibold text-neutral-700 dark:text-neutral-300">Privacy: </span>
          Your API keys are encrypted with AES-256-GCM before storage. The raw key never appears in logs, the database, or any client-readable field. You own your keys — we are the socket, not the provider.
        </p>
      </div>
    </div>
  )
}
