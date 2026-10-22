// VENDORED from aqua-companion/src/secrets.mjs. Do not edit: change the source and run
// `npm run vendor:companion` in application-hub-mcp-server/ (CI checks these copies).
// Secrets for the agent interface (`aqua-companion mcp`). The server never
// asks the agent for a secret, never accepts one as a tool argument, and
// never writes one anywhere. Sources:
//   - AQUA_PASSPHRASE / AQUA_VAULT_SECRET in the server's environment, or
//   - with --keychain, the macOS login Keychain via `security
//     find-generic-password` (service "aqua-companion", account = the
//     workspace id; the vault secret, if different, under account
//     "<workspace id>:vault").
// Trade-offs are documented in docs/AGENT.md ("Passphrase").

import { execFileSync } from 'node:child_process'

export const KEYCHAIN_SERVICE = 'aqua-companion'

export class SecretUnavailableError extends Error {
  constructor(message) {
    super(message)
    this.name = 'SecretUnavailableError'
    this.exitCode = 2
  }
}

/** Read one generic password from the macOS Keychain; null when absent. */
export function keychainRead(account, { exec = execFileSync, platform = process.platform } = {}) {
  if (platform !== 'darwin') throw new SecretUnavailableError('--keychain works on macOS only; set AQUA_PASSPHRASE in the server environment instead.')
  try {
    const outText = exec('/usr/bin/security', ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', account, '-w'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 60_000,
    })
    const v = String(outText).replace(/\r?\n$/, '')
    return v || null
  } catch {
    return null
  }
}

/** { passphrase, vaultSecret, source } for a workspace id. Throws when no passphrase is available. */
export function resolveSecrets({ env, keychain, workspaceId, exec, platform }) {
  let passphrase = env.AQUA_PASSPHRASE || null
  let vaultSecret = env.AQUA_VAULT_SECRET || null
  let source = passphrase ? 'env' : null
  if (!passphrase && keychain) {
    passphrase = keychainRead(workspaceId, { exec, platform })
    if (passphrase) source = 'keychain'
    if (!vaultSecret) vaultSecret = keychainRead(`${workspaceId}:vault`, { exec, platform })
  }
  if (!passphrase) {
    throw new SecretUnavailableError(
      keychain
        ? `No Keychain item for service "${KEYCHAIN_SERVICE}", account "${workspaceId}". Add it with: security add-generic-password -s ${KEYCHAIN_SERVICE} -a ${workspaceId} -w`
        : 'The workspace passphrase is not available. Set AQUA_PASSPHRASE in the MCP server environment, or start the server with --keychain (macOS).',
    )
  }
  return { passphrase, vaultSecret: vaultSecret || passphrase, source }
}
