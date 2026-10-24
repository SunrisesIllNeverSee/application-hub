// WorkspaceStore — storage abstraction under Workspace (hosted-MCP path).
// The fs implementation (fsafe.mjs) is the default; a Supabase implementation
// implements this contract and keeps every Workspace caller unchanged.
// Keys/derive/unlock stay client-side — the store sees ciphertext only.

/**
 * @typedef {Object} WorkspaceStore
 * @property {(wsid: string) => Promise<{manifest: object, rev: number} | null>} loadManifest
 * @property {(manifest: object) => Promise<number>} createManifest          // returns rev; CAS-create
 * @property {(manifest: object, expectRev: number) => Promise<number>} saveManifest  // CAS; throws manifest_rev_conflict
 * @property {(path: string) => Promise<Uint8Array | null>} getFile          // record file bytes
 * @property {(path: string, bytes: Uint8Array) => Promise<void>} putNewFile // O_EXCL; throws file_exists
 * @property {(path: string, bytes: Uint8Array) => Promise<void>} replaceFile // atomic replace (rekey/.bak)
 * @property {(path: string) => Promise<boolean>} fileExists
 * @property {(from: string, to: string) => Promise<void>} moveFile          // conflict archive, placement
 * @property {(prefix?: string) => Promise<string[]>} listFiles              // walkInside/recordFiles
 * @property {(logName: string, line: string) => Promise<void>} appendLog    // audit append (never update)
 * @property {(logName: string) => Promise<{lastLine: string | null}>} readLogTail // prev-hash chain
 * @property {<R>(fn: () => Promise<R>) => Promise<R>} tx                    // atomic blob+manifest+audit commit
 */

/** Local filesystem store — wraps fsafe, zero behavior change. */
export function createFsStore(root) {
  // implemented by wrapping the existing fsafe helpers 1:1; Workspace gets a
  // `store` param defaulting to this so local behavior is identical.
  throw new Error('createFsStore: wire to fsafe.mjs (scaffold)')
}

/** Hosted store — Supabase rows behind aqua_workspace_commit RPC. */
export function createSupabaseStore(client, workspaceRowId) {
  // client = supabase-js with the caller's bearer JWT (RLS does isolation).
  // workspaceRowId = aqua_workspaces.id.
  throw new Error('createSupabaseStore: implement against migration 063 (scaffold)')
}

export const __scaffold = true
