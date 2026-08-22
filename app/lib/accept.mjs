const DEFAULT_PRODUCES = ['text/html', 'text/markdown']

export function parseAccept(header) {
  return header
    .split(',')
    .map((raw) => {
      const parts = raw.trim().split(';').map((part) => part.trim())
      const type = (parts[0] || '').toLowerCase()
      let q = 1

      for (const param of parts.slice(1)) {
        const [name, value] = param.split('=').map((part) => part.trim())
        if (name?.toLowerCase() === 'q') {
          const parsed = Number(value)
          if (!Number.isNaN(parsed)) q = Math.max(0, Math.min(1, parsed))
        }
      }

      const specificity = type === '*/*' ? 0 : type.endsWith('/*') ? 1 : 2
      return { type, q, specificity }
    })
    .filter((entry) => entry.type)
}

function matches(entry, candidate) {
  if (entry.type === '*/*') return true
  if (entry.type.endsWith('/*')) return candidate.startsWith(entry.type.slice(0, -1))
  return entry.type === candidate
}

export function preferredType(header, produces = DEFAULT_PRODUCES) {
  if (!header) return produces[0] ?? null

  const entries = parseAccept(header)
  if (entries.length === 0) return produces[0] ?? null

  let bestType = null
  let bestQ = -1
  let bestPosition = Infinity

  for (const candidate of produces) {
    let matched = null
    let matchedPosition = Infinity

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]
      if (!matches(entry, candidate)) continue

      if (
        matched === null ||
        entry.specificity > matched.specificity ||
        (entry.specificity === matched.specificity && index < matchedPosition)
      ) {
        matched = entry
        matchedPosition = index
      }
    }

    if (!matched || matched.q <= 0) continue

    if (matched.q > bestQ || (matched.q === bestQ && matchedPosition < bestPosition)) {
      bestType = candidate
      bestQ = matched.q
      bestPosition = matchedPosition
    }
  }

  return bestType
}

export function appendVaryAccept(headers) {
  const existing = headers.get('Vary')
  if (!existing) {
    headers.set('Vary', 'Accept')
    return
  }

  const tokens = existing.split(',').map((token) => token.trim().toLowerCase())
  if (!tokens.includes('accept')) headers.set('Vary', `${existing}, Accept`)
}
