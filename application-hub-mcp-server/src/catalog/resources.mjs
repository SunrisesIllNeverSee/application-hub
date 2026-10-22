// MCP resources over the public catalog:
//   aqua://programs              approved canonical programs (ids, slugs, deadlines)
//   aqua://programs/{slug}       one program's template: exact question wording,
//                                requirements (limits, required), cycles, deadline
//   aqua://questions/{id}        one canonical question and where approved programs ask it
// Contents follow the tool convention: catalog text only under untrusted_content.

import { callPublicTool } from './tools.mjs'
import { isId } from './data.mjs'

export class ResourceNotFound extends Error {
  constructor(uri) {
    super('Resource not found')
    this.name = 'ResourceNotFound'
    this.uri = uri
  }
}

export const CATALOG_RESOURCES = Object.freeze([
  { uri: 'aqua://programs', name: 'programs', title: 'Approved AQUA programs', description: 'Approved canonical programs: ids, slugs, types, statuses and deadlines. Names are in untrusted_content.', mimeType: 'application/json' },
])

export const CATALOG_RESOURCE_TEMPLATES = Object.freeze([
  { uriTemplate: 'aqua://programs/{slug}', name: 'program', title: 'Program template', description: 'One approved program: exact question wording, word/character limits, required flags, cycles and deadline.', mimeType: 'application/json' },
  { uriTemplate: 'aqua://questions/{id}', name: 'question', title: 'Canonical question', description: 'One canonical question: theme, how many approved programs ask it, and their exact wordings.', mimeType: 'application/json' },
])

function strip(r) {
  const { tool, tier, ...rest } = r.result
  return rest
}

async function body(uri, data) {
  if (uri === 'aqua://programs') {
    const r = await callPublicTool('hub_search_programs', { limit: 100, sort_by: 'name' }, data)
    return { resource: uri, ...strip(r) }
  }
  let m = /^aqua:\/\/programs\/([^/?#]+)$/.exec(uri)
  if (m) {
    const slug = decodeURIComponent(m[1])
    if (!isId(slug)) throw new ResourceNotFound(uri)
    const detail = strip(await callPublicTool('hub_get_program_detail', { slug }, data))
    if (detail.status === 'not_found') throw new ResourceNotFound(uri)
    if (detail.status !== 'ok') return { resource: uri, ...detail }
    const qs = strip(await callPublicTool('hub_get_program_questions', { slug }, data))
    return {
      resource: uri,
      status: 'ok',
      program: detail.program,
      cycles: detail.cycles,
      questions: qs.status === 'ok' ? qs.questions : null,
      sections: { ...detail.sections, questions: { status: qs.status } },
      untrusted_content: {
        notice: detail.untrusted_content.notice,
        data: { program: detail.untrusted_content.data.program, cycles: detail.untrusted_content.data.cycles, questions: qs.untrusted_content?.data?.questions ?? null },
      },
    }
  }
  m = /^aqua:\/\/questions\/([^/?#]+)$/.exec(uri)
  if (m) {
    const id = decodeURIComponent(m[1])
    if (!isId(id)) throw new ResourceNotFound(uri)
    const r = strip(await callPublicTool('hub_get_question_significance', { question_id: id }, data))
    if (r.status === 'not_found') throw new ResourceNotFound(uri)
    return { resource: uri, ...r }
  }
  throw new ResourceNotFound(uri)
}

/** resources/read result for a catalog URI, or throws ResourceNotFound. */
export async function readCatalogResource(uri, data) {
  if (typeof uri !== 'string' || !uri.startsWith('aqua://') || uri.length > 300) throw new ResourceNotFound(uri)
  const out = await body(uri, data)
  return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(out, null, 2) }] }
}

export function isCatalogResource(uri) {
  return typeof uri === 'string' && (uri === 'aqua://programs' || /^aqua:\/\/(programs|questions)\/[^/?#]+$/.test(uri))
}
