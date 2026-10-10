// NETWORK-BOUNDARY: no fetch/import of remote APIs allowed in aqua-local
//
// LF-05 — typed IndexedDB wrapper for the aqua-local vault.
// `VaultStorage` is the injectable storage interface: domain logic in
// repo.ts / catalog.ts / backup.ts depends only on it, so the module is
// testable without IndexedDB via `createMemoryStorage()`.

import { DB_NAME, DB_VERSION, MIGRATIONS, STORE_SPECS } from './schema.ts'
import type { StoreName } from './schema.ts'

export interface VaultStorage {
  get<T>(store: StoreName, key: string): Promise<T | undefined>
  put<T>(store: StoreName, value: T): Promise<void>
  /** Insert only if the key is absent. Returns false when the key exists. */
  putIfAbsent<T>(store: StoreName, key: string, value: T): Promise<boolean>
  getAll<T>(store: StoreName): Promise<T[]>
  delete(store: StoreName, key: string): Promise<void>
  keys(store: StoreName): Promise<string[]>
  /** Run fn inside a single atomic transaction across the given stores. */
  tx<R>(stores: StoreName[], fn: (s: VaultStorage) => Promise<R>): Promise<R>
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
  })
}

/** Open (and idempotently migrate) the aqua-local IndexedDB database. */
export function openVaultDb(dbName: string = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, DB_VERSION)
    req.onupgradeneeded = (ev) => {
      const db = req.result
      const oldVersion = ev.oldVersion
      for (let v = oldVersion; v < DB_VERSION; v++) {
        // Each step is idempotent: MIGRATIONS steps skip existing stores.
        MIGRATIONS[v]?.(db)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('failed to open aqua-local vault'))
    req.onblocked = () => reject(new Error('aqua-local vault upgrade blocked by open connection'))
  })
}

class IdbStoreTx implements VaultStorage {
  private transaction: IDBTransaction
  constructor(transaction: IDBTransaction) {
    this.transaction = transaction
  }

  get<T>(store: StoreName, key: string): Promise<T | undefined> {
    return reqToPromise(this.transaction.objectStore(store).get(key)) as Promise<T | undefined>
  }
  async put<T>(store: StoreName, value: T): Promise<void> {
    await reqToPromise(this.transaction.objectStore(store).put(value))
  }
  async putIfAbsent<T>(store: StoreName, key: string, value: T): Promise<boolean> {
    const existing = await this.get(store, key)
    if (existing !== undefined) return false
    await this.put(store, value)
    return true
  }
  getAll<T>(store: StoreName): Promise<T[]> {
    return reqToPromise(this.transaction.objectStore(store).getAll()) as Promise<T[]>
  }
  async delete(store: StoreName, key: string): Promise<void> {
    await reqToPromise(this.transaction.objectStore(store).delete(key))
  }
  async keys(store: StoreName): Promise<string[]> {
    const ks = await reqToPromise(this.transaction.objectStore(store).getAllKeys())
    return ks.map(String)
  }
  tx<R>(_stores: StoreName[], fn: (s: VaultStorage) => Promise<R>): Promise<R> {
    // Already inside a transaction; reuse it.
    return fn(this)
  }
}

class IdbStorage implements VaultStorage {
  private db: IDBDatabase
  constructor(db: IDBDatabase) {
    this.db = db
  }

  private async run<R>(mode: IDBTransactionMode, stores: StoreName[], fn: (s: VaultStorage) => Promise<R>): Promise<R> {
    const transaction = this.db.transaction(stores as string[], mode)
    const done = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
    })
    const result = await fn(new IdbStoreTx(transaction))
    await done
    return result
  }

  get<T>(store: StoreName, key: string): Promise<T | undefined> {
    return this.run('readonly', [store], (s) => s.get<T>(store, key))
  }
  put<T>(store: StoreName, value: T): Promise<void> {
    return this.run('readwrite', [store], (s) => s.put(store, value))
  }
  putIfAbsent<T>(store: StoreName, key: string, value: T): Promise<boolean> {
    return this.run('readwrite', [store], (s) => s.putIfAbsent(store, key, value))
  }
  getAll<T>(store: StoreName): Promise<T[]> {
    return this.run('readonly', [store], (s) => s.getAll<T>(store))
  }
  delete(store: StoreName, key: string): Promise<void> {
    return this.run('readwrite', [store], (s) => s.delete(store, key))
  }
  keys(store: StoreName): Promise<string[]> {
    return this.run('readonly', [store], (s) => s.keys(store))
  }
  tx<R>(stores: StoreName[], fn: (s: VaultStorage) => Promise<R>): Promise<R> {
    return this.run('readwrite', stores, fn)
  }
}

/** Open the vault as an injectable VaultStorage backed by IndexedDB. */
export async function openVaultStorage(dbName: string = DB_NAME): Promise<VaultStorage> {
  const db = await openVaultDb(dbName)
  // Sanity: all declared stores exist.
  for (const spec of STORE_SPECS) {
    if (!db.objectStoreNames.contains(spec.name)) {
      throw new Error(`aqua-local vault missing store: ${spec.name}`)
    }
  }
  return new IdbStorage(db)
}

/**
 * In-memory VaultStorage — deterministic, no IndexedDB required.
 * Used by tests (run-tests.mjs) and non-browser contexts.
 */
export function createMemoryStorage(): VaultStorage {
  const keyPathOf = (store: StoreName): string =>
    STORE_SPECS.find((s) => s.name === store)?.keyPath ?? 'id'
  const tables = new Map<StoreName, Map<string, unknown>>()
  const table = (store: StoreName): Map<string, unknown> => {
    let t = tables.get(store)
    if (!t) {
      t = new Map()
      tables.set(store, t)
    }
    return t
  }

  class MemoryStorage implements VaultStorage {
    async get<T>(store: StoreName, key: string): Promise<T | undefined> {
      return table(store).get(key) as T | undefined
    }
    async put<T>(store: StoreName, value: T): Promise<void> {
      const key = (value as Record<string, unknown>)[keyPathOf(store)] as string
      table(store).set(key, value)
    }
    async putIfAbsent<T>(store: StoreName, key: string, value: T): Promise<boolean> {
      if (table(store).has(key)) return false
      table(store).set(key, value)
      return true
    }
    async getAll<T>(store: StoreName): Promise<T[]> {
      return [...table(store).values()] as T[]
    }
    async delete(store: StoreName, key: string): Promise<void> {
      table(store).delete(key)
    }
    async keys(store: StoreName): Promise<string[]> {
      return [...table(store).keys()]
    }
    /**
     * Serialize top-level transactions on a promise chain — this models
     * what IndexedDB actually guarantees (readwrite txs over the same
     * stores cannot interleave), which LF-18's seq allocation relies on.
     * Nested tx calls reuse the same transaction context (like
     * IdbStoreTx) rather than queueing, which would deadlock.
     */
    tx<R>(_stores: StoreName[], fn: (s: VaultStorage) => Promise<R>): Promise<R> {
      const self = this
      const child: VaultStorage = {
        get: (s, k) => self.get(s, k),
        put: (s, v) => self.put(s, v),
        putIfAbsent: (s, k, v) => self.putIfAbsent(s, k, v),
        getAll: (s) => self.getAll(s),
        delete: (s, k) => self.delete(s, k),
        keys: (s) => self.keys(s),
        tx: (_s, f) => f(child), // nested → same context
      }
      const run = this.txChain.then(() => fn(child))
      this.txChain = run.then(
        () => undefined,
        () => undefined,
      )
      return run
    }
    private txChain: Promise<unknown> = Promise.resolve()
  }
  return new MemoryStorage()
}
