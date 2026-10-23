// M09 W9 — a minimal Supabase-client stand-in that runs REAL SQL against a
// local throwaway Postgres (psql over loopback TCP). It replaces only the
// PostgREST HTTP layer, for the query shapes the catalog-promotion handlers
// use: .rpc(name, namedArgs), and .from(t).select(cols incl. embedded
// `alias:table(cols)` / `alias:table!inner(cols)`).eq().in().order().limit()
// .maybeSingle()/.single()/await, and .update(obj).eq().
//
// Every statement runs as a Postgres role the way PostgREST would:
//   admin  → SET ROLE service_role
//   user   → SET ROLE authenticated + request.jwt.claims {sub, role}
//   anon   → SET ROLE anon
// so grants, RLS, triggers and the 058 RPCs decide the outcome. Errors come
// back as { code: SQLSTATE, message } like PostgREST.
//
// Test infrastructure only — never imported by app code.

import { spawnSync } from 'node:child_process'

// Foreign keys used by the embedded selects (child.parentTable -> [fk column, parent key]).
const FKS = {
  'catalog_candidates.catalog_sources': ['source_id', 'id'],
  'program_questions.archived_questions': ['archived_question_id', 'id'],
  'program_questions.programs': ['program_id', 'id'],
}

const ident = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(s)) throw new Error(`unsafe identifier: ${s}`)
  return `"${s}"`
}
export function lit(v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') { if (!Number.isFinite(v)) throw new Error('bad number'); return String(v) }
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  return `'${s.replace(/'/g, "''")}'`
}

export function psql(conn, sql) {
  const r = spawnSync('psql', ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-h', conn.host, '-p', String(conn.port), '-U', conn.user, '-d', conn.db],
    { input: `\\set VERBOSITY verbose\n${sql}\n`, encoding: 'utf8' })
  if (r.status !== 0) {
    const m = /ERROR:\s+([0-9A-Z]{5}):\s+([^\n]*)/.exec(r.stderr ?? '')
    return { error: { code: m?.[1] ?? 'XX000', message: m?.[2] ?? (r.stderr ?? '').trim().slice(0, 300) } }
  }
  const lines = (r.stdout ?? '').split('\n').filter((l) => l.length > 0)
  return { out: lines.length ? lines[lines.length - 1] : '' }
}

function rolePrelude(as) {
  if (as.role === 'service_role') return 'SET ROLE service_role;'
  if (as.role === 'anon') return "SET ROLE anon; SELECT set_config('request.jwt.claims', '{\"role\":\"anon\"}', false) \\g /dev/null"
  if (as.role === 'authenticated') {
    const claims = JSON.stringify({ sub: as.uid, role: 'authenticated' })
    return `SET ROLE authenticated; SELECT set_config('request.jwt.claims', ${lit(claims)}, false) \\g /dev/null`
  }
  if (as.role === 'postgres') return ''
  throw new Error(`unknown role ${as.role}`)
}

