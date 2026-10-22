// Minimal JSON Schema subset for tool arguments: object with typed
// properties (string, integer, number, boolean, array of enum/string),
// enum, minimum/maximum, maxLength, maxItems, required,
// additionalProperties: false. Unknown keywords are ignored.

export const S = (description, extra = {}) => ({ type: 'string', description, maxLength: 500, ...extra })
export const ID = (description) => ({ type: 'string', description, maxLength: 128 })
export const INT = (description, minimum, maximum) => ({ type: 'integer', description, minimum, maximum })
export const NUM = (description, minimum, maximum) => ({ type: 'number', description, minimum, maximum })
export const BOOL = (description) => ({ type: 'boolean', description })
export const ENUM_LIST = (description, values) => ({ type: 'array', description, items: { type: 'string', enum: values }, maxItems: values.length })
export const object = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false })

function checkValue(sch, v, at, errors) {
  switch (sch.type) {
    case 'string':
      if (typeof v !== 'string') return errors.push(`${at} must be a string`)
      if (sch.maxLength !== undefined && v.length > sch.maxLength) errors.push(`${at} is longer than ${sch.maxLength} characters`)
      if (sch.minLength !== undefined && v.length < sch.minLength) errors.push(`${at} is shorter than ${sch.minLength} characters`)
      break
    case 'integer':
      if (!Number.isInteger(v)) return errors.push(`${at} must be an integer`)
      break
    case 'number':
      if (typeof v !== 'number' || !Number.isFinite(v)) return errors.push(`${at} must be a number`)
      break
    case 'boolean':
      if (typeof v !== 'boolean') return errors.push(`${at} must be true or false`)
      break
    case 'array':
      if (!Array.isArray(v)) return errors.push(`${at} must be a list`)
      if (sch.maxItems !== undefined && v.length > sch.maxItems) errors.push(`${at} has more than ${sch.maxItems} items`)
      v.forEach((x, i) => sch.items && checkValue(sch.items, x, `${at}[${i}]`, errors))
      return
    default:
      break
  }
  if (sch.enum && !sch.enum.includes(v)) errors.push(`${at} must be one of: ${sch.enum.join(', ')}`)
  if (typeof v === 'number') {
    if (sch.minimum !== undefined && v < sch.minimum) errors.push(`${at} must be at least ${sch.minimum}`)
    if (sch.maximum !== undefined && v > sch.maximum) errors.push(`${at} must be at most ${sch.maximum}`)
  }
}

/** Returns { ok: true, args } or { ok: false, errors }. Argument names in errors are schema names, never input text. */
export function validateArgs(sch, args) {
  if (args === undefined || args === null) args = {}
  if (typeof args !== 'object' || Array.isArray(args)) return { ok: false, errors: ['arguments must be an object'] }
  const errors = []
  for (const k of Object.keys(args)) {
    if (!Object.hasOwn(sch.properties, k) && sch.additionalProperties === false) errors.push('unknown argument (see the tool inputSchema)')
  }
  for (const r of sch.required ?? []) if (args[r] === undefined) errors.push(`${r} is required`)
  for (const [k, p] of Object.entries(sch.properties)) if (args[k] !== undefined) checkValue(p, args[k], k, errors)
  return errors.length ? { ok: false, errors: [...new Set(errors)] } : { ok: true, args }
}
