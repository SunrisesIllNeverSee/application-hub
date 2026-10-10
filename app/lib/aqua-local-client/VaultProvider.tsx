'use client'

// IN-01 — shared vault session context for the (app) surfaces.
//
// One provider mounted at the (app) layout level keeps unlock state alive
// across in-app page navigation within a session. The vault secret lives in
// a ref — memory only, never persisted, never sent anywhere. Unlock stays a
// user action (secret prompt); nothing here auto-unlocks.
//
// LAZY: the provider does NOT open IndexedDB on mount. The first consumer
// that needs the vault calls ensureStorage() (or unlock()), which opens the
// DB and transitions status to 'locked'. Flag-off = every function is a
// no-op stub and status stays 'off'.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  getStorage,
  tryUnlock,
  VaultDecryptError,
} from './session'
import type { VaultStorage } from './session'
import { LOCAL_FIRST } from './flag'

export type VaultStatus = 'off' | 'idle' | 'unsupported' | 'locked' | 'unlocked'

export interface VaultContextValue {
  /** True when NEXT_PUBLIC_AQUA_LOCAL_FIRST is enabled for this deployment. */
  enabled: boolean
  status: VaultStatus
  /** Whether the vault already holds records (null while unknown). */
  vaultHasData: boolean | null
  /**
   * Open (memoized) the IndexedDB vault and transition to 'locked'.
   * Safe to call repeatedly — resolves to the same VaultStorage.
   * Throws nothing; on failure status becomes 'unsupported' and it throws
   * the underlying error for the caller to surface honestly.
   */
  ensureStorage: () => Promise<VaultStorage>
  /** User action: attempt unlock with a typed secret. Throws on wrong secret. */
  unlock: (secret: string) => Promise<void>
  /** Drop the secret from memory. Vault records remain on device. */
  lock: () => void
  /**
   * The session secret, or null when locked. Callers must handle null —
   * never persist this value.
   */
  getSecret: () => string | null
}

const VaultContext = createContext<VaultContextValue>({
  enabled: false,
  status: 'off',
  vaultHasData: null,
  ensureStorage: async () => {
    throw new Error('local-first vault not enabled')
  },
  unlock: async () => {
    throw new Error('local-first vault not enabled')
  },
  lock: () => {},
  getSecret: () => null,
})

/** Access the shared vault session. Returns flag-off stubs when unmounted. */
export function useVault(): VaultContextValue {
  return useContext(VaultContext)
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<VaultStatus>(LOCAL_FIRST ? 'idle' : 'off')
  const [vaultHasData, setVaultHasData] = useState<boolean | null>(null)
  const storageRef = useRef<VaultStorage | null>(null)
  const secretRef = useRef<string | null>(null)

  const ensureStorage = useCallback(async (): Promise<VaultStorage> => {
    if (typeof indexedDB === 'undefined') {
      setStatus('unsupported')
      throw new Error('IndexedDB is not available in this browser')
    }
    const s = storageRef.current ?? (await getStorage())
    storageRef.current = s
    if (secretRef.current) {
      setStatus('unlocked')
    } else {
      // Probe record count so the unlock UI can distinguish first-run
      // (create a secret) from existing-vault (enter secret).
      const versions = await s.getAll('versions')
      setVaultHasData(versions.length > 0)
      setStatus('locked')
    }
    return s
  }, [])

  const unlock = useCallback(
    async (secret: string) => {
      const s = await ensureStorage()
      await tryUnlock(s, secret) // throws VaultDecryptError on wrong secret
      secretRef.current = secret
      setStatus('unlocked')
    },
    [ensureStorage],
  )

  const lock = useCallback(() => {
    secretRef.current = null
    setStatus((prev) => (prev === 'off' || prev === 'unsupported' ? prev : 'locked'))
    setVaultHasData((prev) => prev ?? true)
  }, [])

  const getSecret = useCallback((): string | null => {
    const secret = secretRef.current
    if (!secret) {
      setStatus((prev) => (prev === 'unlocked' ? 'locked' : prev))
      return null
    }
    return secret
  }, [])

  const value = useMemo<VaultContextValue>(
    () => ({
      enabled: LOCAL_FIRST,
      status,
      vaultHasData,
      ensureStorage,
      unlock,
      lock,
      getSecret,
    }),
    [status, vaultHasData, ensureStorage, unlock, lock, getSecret],
  )

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
}

export { VaultDecryptError }
