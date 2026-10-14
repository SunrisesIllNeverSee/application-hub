'use client'

// Intake packet surface — vault-local applications imported via
// LocalIntakePanel get the SAME packet lifecycle as hosted programs:
// select versions → freeze (encrypted manifest) → sign → local export.
// There is no hosted workspace page for `local-intake-*` ids (they are
// not rows in the programs table), so packets live here on the vault
// surface, keyed by the intake application id.

import { useCallback, useEffect, useState } from 'react'
import { useVault } from '@/lib/aqua-local-client/VaultProvider'
import { listLocalIntakes } from '@/lib/aqua-local/intake.ts'
import { VaultPacketPanel, type PacketQuestion } from '@/components/aqua-local/VaultPacketPanel'

interface IntakeRecord {
  application_id?: string
  entity?: { name?: string }
  application?: { title?: string }
  questions?: Array<{
    occurrence_id?: string
    text?: string
    order_index?: number
    is_required?: boolean
  }>
  imported_at?: string
}

export function IntakePacketSection() {
  const vault = useVault()
  const [intakes, setIntakes] = useState<IntakeRecord[]>([])

  const load = useCallback(async () => {
    if (vault.status !== 'unlocked') return
    try {
      const storage = await vault.ensureStorage()
      setIntakes((await listLocalIntakes(storage, vault.getSecret()!)) as IntakeRecord[])
    } catch {
      setIntakes([])
    }
  }, [vault])

  useEffect(() => {
    void load()
  }, [load])

  if (intakes.length === 0) return null

  return (
    <section className="mt-6 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <h2 className="font-medium text-neutral-900 dark:text-neutral-100">
        Intake applications — packets
      </h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Applications imported on this device. Freeze, sign and export packets
        locally — nothing is transmitted.
      </p>
      <div className="mt-4 space-y-6">
        {intakes.map((r) => {
          const appId = r.application_id
          if (!appId || !Array.isArray(r.questions)) return null
          const name =
            r.entity?.name ?? r.application?.title ?? appId
          const questions: PacketQuestion[] = r.questions
            .filter((q): q is typeof q & { occurrence_id: string } =>
              typeof q?.occurrence_id === 'string',
            )
            .map((q) => ({
              archived_question_id: q.occurrence_id,
              asked_as: q.text ?? null,
              is_required: q.is_required ?? null,
              order_index: q.order_index ?? null,
            }))
          return (
            <div
              key={appId}
              className="rounded-lg border border-neutral-200/70 p-4 dark:border-neutral-800"
            >
              <VaultPacketPanel
                programId={appId}
                programName={name}
                questions={questions}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
