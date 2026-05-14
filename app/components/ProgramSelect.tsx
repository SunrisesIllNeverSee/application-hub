'use client'

import { useRouter } from 'next/navigation'

interface Props {
  programs: { id: string; name: string; status: string }[]
  selected: string
}

export function ProgramSelect({ programs, selected }: Props) {
  const router = useRouter()

  return (
    <select
      id="program-select"
      value={selected}
      onChange={(e) => router.push(`/workstation?tab=export&program=${e.target.value}`)}
      className="input"
    >
      {programs.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  )
}
