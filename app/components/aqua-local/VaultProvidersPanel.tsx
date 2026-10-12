'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  SUPPORTED_PROVIDERS,
  listProviders,
  saveProvider,
  removeProvider,
  testProvider,
} from '@/lib/aqua-local-client/session'
import type { ProviderConfigSummary } from '@/lib/aqua-local-client/session'
import { useVault } from '@/lib/aqua-local-client/VaultProvider'

// SP021/LF-16 — local-first BYOK configuration. Keys are stored ONLY in the
// vault (encrypted under the user's secret); connectivity tests and
// generation calls go browser→provider directly. The AQUA server never sees
// key material or request content.

export function VaultProvidersPanel() {
  const vault = useVault()
  const [providers, setProviders] = useState<ProviderConfigSummary[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<Record<string, string>>({})
  const [error, setError] = useState<Record<string, string>>({})

  const refresh = useCallback(async () => {
    try {
      setProviders(await listProviders(await vault.ensureStorage()))
    } catch {
      // storage open failure — leave list as-is
    }
  }, [vault])

  useEffect(() => {
    if (vault.status === 'unlocked') void refresh()
    if (vault.status === 'locked') setProviders([])
  }, [vault.status, refresh])

  const byId = Object.fromEntries(providers.map((p) => [p.provider_id, p]))

  const flash = (id: string, msg: string) =>
    setNotice((n) => ({ ...n, [id]: msg }))
  const fail = (id: string, msg: string) =>
    setError((e) => ({ ...e, [id]: msg }))
  const clearMsg = (id: string) => {
    setNotice((n) => ({ ...n, [id]: '' }))
    setError((e) => ({ ...e, [id]: '' }))
  }

  async function handleSave(id: string) {
    const secret = vault.getSecret()
    if (!secret) return
    clearMsg(id)
    setBusy(`save:${id}`)
    try {
      await saveProvider(await vault.ensureStorage(), secret, {
        provider_id: id,
        api_key: apiKey || undefined,
        base_url: baseUrl || undefined,
        model_preference: model || undefined,
      })
      flash(id, 'Saved — key encrypted in your local vault only.')
      setApiKey('')
      setOpenId(null)
      await refresh()
    } catch (e) {
      fail(id, e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(null)
    }
  }

  async function handleTest(id: string) {
    const secret = vault.getSecret()
    if (!secret) return
    clearMsg(id)
    setBusy(`test:${id}`)
    try {
      const storage = await vault.ensureStorage()
      // If a fresh key is typed but not saved yet, test it in-memory by
      // saving first — the test probes the STORED config so "tested" never
      // means something other than what generation will use.
      const detail = await testProvider(storage, secret, id)
      flash(id, detail)
      await refresh()
    } catch (e) {
      fail(id, e instanceof Error ? e.message : 'Connection failed')
    } finally {
      setBusy(null)
    }
  }

  async function handleRemove(id: string) {
    clearMsg(id)
    setBusy(`rm:${id}`)
    try {
      await removeProvider(await vault.ensureStorage(), id)
      await refresh()
    } catch (e) {
      fail(id, e instanceof Error ? e.message : 'Remove failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <h2 className="font-medium text-neutral-900 dark:text-neutral-100">AI providers (local vault)</h2>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Keys are encrypted in this device&apos;s vault and sent only to the provider you choose —
        never to this app&apos;s server. Each generation requires your explicit consent.
      </p>

      <div className="mt-4 space-y-3">
        {SUPPORTED_PROVIDERS.map((def) => {
          const cfg = byId[def.id]
          const expanded = openId === def.id
          return (
            <div key={def.id} className="rounded-lg border border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={
                      cfg
                        ? 'h-2 w-2 rounded-full bg-success-500'
                        : 'h-2 w-2 rounded-full bg-neutral-300 dark:bg-neutral-600'
                    }
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {def.name}
                    </p>
                    <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                      {cfg
                        ? `Configured · ${cfg.has_key ? 'key stored' : 'endpoint only'}` +
                          (cfg.model_preference ? ` · ${cfg.model_preference}` : '') +
                          (cfg.last_tested_at ? ' · tested' : ' · not tested')
                        : 'Not configured'}
                    </p>
                    {/* Test outcome must be visible even with the card collapsed. */}
                    {error[def.id] && !expanded && (
                      <p className="truncate text-xs text-danger-600 dark:text-danger-400">{error[def.id]}</p>
                    )}
                    {notice[def.id] && !expanded && (
                      <p className="truncate text-xs text-success-700 dark:text-success-400">{notice[def.id]}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {cfg && (
                    <>
                      <button
                        onClick={() => void handleTest(def.id)}
                        disabled={busy === `test:${def.id}`}
                        className="text-xs text-neutral-600 hover:text-neutral-800 disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-200"
                      >
                        {busy === `test:${def.id}` ? 'Testing…' : 'Test'}
                      </button>
                      <button
                        onClick={() => void handleRemove(def.id)}
                        disabled={busy === `rm:${def.id}`}
                        className="text-xs text-neutral-400 hover:text-danger-600 dark:hover:text-danger-400"
                      >
                        Remove
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      clearMsg(def.id)
                      setOpenId(expanded ? null : def.id)
                      setApiKey('')
                      setBaseUrl(cfg?.base_url ?? '')
                      setModel(cfg?.model_preference ?? '')
                    }}
                    className="rounded-md border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  >
                    {cfg ? 'Update' : 'Configure'}
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="space-y-3 border-t border-neutral-100 px-4 py-3 dark:border-neutral-800">
                  {def.requiresKey && (
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={cfg?.has_key ? 'Key stored — paste new key to rotate' : def.keyPlaceholder}
                      className="input w-full font-mono text-sm"
                      autoComplete="off"
                    />
                  )}
                  {def.baseUrlLabel && (
                    <input
                      type="text"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder="http://localhost:11434 or your tunnel URL"
                      className="input w-full font-mono text-sm"
                      autoComplete="off"
                    />
                  )}
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder={def.modelPlaceholder}
                    className="input w-full font-mono text-sm"
                    autoComplete="off"
                  />
                  {error[def.id] && (
                    <p className="text-xs text-danger-600 dark:text-danger-400">{error[def.id]}</p>
                  )}
                  {notice[def.id] && (
                    <p className="text-xs text-success-700 dark:text-success-400">{notice[def.id]}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handleSave(def.id)}
                      disabled={busy === `save:${def.id}`}
                      className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
                    >
                      {busy === `save:${def.id}` ? 'Saving…' : 'Save to vault'}
                    </button>
                    <button
                      onClick={() => setOpenId(null)}
                      className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                    The key is encrypted under your vault secret before it is written. Test and
                    generation calls go directly from this browser to {def.name}.
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
