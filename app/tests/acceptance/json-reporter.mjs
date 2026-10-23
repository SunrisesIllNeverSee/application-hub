// node --test reporter: one JSON line per finished top-level test
// ({ status, name, file, duration_ms, error }). Used by run-acceptance.mjs.
export default async function* jsonReporter(source) {
  for await (const ev of source) {
    if (ev.type !== 'test:pass' && ev.type !== 'test:fail') continue
    const d = ev.data
    if (d.nesting > 0) continue
    const status = ev.type === 'test:fail' ? 'fail' : d.skip ? 'skip' : d.todo ? 'todo' : 'pass'
    const err = d.details?.error
    yield JSON.stringify({ status, name: d.name, file: d.file ?? null, duration_ms: Math.round(d.details?.duration_ms ?? 0), error: err ? String(err.cause?.message ?? err.message ?? err).slice(0, 400) : null }) + '\n'
  }
}