function splitTop(s) {
  const parts = []; let depth = 0; let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

function buildSelect(table, cols, filters, order, limit) {
  const t = 't0'
  const items = []
  const embeds = {}
  for (const c of splitTop(cols)) {
    const m = /^([a-z_]+):([a-z_]+)(!inner)?\((.*)\)$/i.exec(c)
    if (m) {
      const [, alias, parent, inner, sub] = m
      const fk = FKS[`${table}.${parent}`]
      if (!fk) throw new Error(`no FK mapping for ${table}.${parent}`)
      embeds[alias] = { parent, fk, inner: Boolean(inner) }
      const subCols = splitTop(sub).map((x) => `e.${ident(x)}`).join(', ')
      items.push(`(SELECT to_jsonb(s) FROM (SELECT ${subCols} FROM public.${ident(parent)} e WHERE e.${ident(fk[1])} = ${t}.${ident(fk[0])}) s) AS ${ident(alias)}`)
    } else {
      items.push(`${t}.${ident(c)}`)
    }
  }
  const where = []
  for (const [col, op, val] of filters) {
    const dot = col.indexOf('.')
    if (dot > 0) {
      const alias = col.slice(0, dot); const sub = col.slice(dot + 1)
      const e = embeds[alias]
      if (!e) throw new Error(`filter on unknown embed ${alias}`)
      where.push(`EXISTS (SELECT 1 FROM public.${ident(e.parent)} f WHERE f.${ident(e.fk[1])} = ${t}.${ident(e.fk[0])} AND f.${ident(sub)} ${op === 'in' ? `IN (${val.map(lit).join(', ')})` : `= ${lit(val)}`})`)
      continue
    }
    where.push(op === 'in' ? `${t}.${ident(col)} IN (${val.length ? val.map(lit).join(', ') : 'NULL'})` : `${t}.${ident(col)} = ${lit(val)}`)
  }
  for (const [alias, e] of Object.entries(embeds)) {
    if (e.inner && !filters.some(([c]) => c.startsWith(`${alias}.`))) where.push(`EXISTS (SELECT 1 FROM public.${ident(e.parent)} f WHERE f.${ident(e.fk[1])} = ${t}.${ident(e.fk[0])})`)
  }
  const orderSql = order.length ? ` ORDER BY ${order.map(([c, asc]) => `${t}.${ident(c)} ${asc ? 'ASC' : 'DESC'}`).join(', ')}` : ''
  const limitSql = limit ? ` LIMIT ${Number(limit)}` : ''
  return `SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)::text FROM (SELECT ${items.join(', ')} FROM public.${ident(table)} ${t}${where.length ? ` WHERE ${where.join(' AND ')}` : ''}${orderSql}${limitSql}) r;`
}

/** A Supabase-like client bound to one Postgres role. `log` collects every statement kind (no values). */
export function sqlClient(conn, as, log = []) {
  const exec = (sql) => psql(conn, `${rolePrelude(as)}\n${sql}`)
  function from(table) {
    const st = { op: 'select', cols: '*', filters: [], order: [], limit: null, payload: null }
    const run = () => {
      log.push({ as: as.role, op: st.op, table })
      if (st.op === 'update') {
        if (!st.filters.length) return { data: null, error: { code: '21000', message: 'UPDATE requires a WHERE clause' } }
        const sets = Object.entries(st.payload).map(([k, v]) => `${ident(k)} = ${v !== null && typeof v === 'object' ? `${lit(v)}::jsonb` : lit(v)}`).join(', ')
        const where = st.filters.map(([c, op, v]) => (op === 'in' ? `${ident(c)} IN (${v.map(lit).join(', ')})` : `${ident(c)} = ${lit(v)}`)).join(' AND ')
        const r = exec(`WITH u AS (UPDATE public.${ident(table)} SET ${sets} WHERE ${where} RETURNING 1) SELECT count(*) FROM u;`)
        return r.error ? { data: null, error: r.error } : { data: null, error: null, count: Number(r.out) }
      }
      const r = exec(buildSelect(table, st.cols, st.filters, st.order, st.limit))
      if (r.error) return { data: null, error: r.error }
      return { data: JSON.parse(r.out || '[]'), error: null }
    }
    const b = {
      select(cols = '*') { st.cols = cols.replace(/\s+/g, ' ').trim(); return b },
      update(p) { st.op = 'update'; st.payload = p; return b },
      eq(c, v) { st.filters.push([c, 'eq', v]); return b },
      in(c, v) { st.filters.push([c, 'in', v]); return b },
      order(c, o = {}) { st.order.push([c, o.ascending !== false]); return b },
      limit(n) { st.limit = n; return b },
      maybeSingle() {
        const r = run()
        if (r.error || st.op !== 'select') return Promise.resolve(r)
        if (r.data.length > 1) return Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'multiple rows' } })
        return Promise.resolve({ data: r.data[0] ?? null, error: null })
      },
      single() {
        const r = run()
        if (r.error) return Promise.resolve(r)
        if (r.data.length !== 1) return Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'not exactly one row' } })
        return Promise.resolve({ data: r.data[0], error: null })
      },
      then(res, rej) { return Promise.resolve(run()).then(res, rej) },
    }
    return b
  }
  function rpc(name, args = {}) {
    log.push({ as: as.role, op: 'rpc', table: name })
    const named = Object.entries(args).map(([k, v]) => `${ident(k)} => ${v !== null && typeof v === 'object' ? `${lit(v)}::jsonb` : lit(v)}`).join(', ')
    const r = exec(`SELECT to_jsonb(public.${ident(name)}(${named}))::text;`)
    if (r.error) return Promise.resolve({ data: null, error: r.error })
    return Promise.resolve({ data: r.out ? JSON.parse(r.out) : null, error: null })
  }
  return { from, rpc, auth: {} }
}

/** Plain SQL as a role; returns the last output line or throws. */
export function sqlAs(conn, as, sql) {
  const r = psql(conn, `${rolePrelude(as)}\n${sql}`)
  if (r.error) { const e = new Error(`${r.error.code}: ${r.error.message}`); e.code = r.error.code; throw e }
  return r.out
}
