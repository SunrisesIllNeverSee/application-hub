'use client'

import { useMemo, useState } from 'react'

export type CanonicalVariationGroup = {
  canonical: {
    id: string
    title: string
    aggregate_description?: string | null
    significance_score?: number | null
  }
  variants: Array<{
    id: string
    entity?: string | null
    flavor_text?: string | null
    fidelity_score?: number | null
    content: string
    updated_at?: string | null
    lineage?: Record<string, unknown> | null
  }>
}

type VariationPanelProps = {
  groups: CanonicalVariationGroup[]
  onUseVariant?: (variantId: string) => void
  onEditVariant?: (variantId: string) => void
}

export function VariationPanel({ groups, onUseVariant, onEditVariant }: VariationPanelProps) {
  const firstVariantId = groups[0]?.variants[0]?.id ?? ''
  const [selectedId, setSelectedId] = useState(firstVariantId)

  const selected = useMemo(() => {
    for (const group of groups) {
      const variant = group.variants.find((item) => item.id === selectedId)
      if (variant) return { group, variant }
    }
    return null
  }, [groups, selectedId])

  return (
    <div className="grid min-h-[480px] overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-100 lg:grid-cols-[320px_1fr]">
      <aside className="border-b border-neutral-800 lg:border-b-0 lg:border-r">
        <div className="border-b border-neutral-800 px-4 py-3">
          <p className="text-sm font-semibold">Related Variants</p>
          <p className="text-xs text-neutral-500">Grouped by canonical commitment</p>
        </div>
        <div className="max-h-[520px] overflow-y-auto p-2">
          {groups.map((group) => (
            <div key={group.canonical.id} className="mb-3">
              <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-neutral-500">{group.canonical.title}</p>
              {group.variants.map((variant) => (
                <button
                  key={variant.id}
                  className={`w-full rounded-md px-2 py-2 text-left transition-all duration-300 ${variant.id === selectedId ? 'bg-brand-600/20 text-brand-100' : 'text-neutral-300 hover:bg-neutral-900'}`}
                  onClick={() => setSelectedId(variant.id)}
                >
                  <span className="block truncate text-sm">{variant.entity ?? variant.flavor_text ?? 'General variant'}</span>
                  <span className="mt-0.5 block text-xs text-neutral-500">fidelity {Number(variant.fidelity_score ?? 0).toFixed(2)}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      <section className="flex flex-col">
        {selected ? (
          <>
            <div className="border-b border-neutral-800 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-brand-300">{selected.variant.entity ?? 'Variant'}</p>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight">{selected.group.canonical.title}</h3>
                </div>
                <div className="text-right text-xs text-neutral-500">
                  <p>Fidelity</p>
                  <p className="text-lg font-semibold text-neutral-100">{Number(selected.variant.fidelity_score ?? 0).toFixed(2)}</p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
                <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-200">{selected.variant.content}</p>
              </div>
              <div className="mt-5 border-l border-neutral-800 pl-4">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Variation timeline</p>
                <div className="mt-3 space-y-3 text-sm text-neutral-400">
                  <p>Canonical created → variant mapped → fidelity qualified → package-ready.</p>
                  <p className="text-xs">DAG lineage is stored in `lineage_events` and variant lineage JSON.</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-800 p-4">
              <button className="btn-secondary" onClick={() => onEditVariant?.(selected.variant.id)}>Edit Variant</button>
              <button className="btn-primary" onClick={() => onUseVariant?.(selected.variant.id)}>Use in Workspace</button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">No variants yet</div>
        )}
      </section>
    </div>
  )
}
