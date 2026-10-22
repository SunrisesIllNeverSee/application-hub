// M09 W2 — A1 + QU ingestion engine (pure, client- and server-safe surface).
// fetch-public.ts is SERVER-ONLY and deliberately not re-exported here.
export * from './normalize.ts'
export * from './match.ts'
export * from './extract.ts'
export * from './classify.ts'
export * from './files.ts'
export { parseHtml, htmlToText, decodeEntities } from './html.ts'
export * from './proposal.ts'
