'use client'

// LF-15 privacy UX states: offline + backup-reminder banners. Rendered only
// when the vault is unlocked. Both are honest states — no fake sync wording.
export function VaultStatusBanner({
  offline,
  backupDue,
  backupBusy,
  onExportBackup,
  onDismissBackup,
}: {
  offline: boolean
  backupDue: boolean
  backupBusy: boolean
  onExportBackup: () => void
  onDismissBackup: () => void
}) {
  return (
    <>
      {offline && (
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          You&apos;re offline. The vault is fully local — reading, writing, and approving
          answers all keep working. Public catalog browsing may be limited to cached data.
        </p>
      )}
      {backupDue && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-brand-500/20 bg-brand-50/40 px-3 py-2 text-xs text-brand-700 dark:bg-brand-950/20 dark:text-brand-300">
          <span>
            Backup reminder: your answers exist only on this device. Export an encrypted
            backup file to protect against browser data loss.
          </span>
          <button onClick={onExportBackup} disabled={backupBusy} className="btn-primary px-3 py-1 text-xs">
            {backupBusy ? 'Exporting…' : 'Export encrypted backup'}
          </button>
          <button onClick={onDismissBackup} className="text-xs underline underline-offset-2">
            Dismiss
          </button>
        </div>
      )}
    </>
  )
}
